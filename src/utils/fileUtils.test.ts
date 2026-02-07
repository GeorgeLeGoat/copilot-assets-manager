import { describe, it, expect } from 'vitest';
import { decodeBase64Content, buildGitHubHtmlUrl } from './fileUtils';
import { _setConfig } from '../__mocks__/vscode';
import { RepositoryConfig } from '../models/repository';

describe('decodeBase64Content', () => {
  it('decodes base64 to buffer', () => {
    const base64 = Buffer.from('hello world', 'utf-8').toString('base64');
    const result = decodeBase64Content(base64);
    expect(Buffer.from(result).toString('utf-8')).toBe('hello world');
  });

  it('handles base64 with newlines (GitHub format)', () => {
    const content = 'hello world';
    const base64WithNewlines = Buffer.from(content, 'utf-8')
      .toString('base64')
      .match(/.{1,4}/g)!
      .join('\n');
    const result = decodeBase64Content(base64WithNewlines);
    expect(Buffer.from(result).toString('utf-8')).toBe(content);
  });

  it('handles empty content', () => {
    const result = decodeBase64Content('');
    expect(result.length).toBe(0);
  });
});

describe('buildGitHubHtmlUrl', () => {
  const repo: RepositoryConfig = {
    owner: 'org',
    repo: 'my-repo',
    branch: 'main',
    path: '',
    label: 'My Repo',
  };

  it('builds URL for github.com', () => {
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', '');
    const url = buildGitHubHtmlUrl(repo, 'path/to/file.md');
    expect(url).toBe('https://github.com/org/my-repo/blob/main/path/to/file.md');
  });

  it('builds URL for GitHub Enterprise', () => {
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', 'https://ghe.example.com');
    const url = buildGitHubHtmlUrl(repo, 'file.md');
    expect(url).toBe('https://ghe.example.com/org/my-repo/blob/main/file.md');
    // Reset
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', '');
  });

  it('handles backslashes in remote path', () => {
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', '');
    const url = buildGitHubHtmlUrl(repo, 'path\\to\\file.md');
    expect(url).toBe('https://github.com/org/my-repo/blob/main/path/to/file.md');
  });
});
