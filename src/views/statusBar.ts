import * as vscode from 'vscode';
import { SyncService } from '../services/syncService';

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly syncService: SyncService) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'copilotAssetsManager.assetsView.focus';

    syncService.onDidSync(() => {
      this.update();
    });
  }

  update(): void {
    const count = this.syncService.getUpdateCount();

    if (count > 0) {
      this.item.text = `$(cloud-download) ${count} update${count !== 1 ? 's' : ''}`;
      this.item.tooltip = `${count} Copilot asset update${count !== 1 ? 's' : ''} available`;
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
