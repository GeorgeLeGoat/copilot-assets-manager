import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as path from 'path';

export function computeHash(content: Uint8Array): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

export async function computeFileHash(fileUri: vscode.Uri): Promise<string> {
  const content = await vscode.workspace.fs.readFile(fileUri);
  return computeHash(content);
}

export async function isLocallyModified(
  fileUri: vscode.Uri,
  storedHash: string
): Promise<boolean> {
  try {
    const currentHash = await computeFileHash(fileUri);
    return currentHash !== storedHash;
  } catch {
    // File doesn't exist or can't be read — treat as not modified
    return false;
  }
}

/**
 * Computes a combined SHA for a skill based on all remote files
 * @param files Array of files with path and sha properties
 * @returns Combined SHA256 hash representing all files
 */
export function computeCombinedRemoteSha(files: Array<{ path: string; sha: string }>): string {
  // Sort files by path for consistent ordering
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // Create a string with path:sha pairs
  const combined = sorted.map(f => `${f.path}:${f.sha}`).join('\n');

  // Hash the combined string
  const hash = crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Computes a combined hash for a skill based on all local files
 * @param workspaceRoot Workspace root URI
 * @param basePath Base path of the skill (e.g., ".github/skills/my-skill")
 * @param filePaths Array of relative file paths within the skill
 * @returns Combined SHA256 hash representing all local files
 */
export async function computeCombinedLocalHash(
  workspaceRoot: vscode.Uri,
  basePath: string,
  filePaths: string[]
): Promise<string> {
  // Sort file paths for consistent ordering
  const sorted = [...filePaths].sort((a, b) => a.localeCompare(b));

  const fileHashes: Array<{ path: string; hash: string }> = [];

  for (const filePath of sorted) {
    try {
      // Extract the relative path within the skill
      // Match optional prefix + skills/skillname/ and remove it
      const relativePath = filePath.replace(/^(.*\/)?skills\/[^\/]+\//, '');
      const localFullPath = path.posix.join(basePath, relativePath);
      const fileUri = vscode.Uri.joinPath(workspaceRoot, localFullPath);

      const content = await vscode.workspace.fs.readFile(fileUri);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      fileHashes.push({ path: relativePath, hash });
    } catch (error) {
      // If any file is missing or unreadable, return empty hash to trigger update
      console.log(`[HashService] Failed to read file for combined hash: ${filePath}`, error);
      return 'sha256:missing-files';
    }
  }

  // Create combined string with relative path:hash pairs
  const combined = fileHashes.map(f => `${f.path}:${f.hash}`).join('\n');

  // Hash the combined string
  const hash = crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
  return `sha256:${hash}`;
}
