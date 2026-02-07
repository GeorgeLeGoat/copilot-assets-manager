import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from './syncService';
import { AssetService } from './assetService';
import { _setConfig } from '../__mocks__/vscode';

describe('SyncService', () => {
  let syncService: SyncService;
  let mockAssetService: AssetService;

  beforeEach(() => {
    mockAssetService = {
      fetchRemoteTree: vi.fn().mockResolvedValue([]),
      computeStatuses: vi.fn().mockResolvedValue([]),
    } as unknown as AssetService;

    syncService = new SyncService(mockAssetService);
  });

  it('returns empty results when no repos configured', async () => {
    _setConfig('copilotAssetsManager.repositories', []);
    const results = await syncService.sync();
    expect(results).toEqual([]);
  });

  it('syncs configured repos', async () => {
    _setConfig('copilotAssetsManager.repositories', [
      { owner: 'org', repo: 'repo1' },
    ]);

    const results = await syncService.sync();
    expect(results).toHaveLength(1);
    expect(results[0].repoConfig.owner).toBe('org');
    expect(results[0].repoConfig.repo).toBe('repo1');
  });

  it('handles errors per repo without blocking others', async () => {
    _setConfig('copilotAssetsManager.repositories', [
      { owner: 'org', repo: 'good-repo' },
      { owner: 'org', repo: 'bad-repo' },
    ]);

    (mockAssetService.fetchRemoteTree as ReturnType<typeof vi.fn>)
      .mockImplementation(async (config: { repo: string }) => {
        if (config.repo === 'bad-repo') {
          throw new Error('Not found');
        }
        return [];
      });

    const results = await syncService.sync();
    expect(results).toHaveLength(2);
    // Good repo succeeds
    expect(results[0].error).toBeUndefined();
    // Bad repo has error
    expect(results[1].error).toBe('Not found');
  });

  it('prevents concurrent syncs', async () => {
    _setConfig('copilotAssetsManager.repositories', [
      { owner: 'org', repo: 'repo1' },
    ]);

    // Make fetchRemoteTree take some time
    (mockAssetService.fetchRemoteTree as ReturnType<typeof vi.fn>)
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 50)));

    const sync1 = syncService.sync();
    const sync2 = syncService.sync();

    await Promise.all([sync1, sync2]);
    // fetchRemoteTree should only be called once (second sync is a no-op)
    expect(mockAssetService.fetchRemoteTree).toHaveBeenCalledTimes(1);
  });

  it('fires onDidSync event', async () => {
    _setConfig('copilotAssetsManager.repositories', []);
    const listener = vi.fn();
    syncService.onDidSync(listener);

    await syncService.sync();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('getUpdateCount returns count of updatable assets', async () => {
    _setConfig('copilotAssetsManager.repositories', [
      { owner: 'org', repo: 'repo1' },
    ]);

    (mockAssetService.computeStatuses as ReturnType<typeof vi.fn>).mockResolvedValue([
      { status: 'up-to-date', remotePath: 'a.md', remoteSha: '1', fileName: 'a.md' },
      { status: 'update-available', remotePath: 'b.md', remoteSha: '2', fileName: 'b.md' },
      { status: 'locally-modified', remotePath: 'c.md', remoteSha: '3', fileName: 'c.md' },
    ]);

    await syncService.sync();
    expect(syncService.getUpdateCount()).toBe(2);
  });
});
