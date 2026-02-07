export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
  html_url: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file';
  content: string;
  encoding: 'base64';
  html_url: string;
}

export interface GitHubTreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeNode[];
  truncated: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}
