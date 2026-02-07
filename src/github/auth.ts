import * as vscode from 'vscode';
import { isGitHubEnterprise } from '../config/settings';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export async function getGitHubToken(silent = false): Promise<string> {
  const providerId = isGitHubEnterprise() ? 'github-enterprise' : 'github';
  const scopes = ['repo'];

  try {
    const session = await vscode.authentication.getSession(providerId, scopes, {
      createIfNone: !silent,
      silent,
    });

    if (!session) {
      throw new AuthenticationError(
        'GitHub authentication is required. Please sign in to access repositories.'
      );
    }

    return session.accessToken;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(
      `Failed to authenticate with GitHub: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function onAuthenticationChange(
  callback: (e: vscode.AuthenticationSessionsChangeEvent) => void
): vscode.Disposable {
  return vscode.authentication.onDidChangeSessions((e) => {
    if (e.provider.id === 'github' || e.provider.id === 'github-enterprise') {
      callback(e);
    }
  });
}
