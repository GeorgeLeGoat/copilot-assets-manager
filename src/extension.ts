import * as vscode from 'vscode';
import { GitHubClient, GitHubApiRequestError } from './github/client';
import { AuthenticationError, getGitHubToken, onAuthenticationChange } from './github/auth';
import { ManifestManager } from './models/manifest';
import { AssetService } from './services/assetService';
import { SyncService } from './services/syncService';
import { AssetsTreeProvider } from './views/assetsTreeProvider';
import { DescriptionWebviewProvider } from './views/descriptionWebviewProvider';
import { StatusBarManager } from './views/statusBar';
import { AssetTreeNode, Asset } from './models/asset';
import { onConfigurationChange, getCheckOnStartup } from './config/settings';
import { getWorkspaceRoot, buildGitHubHtmlUrl, getLocalFileUri } from './utils/fileUtils';
import { resolveDestination } from './utils/patternMatcher';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = getWorkspaceRoot();

  // Create services
  const client = new GitHubClient();
  const manifest = workspaceRoot ? new ManifestManager(workspaceRoot) : undefined;
  const assetService =
    workspaceRoot && manifest ? new AssetService(client, manifest, workspaceRoot) : undefined;
  const syncService = assetService ? new SyncService(assetService) : undefined;

  // Create views
  const treeProvider = syncService
    ? new AssetsTreeProvider(syncService)
    : createNoWorkspaceTreeProvider();

  const treeView = vscode.window.createTreeView('copilotAssetsManager.assetsView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Create description webview
  const descriptionProvider = new DescriptionWebviewProvider(context.extensionUri, client);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'copilotAssetsManager.descriptionWebview',
      descriptionProvider
    )
  );
  console.log('[CopilotAssets] Description webview registered with ID: copilotAssetsManager.descriptionWebview');

  // Handle selection changes in assets view
  context.subscriptions.push(
    treeView.onDidChangeSelection(async (e) => {
      if (e.selection.length > 0) {
        const node = e.selection[0];
        if (node.asset) {
          await descriptionProvider.showDescription(node.asset);
        } else {
          descriptionProvider.clear();
        }
      } else {
        descriptionProvider.clear();
      }
    })
  );

  const statusBar = syncService ? new StatusBarManager(syncService) : undefined;
  if (statusBar) {
    context.subscriptions.push(statusBar);
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('copilotAssetsManager.refresh', async () => {
      if (!syncService || !manifest) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      try {
        await manifest.load();
        await syncService.sync();
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.download', async (node?: AssetTreeNode) => {
      if (!assetService || !syncService || !manifest) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const asset = node?.asset;
      if (!asset) {
        return;
      }
      try {
        await assetService.downloadAsset(asset);
        await manifest.load();
        await syncService.sync();
        vscode.window.showInformationMessage(`Downloaded: ${asset.fileName}`);
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.downloadAll', async (node?: AssetTreeNode) => {
      if (!assetService || !syncService || !manifest) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const allAssets = syncService.getAllAssets();
      const toDownload = node?.repoConfig
        ? allAssets.filter(
            (a) =>
              a.status === 'not-installed' &&
              a.repoConfig.owner === node.repoConfig!.owner &&
              a.repoConfig.repo === node.repoConfig!.repo
          )
        : allAssets.filter((a) => a.status === 'not-installed');

      if (toDownload.length === 0) {
        vscode.window.showInformationMessage('All assets are already installed.');
        return;
      }

      try {
        let count = 0;
        for (const asset of toDownload) {
          await assetService.downloadAsset(asset);
          count++;
        }
        await manifest.load();
        await syncService.sync();
        vscode.window.showInformationMessage(`Downloaded ${count} asset${count !== 1 ? 's' : ''}.`);
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.update', async (node?: AssetTreeNode) => {
      if (!assetService || !syncService || !manifest || !workspaceRoot) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const asset = node?.asset;
      if (!asset) {
        return;
      }
      try {
        const result = await assetService.updateAsset(asset);
        if (result === 'conflict') {
          await handleConflict(asset, assetService, manifest, syncService, workspaceRoot);
        } else {
          await manifest.load();
          await syncService.sync();
          vscode.window.showInformationMessage(`Updated: ${asset.fileName}`);
        }
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.updateAll', async () => {
      if (!assetService || !syncService || !manifest || !workspaceRoot) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const updatable = syncService
        .getAllAssets()
        .filter((a) => a.status === 'update-available' || a.status === 'locally-modified');

      if (updatable.length === 0) {
        vscode.window.showInformationMessage('All assets are up to date.');
        return;
      }

      try {
        let updated = 0;
        let conflicts = 0;
        for (const asset of updatable) {
          const result = await assetService.updateAsset(asset);
          if (result === 'updated') {
            updated++;
          } else if (result === 'conflict') {
            conflicts++;
            await handleConflict(asset, assetService, manifest, syncService, workspaceRoot);
          }
        }
        await manifest.load();
        await syncService.sync();
        const parts: string[] = [];
        if (updated > 0) {
          parts.push(`${updated} updated`);
        }
        if (conflicts > 0) {
          parts.push(`${conflicts} conflict${conflicts !== 1 ? 's' : ''}`);
        }
        vscode.window.showInformationMessage(`Assets: ${parts.join(', ')}.`);
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.showDiff', async (node?: AssetTreeNode) => {
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const asset = node?.asset;
      if (!asset || !asset.localPath) {
        return;
      }
      try {
        const localUri = getLocalFileUri(workspaceRoot, asset.localPath);
        const remoteUri = vscode.Uri.parse(
          buildGitHubHtmlUrl(asset.repoConfig, asset.remotePath)
        );
        await vscode.commands.executeCommand(
          'vscode.diff',
          localUri,
          remoteUri,
          `${asset.fileName} (local ↔ remote)`
        );
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.openOnGithub', async (node?: AssetTreeNode) => {
      const asset = node?.asset;
      const repoConfig = node?.repoConfig ?? asset?.repoConfig;
      if (!repoConfig) {
        return;
      }
      const remotePath = asset?.remotePath ?? '';
      const url = buildGitHubHtmlUrl(repoConfig, remotePath);
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),

    vscode.commands.registerCommand('copilotAssetsManager.remove', async (node?: AssetTreeNode) => {
      if (!assetService || !syncService || !manifest) {
        vscode.window.showWarningMessage('Open a workspace to manage assets.');
        return;
      }
      const asset = node?.asset;
      if (!asset) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove "${asset.fileName}" from workspace? The local file will be deleted.`,
        { modal: true },
        'Remove'
      );
      if (confirm !== 'Remove') {
        return;
      }

      try {
        await assetService.removeAsset(asset);
        await manifest.load();
        await syncService.sync();
        vscode.window.showInformationMessage(`Removed: ${asset.fileName}`);
      } catch (error) {
        handleCommandError(error);
      }
    }),

    vscode.commands.registerCommand('copilotAssetsManager.configureRepos', async () => {
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'copilotAssetsManager.repositories'
      );
    })
  );

  // Configuration change listener
  context.subscriptions.push(
    onConfigurationChange(async () => {
      client.updateBaseUrl();
      if (syncService && manifest) {
        await manifest.load();
        await syncService.sync();
      }
    })
  );

  // Authentication change listener
  context.subscriptions.push(
    onAuthenticationChange(async () => {
      if (syncService && manifest) {
        await manifest.load();
        await syncService.sync();
      }
    })
  );

  // Startup check
  if (syncService && manifest && getCheckOnStartup()) {
    setTimeout(async () => {
      try {
        await manifest.load();
        await syncService.sync();
        const updateCount = syncService.getUpdateCount();
        if (updateCount > 0) {
          const action = await vscode.window.showInformationMessage(
            `${updateCount} Copilot asset${updateCount !== 1 ? 's have' : ' has'} updates available.`,
            'View',
            'Update All'
          );
          if (action === 'View') {
            await vscode.commands.executeCommand('copilotAssetsManager.assetsView.focus');
          } else if (action === 'Update All') {
            await vscode.commands.executeCommand('copilotAssetsManager.updateAll');
          }
        }
      } catch {
        // Silently fail on startup check — user didn't explicitly trigger this
      }
    }, 2000);
  }
}

export function deactivate(): void {
  // Cleanup handled by disposables
}

async function handleConflict(
  asset: Asset,
  assetService: AssetService,
  manifest: ManifestManager,
  syncService: SyncService,
  workspaceRoot: vscode.Uri
): Promise<void> {
  const choice = await vscode.window.showWarningMessage(
    `"${asset.fileName}" has been locally modified. Overwrite with the remote version?`,
    'Overwrite',
    'Keep Local',
    'Show Diff'
  );

  if (choice === 'Overwrite') {
    await assetService.forceUpdateAsset(asset);
    await manifest.load();
    await syncService.sync();
    vscode.window.showInformationMessage(`Updated: ${asset.fileName}`);
  } else if (choice === 'Keep Local') {
    await assetService.skipUpdate(asset);
    await manifest.load();
    await syncService.sync();
  } else if (choice === 'Show Diff') {
    const localPath = asset.localPath ?? resolveDestination(asset.remotePath);
    const localUri = getLocalFileUri(workspaceRoot, localPath);
    const remoteUri = vscode.Uri.parse(
      buildGitHubHtmlUrl(asset.repoConfig, asset.remotePath)
    );
    await vscode.commands.executeCommand(
      'vscode.diff',
      localUri,
      remoteUri,
      `${asset.fileName} (local ↔ remote)`
    );
  }
}

function handleCommandError(error: unknown): void {
  if (error instanceof AuthenticationError) {
    vscode.window.showErrorMessage(error.message, 'Sign In').then((action) => {
      if (action === 'Sign In') {
        getGitHubToken(false).catch(() => {});
      }
    });
  } else if (error instanceof GitHubApiRequestError) {
    if (error.status === 404) {
      vscode.window.showErrorMessage(`Repository or path not found. Check your configuration.`);
    } else if (error.rateLimit?.remaining === 0) {
      const resetDate = new Date(error.rateLimit.reset * 1000);
      vscode.window.showErrorMessage(
        `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}.`
      );
    } else {
      vscode.window.showErrorMessage(error.message);
    }
  } else {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error: ${message}`);
  }
}

function createNoWorkspaceTreeProvider(): vscode.TreeDataProvider<AssetTreeNode> {
  return {
    onDidChangeTreeData: new vscode.EventEmitter<AssetTreeNode | undefined | null | void>().event,
    getTreeItem(element: AssetTreeNode): vscode.TreeItem {
      const item = new vscode.TreeItem(element.label);
      item.iconPath = new vscode.ThemeIcon('info');
      return item;
    },
    getChildren(): AssetTreeNode[] {
      return [
        {
          type: 'message',
          label: 'Open a workspace to manage assets',
          remotePath: '',
        },
      ];
    },
  };
}
