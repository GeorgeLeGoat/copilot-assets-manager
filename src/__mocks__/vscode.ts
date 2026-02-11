import { vi } from 'vitest';

// In-memory file system for testing
const fileSystem = new Map<string, Uint8Array>();

export function _resetMockFs(): void {
  fileSystem.clear();
}

export function _setMockFile(path: string, content: string | Uint8Array): void {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  fileSystem.set(path, data);
}

export function _getMockFile(path: string): Uint8Array | undefined {
  return fileSystem.get(path);
}

// Mock classes
export class Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  private constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    try {
      const url = new URL(value);
      return new Uri(url.protocol.replace(':', ''), url.host, url.pathname, url.search, url.hash);
    } catch {
      return new Uri('file', '', value, '', '');
    }
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
  }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }
}

export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: ThemeColor) {}
  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;
  description?: string;
  tooltip?: string;
  collapsibleState?: TreeItemCollapsibleState;
  command?: { command: string; title: string; arguments?: unknown[] };

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void): { dispose: () => void } => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx >= 0) { this.listeners.splice(idx, 1); }
      },
    };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

// Workspace configuration mock
const configStore: Record<string, unknown> = {
  'copilotAssetsManager.repositories': [],
  'copilotAssetsManager.githubEnterpriseUrl': '',
  'copilotAssetsManager.fileExtensions': ['.md', '.json', '.yml', '.yaml', '.prompt'],
  'copilotAssetsManager.destinationMappings': { default: '.github', rules: [] },
  'copilotAssetsManager.checkOnStartup': true,
  'copilotAssetsManager.maxDepth': 3,
  'copilotAssetsManager.excludePatterns': [],
};

export function _setConfig(key: string, value: unknown): void {
  configStore[key] = value;
}

const workspace = {
  getConfiguration: vi.fn((section?: string) => ({
    get: vi.fn(<T>(key: string, defaultValue?: T): T => {
      const fullKey = section ? `${section}.${key}` : key;
      const val = configStore[fullKey];
      return (val !== undefined ? val : defaultValue) as T;
    }),
    has: vi.fn((key: string) => {
      const fullKey = section ? `${section}.${key}` : key;
      return fullKey in configStore;
    }),
    update: vi.fn(),
    inspect: vi.fn(),
  })),
  workspaceFolders: [
    { uri: Uri.file('/workspace'), name: 'workspace', index: 0 },
  ],
  fs: {
    readFile: vi.fn(async (uri: Uri): Promise<Uint8Array> => {
      const content = fileSystem.get(uri.path) ?? fileSystem.get(uri.fsPath);
      if (content) {
        return content;
      }
      throw new Error(`File not found: ${uri.path}`);
    }),
    writeFile: vi.fn(async (uri: Uri, content: Uint8Array): Promise<void> => {
      fileSystem.set(uri.path, content);
    }),
    stat: vi.fn(async (uri: Uri): Promise<{ type: number; size: number }> => {
      const content = fileSystem.get(uri.path) ?? fileSystem.get(uri.fsPath);
      if (content) {
        return { type: 1, size: content.length };
      }
      throw new Error(`File not found: ${uri.path}`);
    }),
    delete: vi.fn(async (uri: Uri): Promise<void> => {
      fileSystem.delete(uri.path);
    }),
  },
  onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
};

const windowModule = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  createTreeView: vi.fn(() => ({
    dispose: vi.fn(),
  })),
};

const authentication = {
  getSession: vi.fn(async () => ({
    accessToken: 'mock-token',
    id: 'mock-session',
    scopes: ['repo'],
    account: { id: 'mock-user', label: 'Mock User' },
  })),
  onDidChangeSessions: vi.fn(() => ({ dispose: vi.fn() })),
};

const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

const env = {
  openExternal: vi.fn(),
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export { workspace, authentication, commands, env };
export const window = windowModule;
