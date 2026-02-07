import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient, GitHubApiRequestError } from './client';
import { _setConfig } from '../__mocks__/vscode';

describe('GitHubClient', () => {
  let client: GitHubClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', '');
    client = new GitHubClient();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('constructs correct URL for listContents', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.listContents('my-org', 'my-repo', 'agents', 'main');

    expect(capturedUrl).toBe(
      'https://api.github.com/repos/my-org/my-repo/contents/agents?ref=main'
    );
  });

  it('constructs correct URL for getTree', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify({ sha: 'x', url: '', tree: [], truncated: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.getTree('my-org', 'my-repo', 'main');

    expect(capturedUrl).toBe(
      'https://api.github.com/repos/my-org/my-repo/git/trees/main?recursive=1'
    );
  });

  it('includes auth header', async () => {
    let capturedHeaders: HeadersInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.listContents('org', 'repo', '', 'main');

    expect(capturedHeaders).toBeDefined();
    expect((capturedHeaders as Record<string, string>).Authorization).toBe('token mock-token');
  });

  it('throws GitHubApiRequestError on 404', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    await expect(client.listContents('org', 'repo', 'path', 'main')).rejects.toThrow(
      GitHubApiRequestError
    );
  });

  it('throws with rate limit info on 403', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Rate limit', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1700000000',
        },
      });
    });

    try {
      await client.listContents('org', 'repo', '', 'main');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GitHubApiRequestError);
      const err = e as GitHubApiRequestError;
      expect(err.status).toBe(403);
      expect(err.rateLimit?.remaining).toBe(0);
      expect(err.message).toContain('rate limit');
    }
  });

  it('uses GHE base URL when configured', async () => {
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', 'https://ghe.example.com');
    client.updateBaseUrl();

    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await client.listContents('org', 'repo', '', 'main');
    expect(capturedUrl).toContain('https://ghe.example.com/api/v3/repos/');

    // Reset
    _setConfig('copilotAssetsManager.githubEnterpriseUrl', '');
  });
});
