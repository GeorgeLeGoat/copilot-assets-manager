import * as vscode from 'vscode';
import { ManifestAssetEntry } from './asset';

const MANIFEST_VERSION = '1.0';
const MANIFEST_FILENAME = '.copilot-assets.json';

export interface ManifestData {
  version: string;
  assets: Record<string, ManifestAssetEntry>;
}

export class ManifestManager {
  private data: ManifestData = { version: MANIFEST_VERSION, assets: {} };
  private loaded = false;

  constructor(private readonly workspaceRoot: vscode.Uri) {}

  private get manifestUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.workspaceRoot, MANIFEST_FILENAME);
  }

  async load(): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(this.manifestUri);
      const text = Buffer.from(content).toString('utf-8');
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.assets && typeof parsed.assets === 'object') {
        this.data = {
          version: parsed.version || MANIFEST_VERSION,
          assets: parsed.assets,
        };
      } else {
        // Corrupted manifest — reset
        this.data = { version: MANIFEST_VERSION, assets: {} };
      }
    } catch {
      // File doesn't exist or is unreadable — start fresh
      this.data = { version: MANIFEST_VERSION, assets: {} };
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    const content = JSON.stringify(this.data, null, 2) + '\n';
    await vscode.workspace.fs.writeFile(
      this.manifestUri,
      Buffer.from(content, 'utf-8')
    );
  }

  getEntry(localPath: string): ManifestAssetEntry | undefined {
    return this.data.assets[localPath];
  }

  setEntry(localPath: string, entry: ManifestAssetEntry): void {
    this.data.assets[localPath] = entry;
  }

  removeEntry(localPath: string): void {
    delete this.data.assets[localPath];
  }

  getAllEntries(): Record<string, ManifestAssetEntry> {
    return { ...this.data.assets };
  }

  hasEntry(localPath: string): boolean {
    return localPath in this.data.assets;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
