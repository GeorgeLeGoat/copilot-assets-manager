export interface RepositoryConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  label: string;
}

export interface RawRepositoryConfig {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  label?: string;
}

export function repoId(config: RepositoryConfig): string {
  return `${config.owner}/${config.repo}`;
}

export function normalizeRepoConfig(raw: RawRepositoryConfig): RepositoryConfig {
  if (!raw.owner || typeof raw.owner !== 'string') {
    throw new Error('Repository owner is required');
  }
  if (!raw.repo || typeof raw.repo !== 'string') {
    throw new Error('Repository name is required');
  }

  let path = raw.path ?? '/';
  // Normalize path: remove leading/trailing slashes
  path = path.replace(/^\/+/, '').replace(/\/+$/, '');

  return {
    owner: raw.owner.trim(),
    repo: raw.repo.trim(),
    branch: raw.branch?.trim() || 'main',
    path,
    label: raw.label?.trim() || `${raw.owner}/${raw.repo}`,
  };
}
