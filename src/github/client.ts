import { getApiBaseUrl } from '../config/settings';
import { getGitHubToken } from './auth';
import {
  GitHubContentItem,
  GitHubFileContent,
  GitHubTreeResponse,
  RateLimitInfo,
} from './types';

export class GitHubApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimit?: RateLimitInfo
  ) {
    super(message);
    this.name = 'GitHubApiRequestError';
  }
}

function parseRateLimit(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get('x-ratelimit-limit');
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = headers.get('x-ratelimit-reset');

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }
  return undefined;
}

export class GitHubClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  updateBaseUrl(): void {
    this.baseUrl = getApiBaseUrl();
  }

  private async request<T>(path: string): Promise<T> {
    const token = await getGitHubToken();
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'copilot-assets-manager',
      },
    });

    const rateLimit = parseRateLimit(response.headers);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      let message: string;

      switch (response.status) {
        case 401:
          message = 'Authentication failed. Please re-authenticate with GitHub.';
          break;
        case 403:
          if (rateLimit && rateLimit.remaining === 0) {
            const resetDate = new Date(rateLimit.reset * 1000);
            message = `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}.`;
          } else {
            message = 'Access forbidden. Check your token permissions.';
          }
          break;
        case 404:
          message = `Repository or path not found: ${path}`;
          break;
        default:
          message = `GitHub API error (${response.status}): ${body}`;
      }

      throw new GitHubApiRequestError(message, response.status, rateLimit);
    }

    return (await response.json()) as T;
  }

  async listContents(
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<GitHubContentItem[]> {
    const encodedPath = path
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    return this.request<GitHubContentItem[]>(endpoint);
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<GitHubFileContent> {
    const encodedPath = path
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    return this.request<GitHubFileContent>(endpoint);
  }

  async getTree(
    owner: string,
    repo: string,
    branch: string
  ): Promise<GitHubTreeResponse> {
    const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    return this.request<GitHubTreeResponse>(endpoint);
  }
}
