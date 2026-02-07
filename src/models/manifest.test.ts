import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestManager } from './manifest';
import { Uri, _resetMockFs, _setMockFile, _getMockFile } from '../__mocks__/vscode';
import { ManifestAssetEntry } from './asset';

describe('ManifestManager', () => {
  let manifest: ManifestManager;
  const workspaceRoot = Uri.file('/workspace');

  const sampleEntry: ManifestAssetEntry = {
    source: {
      owner: 'org',
      repo: 'my-repo',
      branch: 'main',
      path: 'instructions.md',
    },
    remoteSha: 'abc123',
    localContentHash: 'sha256:def456',
    installedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    _resetMockFs();
    manifest = new ManifestManager(workspaceRoot);
  });

  it('starts with empty assets when no manifest file exists', async () => {
    await manifest.load();
    expect(manifest.getAllEntries()).toEqual({});
    expect(manifest.isLoaded()).toBe(true);
  });

  it('loads existing manifest data', async () => {
    const data = {
      version: '1.0',
      assets: {
        '.github/instructions.md': sampleEntry,
      },
    };
    _setMockFile('/workspace/.copilot-assets.json', JSON.stringify(data));

    await manifest.load();
    const entry = manifest.getEntry('.github/instructions.md');
    expect(entry).toEqual(sampleEntry);
  });

  it('recovers from corrupted manifest', async () => {
    _setMockFile('/workspace/.copilot-assets.json', 'not valid json{{{');
    await manifest.load();
    expect(manifest.getAllEntries()).toEqual({});
  });

  it('recovers from manifest missing assets field', async () => {
    _setMockFile('/workspace/.copilot-assets.json', JSON.stringify({ version: '1.0' }));
    await manifest.load();
    expect(manifest.getAllEntries()).toEqual({});
  });

  it('sets and gets entries', async () => {
    await manifest.load();
    manifest.setEntry('.github/file.md', sampleEntry);
    expect(manifest.getEntry('.github/file.md')).toEqual(sampleEntry);
    expect(manifest.hasEntry('.github/file.md')).toBe(true);
  });

  it('removes entries', async () => {
    await manifest.load();
    manifest.setEntry('.github/file.md', sampleEntry);
    manifest.removeEntry('.github/file.md');
    expect(manifest.getEntry('.github/file.md')).toBeUndefined();
    expect(manifest.hasEntry('.github/file.md')).toBe(false);
  });

  it('saves to disk', async () => {
    await manifest.load();
    manifest.setEntry('.github/file.md', sampleEntry);
    await manifest.save();

    const raw = _getMockFile('/workspace/.copilot-assets.json');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(Buffer.from(raw!).toString('utf-8'));
    expect(parsed.version).toBe('1.0');
    expect(parsed.assets['.github/file.md']).toEqual(sampleEntry);
  });

  it('getAllEntries returns a copy', async () => {
    await manifest.load();
    manifest.setEntry('.github/a.md', sampleEntry);
    const entries = manifest.getAllEntries();
    entries['.github/b.md'] = sampleEntry;
    expect(manifest.hasEntry('.github/b.md')).toBe(false);
  });
});
