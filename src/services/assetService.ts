import * as vscode from 'vscode';
import * as path from 'path';
import { GitHubClient } from '../github/client';
import { GitHubTreeNode } from '../github/types';
import { Asset, AssetStatus, ManifestAssetEntry } from '../models/asset';
import { ManifestManager } from '../models/manifest';
import { RepositoryConfig } from '../models/repository';
import { getFileExtensions, getMaxDepth } from '../config/settings';
import { computeHash, computeFileHash } from './hashService';
import { resolveDestination, isAllowedExtension } from '../utils/patternMatcher';
import {
  decodeBase64Content,
  writeWorkspaceFile,
  fileExists,
  deleteFile,
  getLocalFileUri,
} from '../utils/fileUtils';

export class AssetService {
  constructor(
    private readonly client: GitHubClient,
    private readonly manifest: ManifestManager,
    private readonly workspaceRoot: vscode.Uri
  ) {}

  async fetchRemoteTree(repoConfig: RepositoryConfig): Promise<GitHubTreeNode[]> {
    const treeResponse = await this.client.getTree(
      repoConfig.owner,
      repoConfig.repo,
      repoConfig.branch
    );

    const extensions = getFileExtensions();
    const maxDepth = getMaxDepth();
    const basePath = repoConfig.path;

    // Return all blob nodes - we'll filter in computeStatuses to handle skills properly
    return treeResponse.tree.filter((node) => {
      if (node.type !== 'blob') {
        return false;
      }

      const nodePath = node.path;
      if (basePath) {
        if (!nodePath.startsWith(basePath + '/') && nodePath !== basePath) {
          return false;
        }
      }

      const relativePath = basePath ? nodePath.slice(basePath.length + 1) : nodePath;
      const depth = relativePath.split('/').length - 1;
      if (depth > maxDepth) {
        return false;
      }

      return true;
    });
  }

  async computeStatuses(
    repoConfig: RepositoryConfig,
    remoteNodes: GitHubTreeNode[]
  ): Promise<Asset[]> {
    const assets: Asset[] = [];
    const allEntries = this.manifest.getAllEntries();
    const extensions = getFileExtensions();
    const processedSkills = new Set<string>();

    // Group files by skill directories
    const skillMap = new Map<string, GitHubTreeNode[]>();
    const regularFiles: GitHubTreeNode[] = [];

    for (const node of remoteNodes) {
      const nodePath = node.path;

      // Check if this is inside a skills/ directory
      const skillMatch = nodePath.match(/^(.+\/)?skills\/([^\/]+)\//);

      if (skillMatch) {
        const skillName = skillMatch[2];
        const skillPrefix = skillMatch[1] ? `${skillMatch[1]}skills/${skillName}` : `skills/${skillName}`;

        if (!skillMap.has(skillPrefix)) {
          skillMap.set(skillPrefix, []);
        }
        skillMap.get(skillPrefix)!.push(node);
      } else if (isAllowedExtension(path.posix.basename(nodePath), extensions)) {
        regularFiles.push(node);
      }
    }

    // Process skills as single assets
    for (const [skillPath, files] of skillMap.entries()) {
      // Check if this skill has a SKILL.md file
      const hasSkillMd = files.some(f =>
        path.posix.basename(f.path).toLowerCase() === 'skill.md'
      );

      if (!hasSkillMd) {
        // Not a valid skill - treat files as regular
        regularFiles.push(...files.filter(f =>
          isAllowedExtension(path.posix.basename(f.path), extensions)
        ));
        console.log(`[AssetService] Skill folder without SKILL.md: ${skillPath}, treating ${files.length} files as regular`);
        continue;
      }

      const skillName = path.posix.basename(skillPath);
      const localPath = resolveDestination(skillPath);

      console.log(`[AssetService] Detected valid skill: "${skillName}" at "${skillPath}", contains ${files.length} files`);

      // Compute combined SHA for all files in the skill
      const { computeCombinedRemoteSha, computeCombinedLocalHash } = await import('./hashService');
      const combinedRemoteSha = computeCombinedRemoteSha(files);

      const manifestKey = `${localPath}/SKILL.md`;
      const manifestEntry = allEntries[manifestKey];

      let status: AssetStatus;

      if (!manifestEntry) {
        status = 'not-installed';
      } else {
        // Always check if SKILL.md exists locally (if it's missing, whole skill is missing)
        const localUri = getLocalFileUri(this.workspaceRoot, manifestKey);
        const exists = await fileExists(localUri);

        if (!exists) {
          // File was deleted manually - mark as not installed
          status = 'not-installed';
        } else if (manifestEntry.remoteSha !== combinedRemoteSha) {
          // Remote has changed - check if local was modified
          // Compute combined hash of all local files
          const currentHash = await computeCombinedLocalHash(
            this.workspaceRoot,
            localPath,
            files.map(f => f.path)
          );
          if (currentHash !== manifestEntry.localContentHash) {
            status = 'locally-modified';
          } else {
            status = 'update-available';
          }
        } else {
          // SHAs match - file is up to date
          status = 'up-to-date';
        }
      }

      assets.push({
        remotePath: skillPath,
        remoteSha: combinedRemoteSha,
        fileName: skillName,
        repoConfig,
        localPath,
        status,
        isSkill: true,
        skillFiles: files.map(f => f.path),
      });

      processedSkills.add(skillPath);
    }

    // Process regular files
    for (const node of regularFiles) {
      const localPath = resolveDestination(node.path);
      const manifestEntry = allEntries[localPath];

      let status: AssetStatus;

      if (!manifestEntry) {
        status = 'not-installed';
      } else {
        // Always check if file exists locally
        const localUri = getLocalFileUri(this.workspaceRoot, localPath);
        const exists = await fileExists(localUri);

        if (!exists) {
          // File was deleted manually - mark as not installed
          status = 'not-installed';
        } else if (manifestEntry.remoteSha !== node.sha) {
          // Remote has changed - check if local was modified
          const currentHash = await computeFileHash(localUri);
          if (currentHash !== manifestEntry.localContentHash) {
            status = 'locally-modified';
          } else {
            status = 'update-available';
          }
        } else {
          // SHAs match - file is up to date
          status = 'up-to-date';
        }
      }

      assets.push({
        remotePath: node.path,
        remoteSha: node.sha,
        fileName: path.posix.basename(node.path),
        repoConfig,
        localPath,
        status,
      });
    }

    return assets;
  }

  async downloadAsset(asset: Asset): Promise<void> {
    if (asset.isSkill && asset.skillFiles) {
      // Download all files in the skill directory
      await this.downloadSkill(asset);
    } else {
      // Download single file
      await this.downloadSingleFile(asset);
    }
  }

  private async downloadSingleFile(asset: Asset): Promise<void> {
    const fileContent = await this.client.getFileContent(
      asset.repoConfig.owner,
      asset.repoConfig.repo,
      asset.remotePath,
      asset.repoConfig.branch
    );

    const content = decodeBase64Content(fileContent.content);
    const localPath = asset.localPath ?? resolveDestination(asset.remotePath);

    await writeWorkspaceFile(this.workspaceRoot, localPath, content);

    const contentHash = computeHash(content);
    const now = new Date().toISOString();

    this.manifest.setEntry(localPath, {
      source: {
        owner: asset.repoConfig.owner,
        repo: asset.repoConfig.repo,
        branch: asset.repoConfig.branch,
        path: asset.remotePath,
      },
      remoteSha: fileContent.sha,
      localContentHash: contentHash,
      installedAt: now,
      updatedAt: now,
    });

    await this.manifest.save();
  }

  private async downloadSkill(asset: Asset): Promise<void> {
    if (!asset.skillFiles || asset.skillFiles.length === 0) {
      return;
    }

    const baseLocalPath = asset.localPath ?? resolveDestination(asset.remotePath);
    const now = new Date().toISOString();

    const remoteFiles: Array<{ path: string; sha: string }> = [];

    // Download all files in the skill directory
    for (const filePath of asset.skillFiles) {
      const fileContent = await this.client.getFileContent(
        asset.repoConfig.owner,
        asset.repoConfig.repo,
        filePath,
        asset.repoConfig.branch
      );

      const content = decodeBase64Content(fileContent.content);
      const localFilePath = resolveDestination(filePath);

      await writeWorkspaceFile(this.workspaceRoot, localFilePath, content);

      const contentHash = computeHash(content);

      remoteFiles.push({ path: filePath, sha: fileContent.sha });

      // Store each file in the manifest
      this.manifest.setEntry(localFilePath, {
        source: {
          owner: asset.repoConfig.owner,
          repo: asset.repoConfig.repo,
          branch: asset.repoConfig.branch,
          path: filePath,
        },
        remoteSha: fileContent.sha,
        localContentHash: contentHash,
        installedAt: now,
        updatedAt: now,
      });
    }

    // Compute and store combined hash for the skill in SKILL.md entry
    const { computeCombinedRemoteSha, computeCombinedLocalHash } = await import('./hashService');
    const combinedRemoteSha = computeCombinedRemoteSha(remoteFiles);
    const combinedLocalHash = await computeCombinedLocalHash(
      this.workspaceRoot,
      baseLocalPath,
      asset.skillFiles
    );

    // Store skill metadata in SKILL.md entry with combined hashes
    const skillMdPath = `${baseLocalPath}/SKILL.md`;
    this.manifest.setEntry(skillMdPath, {
      source: {
        owner: asset.repoConfig.owner,
        repo: asset.repoConfig.repo,
        branch: asset.repoConfig.branch,
        path: asset.remotePath,
      },
      remoteSha: combinedRemoteSha,
      localContentHash: combinedLocalHash,
      installedAt: now,
      updatedAt: now,
    });

    await this.manifest.save();
  }

  async updateAsset(asset: Asset): Promise<'updated' | 'skipped' | 'conflict'> {
    if (asset.isSkill && asset.skillFiles) {
      // For skills, check combined hash for conflicts
      const skillMdPath = `${asset.localPath}/SKILL.md`;
      const manifestEntry = this.manifest.getEntry(skillMdPath);

      if (manifestEntry) {
        // Check if SKILL.md exists (if not, whole skill is missing)
        const localUri = getLocalFileUri(this.workspaceRoot, skillMdPath);
        const exists = await fileExists(localUri);

        if (exists) {
          // Compute combined hash of all local files
          const { computeCombinedLocalHash } = await import('./hashService');
          const currentHash = await computeCombinedLocalHash(
            this.workspaceRoot,
            asset.localPath!,
            asset.skillFiles
          );
          if (currentHash !== manifestEntry.localContentHash) {
            return 'conflict';
          }
        }
      }

      // No conflict — update entire skill
      await this.downloadSkill(asset);
      return 'updated';
    } else {
      // Regular file
      const localPath = asset.localPath ?? resolveDestination(asset.remotePath);
      const localUri = getLocalFileUri(this.workspaceRoot, localPath);
      const manifestEntry = this.manifest.getEntry(localPath);

      if (manifestEntry) {
        const exists = await fileExists(localUri);
        if (exists) {
          const currentHash = await computeFileHash(localUri);
          if (currentHash !== manifestEntry.localContentHash) {
            return 'conflict';
          }
        }
      }

      // No conflict — proceed with update
      await this.forceUpdateAsset(asset);
      return 'updated';
    }
  }

  async forceUpdateAsset(asset: Asset): Promise<void> {
    if (asset.isSkill && asset.skillFiles) {
      await this.downloadSkill(asset);
    } else {
      const fileContent = await this.client.getFileContent(
        asset.repoConfig.owner,
        asset.repoConfig.repo,
        asset.remotePath,
        asset.repoConfig.branch
      );

      const content = decodeBase64Content(fileContent.content);
      const localPath = asset.localPath ?? resolveDestination(asset.remotePath);

      await writeWorkspaceFile(this.workspaceRoot, localPath, content);

      const contentHash = computeHash(content);
      const now = new Date().toISOString();
      const existingEntry = this.manifest.getEntry(localPath);

      this.manifest.setEntry(localPath, {
        source: {
          owner: asset.repoConfig.owner,
          repo: asset.repoConfig.repo,
          branch: asset.repoConfig.branch,
          path: asset.remotePath,
        },
        remoteSha: fileContent.sha,
        localContentHash: contentHash,
        installedAt: existingEntry?.installedAt ?? now,
        updatedAt: now,
      });

      await this.manifest.save();
    }
  }

  async skipUpdate(asset: Asset): Promise<void> {
    if (asset.isSkill && asset.skillFiles) {
      // Update all skill file entries
      for (const filePath of asset.skillFiles) {
        const localFilePath = resolveDestination(filePath);
        const manifestEntry = this.manifest.getEntry(localFilePath);

        if (manifestEntry) {
          // Find the corresponding remote node SHA
          const isSkillsMd = path.posix.basename(filePath).toLowerCase() === 'skills.md';
          this.manifest.setEntry(localFilePath, {
            ...manifestEntry,
            remoteSha: isSkillsMd ? asset.remoteSha : manifestEntry.remoteSha,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      await this.manifest.save();
    } else {
      const localPath = asset.localPath ?? resolveDestination(asset.remotePath);
      const manifestEntry = this.manifest.getEntry(localPath);

      if (manifestEntry) {
        this.manifest.setEntry(localPath, {
          ...manifestEntry,
          remoteSha: asset.remoteSha,
          updatedAt: new Date().toISOString(),
        });
        await this.manifest.save();
      }
    }
  }

  async removeAsset(asset: Asset): Promise<void> {
    if (asset.isSkill && asset.skillFiles) {
      // Remove all files in the skill directory
      for (const filePath of asset.skillFiles) {
        const localFilePath = resolveDestination(filePath);
        const localUri = getLocalFileUri(this.workspaceRoot, localFilePath);

        const exists = await fileExists(localUri);
        if (exists) {
          await deleteFile(localUri);
        }

        this.manifest.removeEntry(localFilePath);
      }

      // Also remove the skill metadata entry
      const skillMdPath = `${asset.localPath}/SKILL.md`;
      this.manifest.removeEntry(skillMdPath);

      await this.manifest.save();
    } else {
      const localPath = asset.localPath ?? resolveDestination(asset.remotePath);
      const localUri = getLocalFileUri(this.workspaceRoot, localPath);

      const exists = await fileExists(localUri);
      if (exists) {
        await deleteFile(localUri);
      }

      this.manifest.removeEntry(localPath);
      await this.manifest.save();
    }
  }

  countByStatus(assets: Asset[], status: AssetStatus): number {
    return assets.filter((a) => a.status === status).length;
  }

  collectByStatus(assets: Asset[], status: AssetStatus): Asset[] {
    return assets.filter((a) => a.status === status);
  }
}
