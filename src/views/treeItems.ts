import * as vscode from 'vscode';
import { Asset, AssetStatus, AssetTreeNode } from '../models/asset';
import { TreeDecorationProvider } from './treeDecorationProvider';

function statusToIcon(status: AssetStatus): vscode.ThemeIcon {
  switch (status) {
    case 'not-installed':
      return new vscode.ThemeIcon('cloud-download');
    case 'up-to-date':
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    case 'update-available':
      return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
    case 'locally-modified':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('notificationsWarningIcon.foreground'));
  }
}

function statusToContextValue(status: AssetStatus): string {
  return `asset-${status}`;
}

function statusToDescription(status: AssetStatus): string {
  switch (status) {
    case 'not-installed':
      return 'Not installed';
    case 'up-to-date':
      return 'Up to date';
    case 'update-available':
      return 'Update available';
    case 'locally-modified':
      return 'Locally modified';
  }
}

export function createFileTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  const asset = node.asset!;

  item.iconPath = statusToIcon(asset.status);
  item.contextValue = statusToContextValue(asset.status);
  item.description = statusToDescription(asset.status);
  item.tooltip = `${asset.remotePath}\nStatus: ${statusToDescription(asset.status)}${asset.localPath ? `\nLocal: ${asset.localPath}` : ''}`;

  console.log(`[TreeItems] Creating file TreeItem: "${node.label}", remotePath: "${asset.remotePath}", isSkill: ${asset.isSkill ?? false}`);

  return item;
}

export function createFolderTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
  item.iconPath = vscode.ThemeIcon.Folder;
  item.contextValue = 'folder';
  item.resourceUri = TreeDecorationProvider.folderUri(node.remotePath || node.label);
  return item;
}

export function createRepositoryTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
  item.iconPath = new vscode.ThemeIcon('repo');
  item.contextValue = 'repository';
  item.resourceUri = TreeDecorationProvider.repositoryUri(node.label);
  item.tooltip = node.repoConfig
    ? `${node.repoConfig.owner}/${node.repoConfig.repo} (${node.repoConfig.branch})`
    : node.label;
  return item;
}

export function createErrorTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
  item.contextValue = 'error';
  item.tooltip = node.errorMessage ?? 'An error occurred';
  item.description = 'Error';
  return item;
}

export function createMessageTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon('info');
  item.contextValue = 'message';
  item.tooltip = node.errorMessage;
  return item;
}

export function createSkillTreeItem(node: AssetTreeNode): vscode.TreeItem {
  const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  const asset = node.asset!;

  item.iconPath = statusToIcon(asset.status);
  item.contextValue = statusToContextValue(asset.status);
  const fileCount = asset.skillFiles?.length ?? 0;
  item.description = `🎓 Skill (${fileCount} files) - ${statusToDescription(asset.status)}`;

  console.log(`[TreeItems] Creating skill TreeItem: "${node.label}", files: ${fileCount}, description: "${item.description}"`);

  item.tooltip = `${asset.remotePath}\nType: Skill (${fileCount} file${fileCount !== 1 ? 's' : ''})\nStatus: ${statusToDescription(asset.status)}${asset.localPath ? `\nLocal: ${asset.localPath}` : ''}`;

  return item;
}
