import { describe, it, expect } from 'vitest';
import { normalizeRepoConfig, repoId } from './repository';

describe('normalizeRepoConfig', () => {
  it('fills defaults for optional fields', () => {
    const result = normalizeRepoConfig({ owner: 'org', repo: 'my-repo' });
    expect(result).toEqual({
      owner: 'org',
      repo: 'my-repo',
      branch: 'main',
      path: '',
      label: 'org/my-repo',
    });
  });

  it('preserves explicit values', () => {
    const result = normalizeRepoConfig({
      owner: 'org',
      repo: 'my-repo',
      branch: 'develop',
      path: '/src/assets',
      label: 'My Assets',
    });
    expect(result).toEqual({
      owner: 'org',
      repo: 'my-repo',
      branch: 'develop',
      path: 'src/assets',
      label: 'My Assets',
    });
  });

  it('strips leading/trailing slashes from path', () => {
    const result = normalizeRepoConfig({
      owner: 'org',
      repo: 'r',
      path: '/agents/',
    });
    expect(result.path).toBe('agents');
  });

  it('trims whitespace from owner, repo, branch, label', () => {
    const result = normalizeRepoConfig({
      owner: '  org  ',
      repo: '  my-repo  ',
      branch: '  main  ',
      label: '  My Label  ',
    });
    expect(result.owner).toBe('org');
    expect(result.repo).toBe('my-repo');
    expect(result.branch).toBe('main');
    expect(result.label).toBe('My Label');
  });

  it('throws if owner is missing', () => {
    expect(() => normalizeRepoConfig({ owner: '', repo: 'r' })).toThrow('owner');
  });

  it('throws if repo is missing', () => {
    expect(() => normalizeRepoConfig({ owner: 'o', repo: '' })).toThrow('name');
  });
});

describe('repoId', () => {
  it('returns owner/repo', () => {
    expect(
      repoId({ owner: 'org', repo: 'my-repo', branch: 'main', path: '', label: '' })
    ).toBe('org/my-repo');
  });
});
