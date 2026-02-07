import * as vscode from 'vscode';
import { AssetTreeNode } from '../models/asset';
import { SyncService } from '../services/syncService';
import {
  createFileTreeItem,
  createFolderTreeItem,
  createRepositoryTreeItem,
  createErrorTreeItem,
  createMessageTreeItem,
  createSkillTreeItem,
} from './treeItems';

export class AssetsTreeProvider implements vscode.TreeDataProvider<AssetTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<AssetTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tree: AssetTreeNode[] = [];

  constructor(private readonly syncService: SyncService) {
    syncService.onDidSync(() => {
      this.tree = syncService.buildTree();
      this._onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    this.tree = this.syncService.buildTree();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AssetTreeNode): vscode.TreeItem {
    console.log(`[TreeProvider] getTreeItem type="${element.type}", label="${element.label}", isSkill=${element.asset?.isSkill ?? 'N/A'}`);

    switch (element.type) {
      case 'file':
        return createFileTreeItem(element);
      case 'skill':
        return createSkillTreeItem(element);
      case 'folder':
        return createFolderTreeItem(element);
      case 'repository':
        return createRepositoryTreeItem(element);
      case 'error':
        return createErrorTreeItem(element);
      case 'message':
        return createMessageTreeItem(element);
    }
  }

  getChildren(element?: AssetTreeNode): AssetTreeNode[] {
    if (!element) {
      // Root level
      if (this.tree.length === 0) {
        return [
          {
            type: 'message',
            label: 'No repositories configured',
            remotePath: '',
            errorMessage: 'Use "Copilot Assets: Configure Repositories" to add repos.',
          },
        ];
      }
      return this.tree;
    }

    return element.children ?? [];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
