import * as vscode from 'vscode';
import * as path from 'path';
import { getGitHubHtmlBaseUrl } from '../config/settings';
import { RepositoryConfig } from '../models/repository';

export function getWorkspaceRoot(): vscode.Uri | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return folders[0].uri;
}

export function decodeBase64Content(base64: string): Uint8Array {
  // GitHub sometimes includes newlines in base64 content
  const cleaned = base64.replace(/\n/g, '');
  return Buffer.from(cleaned, 'base64');
}

export async function writeWorkspaceFile(
  workspaceRoot: vscode.Uri,
  relativePath: string,
  content: Uint8Array
): Promise<vscode.Uri> {
  const fileUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
  await vscode.workspace.fs.writeFile(fileUri, content);
  return fileUri;
}

export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(uri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.delete(uri);
}

export function buildGitHubHtmlUrl(
  repoConfig: RepositoryConfig,
  remotePath: string
): string {
  const baseUrl = getGitHubHtmlBaseUrl();
  const filePath = remotePath.replace(/\\/g, '/');
  return `${baseUrl}/${repoConfig.owner}/${repoConfig.repo}/blob/${repoConfig.branch}/${filePath}`;
}

export function getLocalFileUri(
  workspaceRoot: vscode.Uri,
  localPath: string
): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, localPath);
}
