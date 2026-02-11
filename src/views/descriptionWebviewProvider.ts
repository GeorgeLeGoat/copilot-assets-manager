import * as vscode from 'vscode';
import { Asset } from '../models/asset';
import { GitHubClient } from '../github/client';
import { decodeBase64Content } from '../utils/fileUtils';

export class DescriptionWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private currentAsset: Asset | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly client: GitHubClient
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    console.log('[DescriptionWebview] resolveWebviewView called');
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: false, // No scripts needed for static content
      localResourceRoots: [this._extensionUri],
    };

    console.log('[DescriptionWebview] Webview configured, updating view');
    this.updateView();
    console.log('[DescriptionWebview] Initial view updated');
  }

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

      this.updateView(description);
    } catch (error) {
      console.error('[DescriptionView] Failed to fetch file content:', error);
      const errorMessage = `Error loading description: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.updateView(errorMessage);
    }
  }

  clear(): void {
    this.currentAsset = null;
    this.updateView();
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

  private updateView(description?: string | null): void {
    if (!this.view) {
      return;
    }

    const assetName = this.currentAsset?.fileName || '';
    const assetType = this.currentAsset?.isSkill ? 'Skill' : 'File';
    const displayDescription = description || 'Select an asset to view its description';

    this.view.webview.html = this.getHtmlContent(assetName, assetType, displayDescription);
  }

  private getHtmlContent(assetName: string, assetType: string, description: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Description</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 12px;
            line-height: 1.5;
        }
        .header {
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .asset-name {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 4px;
        }
        .asset-type {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        .description-container {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 10px;
            min-height: 100px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            user-select: text;
            cursor: text;
        }
        .description-container::-webkit-scrollbar {
            width: 10px;
        }
        .description-container::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }
        .description-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 5px;
        }
        .placeholder {
            color: var(--vscode-input-placeholderForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    ${assetName ? `
    <div class="header">
        <div class="asset-name">📄 ${this.escapeHtml(assetName)}</div>
        <div class="asset-type">${this.escapeHtml(assetType)}</div>
    </div>
    ` : ''}
    <div class="description-container ${!assetName ? 'placeholder' : ''}">
${this.escapeHtml(description)}
    </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
