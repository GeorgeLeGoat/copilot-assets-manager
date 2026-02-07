import * as vscode from 'vscode';
import { RepositoryConfig, RawRepositoryConfig, normalizeRepoConfig } from '../models/repository';

const SECTION = 'copilotAssetsManager';

function getConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

export function getRepositories(): RepositoryConfig[] {
  const raw = getConfig().get<RawRepositoryConfig[]>('repositories', []);
  const results: RepositoryConfig[] = [];
  for (const entry of raw) {
    try {
      results.push(normalizeRepoConfig(entry));
    } catch {
      // Skip invalid entries
    }
  }
  return results;
}

export function getApiBaseUrl(): string {
  const gheUrl = getConfig().get<string>('githubEnterpriseUrl', '').trim();
  if (gheUrl) {
    // Remove trailing slash and append /api/v3
    const base = gheUrl.replace(/\/+$/, '');
    return `${base}/api/v3`;
  }
  return 'https://api.github.com';
}

export function getGitHubHtmlBaseUrl(): string {
  const gheUrl = getConfig().get<string>('githubEnterpriseUrl', '').trim();
  if (gheUrl) {
    return gheUrl.replace(/\/+$/, '');
  }
  return 'https://github.com';
}

export function isGitHubEnterprise(): boolean {
  const gheUrl = getConfig().get<string>('githubEnterpriseUrl', '').trim();
  return gheUrl.length > 0;
}

export function getFileExtensions(): string[] {
  return getConfig().get<string[]>('fileExtensions', ['.md', '.json', '.yml', '.yaml', '.prompt']);
}

export interface DestinationMapping {
  default: string;
  rules: Array<{ pattern: string; destination: string }>;
}

export function getDestinationMappings(): DestinationMapping {
  const mapping = getConfig().get<DestinationMapping>('destinationMappings', {
    default: '.github',
    rules: [],
  });
  return {
    default: mapping.default || '.github',
    rules: Array.isArray(mapping.rules) ? mapping.rules : [],
  };
}

export function getMaxDepth(): number {
  return getConfig().get<number>('maxDepth', 3);
}

export function getCheckOnStartup(): boolean {
  return getConfig().get<boolean>('checkOnStartup', true);
}

export function onConfigurationChange(
  callback: (e: vscode.ConfigurationChangeEvent) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(SECTION)) {
      callback(e);
    }
  });
}
