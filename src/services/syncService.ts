import * as vscode from 'vscode';
import { AssetService } from './assetService';
import { Asset, AssetTreeNode } from '../models/asset';
import { RepositoryConfig, repoId } from '../models/repository';
import { getRepositories } from '../config/settings';
import { AuthenticationError } from '../github/auth';
import { GitHubApiRequestError } from '../github/client';

export interface SyncResult {
  repoConfig: RepositoryConfig;
  assets: Asset[];
  error?: string;
  errorType?: 'auth' | 'not-found' | 'rate-limit' | 'network' | 'unknown';
}

export class SyncService {
  private syncing = false;
  private lastResults: SyncResult[] = [];

  private readonly _onDidSync = new vscode.EventEmitter<SyncResult[]>();
  readonly onDidSync = this._onDidSync.event;

  constructor(private readonly assetService: AssetService) {}

  get isSyncing(): boolean {
    return this.syncing;
  }

  get results(): SyncResult[] {
    return this.lastResults;
  }

  async sync(): Promise<SyncResult[]> {
    if (this.syncing) {
      return this.lastResults;
    }

    this.syncing = true;

    try {
      const repos = getRepositories();

      if (repos.length === 0) {
        this.lastResults = [];
        this._onDidSync.fire(this.lastResults);
        return this.lastResults;
      }

      const promises = repos.map((repoConfig) =>
        this.syncRepo(repoConfig)
      );

      this.lastResults = await Promise.allSettled(promises).then((results) =>
        results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }
          return {
            repoConfig: repos[index],
            assets: [],
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            errorType: 'unknown' as const,
          };
        })
      );

      this._onDidSync.fire(this.lastResults);
      return this.lastResults;
    } finally {
      this.syncing = false;
    }
  }

  private async syncRepo(repoConfig: RepositoryConfig): Promise<SyncResult> {
    try {
      const remoteNodes = await this.assetService.fetchRemoteTree(repoConfig);
      const assets = await this.assetService.computeStatuses(repoConfig, remoteNodes);

      return { repoConfig, assets };
    } catch (error) {
      const errorType = classifyError(error);
      const message = error instanceof Error ? error.message : String(error);

      return {
        repoConfig,
        assets: [],
        error: message,
        errorType,
      };
    }
  }

  getAllAssets(): Asset[] {
    return this.lastResults.flatMap((r) => r.assets);
  }

  getUpdateCount(): number {
    return this.getAllAssets().filter(
      (a) => a.status === 'update-available' || a.status === 'locally-modified'
    ).length;
  }

  buildTree(): AssetTreeNode[] {
    const repos = getRepositories();

    if (repos.length === 0) {
      return [
        {
          type: 'message',
          label: 'No repositories configured',
          remotePath: '',
          errorMessage: 'Use "Copilot Assets: Configure Repositories" to add repos.',
        },
      ];
    }

    return this.lastResults.map((result) => {
      if (result.error) {
        return {
          type: 'error' as const,
          label: result.repoConfig.label,
          remotePath: '',
          repoConfig: result.repoConfig,
          errorMessage: result.error,
          children: [],
        };
      }

      const rootNode: AssetTreeNode = {
        type: 'repository',
        label: result.repoConfig.label,
        remotePath: '',
        repoConfig: result.repoConfig,
        children: [],
      };

      // Build folder hierarchy from flat list
      const folderMap = new Map<string, AssetTreeNode>();
      folderMap.set('', rootNode);

      // Sort assets by path for consistent ordering
      const sorted = [...result.assets].sort((a, b) =>
        a.remotePath.localeCompare(b.remotePath)
      );

      for (const asset of sorted) {
        const relativePath = result.repoConfig.path
          ? asset.remotePath.slice(result.repoConfig.path.length + 1)
          : asset.remotePath;

        if (asset.isSkill) {
          // For skills, add directly to the parent folder structure
          const parts = relativePath.split('/');
          const skillName = parts.pop()!;

          // Ensure all parent folders exist (up to but not including the skill folder)
          let currentPath = '';
          let parent = rootNode;

          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            let folder = folderMap.get(currentPath);

            if (!folder) {
              folder = {
                type: 'folder',
                label: part,
                remotePath: currentPath,
                repoConfig: result.repoConfig,
                children: [],
              };
              folderMap.set(currentPath, folder);
              parent.children!.push(folder);
            }

            parent = folder;
          }

          // Add skill node (no children, represents the entire folder)
          parent.children!.push({
            type: 'skill',
            label: skillName,
            remotePath: asset.remotePath,
            repoConfig: result.repoConfig,
            asset,
          });
        } else {
          // Regular file - standard hierarchy
          const parts = relativePath.split('/');
          const fileName = parts.pop()!;

          // Ensure all parent folders exist
          let currentPath = '';
          let parent = rootNode;

          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            let folder = folderMap.get(currentPath);

            if (!folder) {
              folder = {
                type: 'folder',
                label: part,
                remotePath: currentPath,
                repoConfig: result.repoConfig,
                children: [],
              };
              folderMap.set(currentPath, folder);
              parent.children!.push(folder);
            }

            parent = folder;
          }

          // Add file node
          parent.children!.push({
            type: 'file',
            label: fileName,
            remotePath: asset.remotePath,
            repoConfig: result.repoConfig,
            asset,
          });
        }
      }

      return rootNode;
    });
  }

  dispose(): void {
    this._onDidSync.dispose();
  }
}

function classifyError(error: unknown): SyncResult['errorType'] {
  if (error instanceof AuthenticationError) {
    return 'auth';
  }
  if (error instanceof GitHubApiRequestError) {
    if (error.status === 404) {
      return 'not-found';
    }
    if (error.status === 403 && error.rateLimit?.remaining === 0) {
      return 'rate-limit';
    }
    return 'network';
  }
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }
  return 'unknown';
}
