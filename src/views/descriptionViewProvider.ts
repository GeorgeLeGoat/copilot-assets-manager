import * as vscode from 'vscode';
import { Asset } from '../models/asset';
import { GitHubClient } from '../github/client';
import { decodeBase64Content } from '../utils/fileUtils';

interface DescriptionNode {
  label: string;
  description?: string;
  contextValue: string;
}

export class DescriptionViewProvider implements vscode.TreeDataProvider<DescriptionNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<DescriptionNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private currentDescription: string | null = null;
  private currentAsset: Asset | null = null;

  constructor(private readonly client: GitHubClient) {}

  async showDescription(asset: Asset): Promise<void> {
    this.currentAsset = asset;

    try {
      // For skills, fetch SKILL.md content
      // For regular files, fetch the file itself
      let filePath = asset.remotePath;
      if (asset.isSkill && asset.skillFiles) {
        // Find SKILL.md in the skill files
        const skillMdFile = asset.skillFiles.find(f =>
          f.toLowerCase().endsWith('skill.md')
        );
        if (skillMdFile) {
          filePath = skillMdFile;
        }
      }

      // Fetch the file content from GitHub
      const fileContent = await this.client.getFileContent(
        asset.repoConfig.owner,
        asset.repoConfig.repo,
        filePath,
        asset.repoConfig.branch
      );

      const contentBytes = decodeBase64Content(fileContent.content);
      const content = new TextDecoder('utf-8').decode(contentBytes);
      const description = this.extractDescription(content);

      if (description) {
        this.currentDescription = description;
      } else {
        this.currentDescription = 'No description found in this file.';
      }
    } catch (error) {
      console.error('[DescriptionView] Failed to fetch file content:', error);
      this.currentDescription = `Error loading description: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.currentDescription = null;
    this.currentAsset = null;
    this._onDidChangeTreeData.fire();
  }

  private extractDescription(content: string): string | null {
    // Try to extract from YAML frontmatter first
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (descMatch) {
        return descMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      }

      // Try multi-line description with | or >
      const multiLineMatch = frontmatter.match(/^description:\s*[|>]\s*\n((?:[ ]{2,}.+\n?)*)/m);
      if (multiLineMatch) {
        return multiLineMatch[1].trim().replace(/^[ ]{2,}/gm, '').trim();
      }
    }

    // Try to find a Description section in the markdown
    const descSectionMatch = content.match(/^##?\s*Description\s*\n+([^\n#]+(?:\n(?!#)[^\n]+)*)/im);
    if (descSectionMatch) {
      return descSectionMatch[1].trim();
    }

    return null;
  }

  getTreeItem(element: DescriptionNode): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.contextValue = element.contextValue;
    if (element.description) {
      item.description = element.description;
    }
    return item;
  }

  getChildren(element?: DescriptionNode): DescriptionNode[] {
    if (element) {
      return [];
    }

    if (!this.currentDescription) {
      return [
        {
          label: 'Select an asset to view its description',
          contextValue: 'placeholder',
        },
      ];
    }

    if (!this.currentAsset) {
      return [];
    }

    // Split description into lines and create nodes
    const lines = this.currentDescription.split('\n');

    // Add asset name as header
    const nodes: DescriptionNode[] = [
      {
        label: `📄 ${this.currentAsset.fileName}`,
        description: this.currentAsset.isSkill ? 'Skill' : 'File',
        contextValue: 'header',
      },
      {
        label: '─'.repeat(50),
        contextValue: 'separator',
      },
    ];

    // Add description lines
    for (const line of lines) {
      if (line.trim()) {
        nodes.push({
          label: line.trim(),
          contextValue: 'description-line',
        });
      }
    }

    return nodes;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
