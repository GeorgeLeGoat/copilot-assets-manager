import { RepositoryConfig } from './repository';

export type AssetStatus = 'not-installed' | 'up-to-date' | 'update-available' | 'locally-modified';

export interface ManifestAssetEntry {
  source: {
    owner: string;
    repo: string;
    branch: string;
    path: string;
  };
  remoteSha: string;
  localContentHash: string;
  installedAt: string;
  updatedAt: string;
}

export interface Asset {
  remotePath: string;
  remoteSha: string;
  fileName: string;
  repoConfig: RepositoryConfig;
  localPath?: string;
  status: AssetStatus;
  isSkill?: boolean;
  skillFiles?: string[]; // Paths of all files in the skill directory
}

export type TreeNodeType = 'repository' | 'folder' | 'file' | 'skill' | 'error' | 'message';

export interface AssetTreeNode {
  type: TreeNodeType;
  label: string;
  remotePath: string;
  repoConfig?: RepositoryConfig;
  asset?: Asset;
  children?: AssetTreeNode[];
  errorMessage?: string;
}
