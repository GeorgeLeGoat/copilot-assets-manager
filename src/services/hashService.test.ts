import { describe, it, expect, beforeEach } from 'vitest';
import { computeHash, computeCombinedRemoteSha, computeCombinedLocalHash } from './hashService';
import { _resetMockFs, _setMockFile } from '../__mocks__/vscode';
import * as vscode from 'vscode';

describe('hashService', () => {
  beforeEach(() => {
    _resetMockFs();
  });

  describe('computeHash', () => {
    it('returns sha256 prefixed hash', () => {
      const content = Buffer.from('hello world', 'utf-8');
      const hash = computeHash(content);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns consistent hashes for same content', () => {
      const content = Buffer.from('test content', 'utf-8');
      expect(computeHash(content)).toBe(computeHash(content));
    });

    it('returns different hashes for different content', () => {
      const a = Buffer.from('hello', 'utf-8');
      const b = Buffer.from('world', 'utf-8');
      expect(computeHash(a)).not.toBe(computeHash(b));
    });

    it('handles empty content', () => {
      const content = Buffer.from('', 'utf-8');
      const hash = computeHash(content);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });

  describe('computeCombinedRemoteSha', () => {
    it('returns sha256 prefixed hash', () => {
      const files = [
        { path: 'file1.md', sha: 'abc123' },
        { path: 'file2.md', sha: 'def456' },
      ];
      const hash = computeCombinedRemoteSha(files);
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns consistent hashes for same files', () => {
      const files = [
        { path: 'file1.md', sha: 'abc123' },
        { path: 'file2.md', sha: 'def456' },
      ];
      expect(computeCombinedRemoteSha(files)).toBe(computeCombinedRemoteSha(files));
    });

    it('returns same hash regardless of input order (sorted internally)', () => {
      const files1 = [
        { path: 'b.md', sha: 'sha2' },
        { path: 'a.md', sha: 'sha1' },
      ];
      const files2 = [
        { path: 'a.md', sha: 'sha1' },
        { path: 'b.md', sha: 'sha2' },
      ];
      expect(computeCombinedRemoteSha(files1)).toBe(computeCombinedRemoteSha(files2));
    });

    it('returns different hash when file SHA changes', () => {
      const files1 = [
        { path: 'file.md', sha: 'abc123' },
      ];
      const files2 = [
        { path: 'file.md', sha: 'xyz789' },
      ];
      expect(computeCombinedRemoteSha(files1)).not.toBe(computeCombinedRemoteSha(files2));
    });

    it('returns different hash when files added', () => {
      const files1 = [
        { path: 'file1.md', sha: 'abc123' },
      ];
      const files2 = [
        { path: 'file1.md', sha: 'abc123' },
        { path: 'file2.md', sha: 'def456' },
      ];
      expect(computeCombinedRemoteSha(files1)).not.toBe(computeCombinedRemoteSha(files2));
    });
  });

  describe('computeCombinedLocalHash', () => {
    beforeEach(() => {
      _resetMockFs();
    });

    it('computes combined hash for multiple local files', async () => {
      const workspaceRoot = vscode.Uri.file('/workspace');
      _setMockFile('/workspace/.github/skills/my-skill/SKILL.md', 'skill content');
      _setMockFile('/workspace/.github/skills/my-skill/config.json', '{"key":"value"}');

      const hash = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md', 'skills/my-skill/config.json']
      );

      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns consistent hash for same files', async () => {
      const workspaceRoot = vscode.Uri.file('/workspace');
      _setMockFile('/workspace/.github/skills/my-skill/SKILL.md', 'skill content');
      _setMockFile('/workspace/.github/skills/my-skill/config.json', '{"key":"value"}');

      const hash1 = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md', 'skills/my-skill/config.json']
      );

      const hash2 = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md', 'skills/my-skill/config.json']
      );

      expect(hash1).toBe(hash2);
    });

    it('returns missing-files hash when file does not exist', async () => {
      const workspaceRoot = vscode.Uri.file('/workspace');

      const hash = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md']
      );

      expect(hash).toBe('sha256:missing-files');
    });

    it('returns different hash when file content changes', async () => {
      const workspaceRoot = vscode.Uri.file('/workspace');

      _setMockFile('/workspace/.github/skills/my-skill/SKILL.md', 'original content');
      const hash1 = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md']
      );

      _setMockFile('/workspace/.github/skills/my-skill/SKILL.md', 'modified content');
      const hash2 = await computeCombinedLocalHash(
        workspaceRoot,
        '.github/skills/my-skill',
        ['skills/my-skill/SKILL.md']
      );

      expect(hash1).not.toBe(hash2);
    });
  });
});
