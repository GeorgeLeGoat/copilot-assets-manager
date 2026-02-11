import * as vscode from 'vscode';

/**
 * Provides colors for repository and folder nodes in the Copilot Assets tree view.
 * Colors are customizable via workbench.colorCustomizations:
 *   - copilotAssetsManager.repositoryForeground
 *   - copilotAssetsManager.folderForeground
 */
export class TreeDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  static readonly SCHEME = 'copilot-asset-tree';

  static repositoryUri(label: string): vscode.Uri {
    return vscode.Uri.parse(`${TreeDecorationProvider.SCHEME}://repository/${encodeURIComponent(label)}`);
  }

  static folderUri(remotePath: string): vscode.Uri {
    return vscode.Uri.parse(`${TreeDecorationProvider.SCHEME}://folder/${encodeURIComponent(remotePath)}`);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== TreeDecorationProvider.SCHEME) {
      return undefined;
    }

    switch (uri.authority) {
      case 'repository':
        return {
          color: new vscode.ThemeColor('copilotAssetsManager.repositoryForeground'),
          propagate: false,
        };
      case 'folder':
        return {
          color: new vscode.ThemeColor('copilotAssetsManager.folderForeground'),
          propagate: false,
        };
      default:
        return undefined;
    }
  }

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}
