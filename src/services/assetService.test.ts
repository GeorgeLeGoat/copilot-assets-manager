import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetService } from './assetService';
import { ManifestManager } from '../models/manifest';
import { GitHubClient } from '../github/client';
import { Asset, ManifestAssetEntry } from '../models/asset';
import { RepositoryConfig } from '../models/repository';
import { Uri, _resetMockFs, _setMockFile, _setConfig } from '../__mocks__/vscode';
import { computeHash } from './hashService';

// Reset config for tests
beforeEach(() => {
  _setConfig('copilotAssetsManager.fileExtensions', ['.md', '.json', '.yml', '.yaml', '.prompt']);
  _setConfig('copilotAssetsManager.maxDepth', 3);
  _setConfig('copilotAssetsManager.destinationMappings', { default: '.github', rules: [] });
});

describe('AssetService', () => {
  let client: GitHubClient;
  let manifest: ManifestManager;
  let service: AssetService;
  const workspaceRoot = Uri.file('/workspace');

  const repoConfig: RepositoryConfig = {
    owner: 'org',
    repo: 'my-repo',
    branch: 'main',
    path: '',
    label: 'My Repo',
  };

  beforeEach(() => {
    _resetMockFs();
    client = new GitHubClient();
    manifest = new ManifestManager(workspaceRoot);
    service = new AssetService(client, manifest, workspaceRoot);
  });

  describe('computeStatuses', () => {
    it('marks assets as not-installed when not in manifest', async () => {
      await manifest.load();

      const nodes = [
        { path: 'instructions.md', mode: '100644', type: 'blob' as const, sha: 'abc', url: '' },
      ];

      const assets = await service.computeStatuses(repoConfig, nodes);
      expect(assets).toHaveLength(1);
      expect(assets[0].status).toBe('not-installed');
    });

    it('marks assets as up-to-date when SHAs match', async () => {
      const content = Buffer.from('hello', 'utf-8');
      const hash = computeHash(content);

      _setMockFile('/workspace/.github/instructions.md', content);

      const manifestData = {
        version: '1.0',
        assets: {
          '.github/instructions.md': {
            source: { owner: 'org', repo: 'my-repo', branch: 'main', path: 'instructions.md' },
            remoteSha: 'abc123',
            localContentHash: hash,
            installedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
      };
      _setMockFile('/workspace/.copilot-assets.json', JSON.stringify(manifestData));
      await manifest.load();

      const nodes = [
        { path: 'instructions.md', mode: '100644', type: 'blob' as const, sha: 'abc123', url: '' },
      ];

      const assets = await service.computeStatuses(repoConfig, nodes);
      expect(assets[0].status).toBe('up-to-date');
    });

    it('marks assets as update-available when remote SHA differs and not locally modified', async () => {
      const content = Buffer.from('hello', 'utf-8');
      const hash = computeHash(content);

      _setMockFile('/workspace/.github/instructions.md', content);

      const manifestData = {
        version: '1.0',
        assets: {
          '.github/instructions.md': {
            source: { owner: 'org', repo: 'my-repo', branch: 'main', path: 'instructions.md' },
            remoteSha: 'old-sha',
            localContentHash: hash,
            installedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
      };
      _setMockFile('/workspace/.copilot-assets.json', JSON.stringify(manifestData));
      await manifest.load();

      const nodes = [
        { path: 'instructions.md', mode: '100644', type: 'blob' as const, sha: 'new-sha', url: '' },
      ];

      const assets = await service.computeStatuses(repoConfig, nodes);
      expect(assets[0].status).toBe('update-available');
    });

    it('marks assets as locally-modified when file hash changed and remote SHA differs', async () => {
      const originalContent = Buffer.from('original', 'utf-8');
      const modifiedContent = Buffer.from('modified', 'utf-8');
      const originalHash = computeHash(originalContent);

      _setMockFile('/workspace/.github/instructions.md', modifiedContent);

      const manifestData = {
        version: '1.0',
        assets: {
          '.github/instructions.md': {
            source: { owner: 'org', repo: 'my-repo', branch: 'main', path: 'instructions.md' },
            remoteSha: 'old-sha',
            localContentHash: originalHash,
            installedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
      };
      _setMockFile('/workspace/.copilot-assets.json', JSON.stringify(manifestData));
      await manifest.load();

      const nodes = [
        { path: 'instructions.md', mode: '100644', type: 'blob' as const, sha: 'new-sha', url: '' },
      ];

      const assets = await service.computeStatuses(repoConfig, nodes);
      expect(assets[0].status).toBe('locally-modified');
    });

    it('marks assets as not-installed when file was manually deleted', async () => {
      const content = Buffer.from('hello', 'utf-8');
      const hash = computeHash(content);

      // File exists in manifest but NOT on disk
      const manifestData = {
        version: '1.0',
        assets: {
          '.github/instructions.md': {
            source: { owner: 'org', repo: 'my-repo', branch: 'main', path: 'instructions.md' },
            remoteSha: 'abc123',
            localContentHash: hash,
            installedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
      };
      _setMockFile('/workspace/.copilot-assets.json', JSON.stringify(manifestData));
      await manifest.load();

      const nodes = [
        { path: 'instructions.md', mode: '100644', type: 'blob' as const, sha: 'abc123', url: '' },
      ];

      const assets = await service.computeStatuses(repoConfig, nodes);
      expect(assets[0].status).toBe('not-installed');
    });
  });

  describe('countByStatus / collectByStatus', () => {
    it('counts and collects assets by status', () => {
      const assets: Asset[] = [
        { remotePath: 'a.md', remoteSha: '1', fileName: 'a.md', repoConfig, status: 'not-installed' },
        { remotePath: 'b.md', remoteSha: '2', fileName: 'b.md', repoConfig, status: 'up-to-date' },
        { remotePath: 'c.md', remoteSha: '3', fileName: 'c.md', repoConfig, status: 'update-available' },
        { remotePath: 'd.md', remoteSha: '4', fileName: 'd.md', repoConfig, status: 'not-installed' },
      ];

      expect(service.countByStatus(assets, 'not-installed')).toBe(2);
      expect(service.countByStatus(assets, 'up-to-date')).toBe(1);
      expect(service.countByStatus(assets, 'update-available')).toBe(1);
      expect(service.collectByStatus(assets, 'not-installed')).toHaveLength(2);
    });
  });
});
