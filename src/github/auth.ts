import * as vscode from 'vscode';
import { isGitHubEnterprise } from '../config/settings';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Ensures that github-enterprise.uri is set in VS Code settings,
 * copying the value from copilotAssetsManager.githubEnterpriseUrl if needed.
 * The github-enterprise auth provider requires this setting to be present.
 */
async function ensureGitHubEnterpriseUri(): Promise<void> {
  const gheUrl = vscode.workspace
    .getConfiguration('copilotAssetsManager')
    .get<string>('githubEnterpriseUrl', '')
    .trim();

  if (!gheUrl) {
    return;
  }

  const gheConfig = vscode.workspace.getConfiguration('github-enterprise');
  const existingUri = gheConfig.get<string>('uri', '').trim();

  if (!existingUri) {
    // Auto-populate github-enterprise.uri from our setting
    await gheConfig.update('uri', gheUrl, vscode.ConfigurationTarget.Global);
    console.log(`[Auth] Set github-enterprise.uri to: ${gheUrl}`);
  }
}

export async function getGitHubToken(silent = false): Promise<string> {
  const usingEnterprise = isGitHubEnterprise();
  const providerId = usingEnterprise ? 'github-enterprise' : 'github';
  const scopes = ['repo'];

  if (usingEnterprise) {
    await ensureGitHubEnterpriseUri();
  }

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

    const message = error instanceof Error ? error.message : String(error);

    // Provide a more helpful message when github-enterprise.uri is missing
    if (message.includes('"github-enterprise.uri" not set')) {
      const gheUrl = vscode.workspace
        .getConfiguration('copilotAssetsManager')
        .get<string>('githubEnterpriseUrl', '')
        .trim();
      throw new AuthenticationError(
        `GitHub Enterprise authentication failed: please add the following to your VS Code settings:\n"github-enterprise.uri": "${gheUrl || 'https://github.yourcompany.com'}"`
      );
    }

    throw new AuthenticationError(
      `Failed to authenticate with GitHub: ${message}`
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
