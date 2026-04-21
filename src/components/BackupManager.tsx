import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile, exists } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Backup, Download, Upload, RotateCcw, HardDrive, Loader2 } from 'lucide-react';

interface BackupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BackupManager = ({ open, onOpenChange }: BackupManagerProps) => {
  const [loading, setLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupDays, setBackupDays] = useState(7);
  const [lastBackupPath, setLastBackupPath] = useState<string>('');

  useState(() => {
    if (open) {
      loadBackupConfig();
    }
  });

  const loadBackupConfig = async () => {
    try {
      const config = await invoke<any>('get_auto_backup_config');
      setAutoBackupEnabled(config.enabled || false);
      setBackupDays(config.days || 7);
    } catch (error) {
      console.error('加载备份配置失败:', error);
    }
  };

  const handleBackup = async () => {
    try {
      const filePath = await save({
        title: '选择备份保存位置',
        defaultPath: `进销存备份_${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }],
      });

      if (!filePath) return;

      setLoading(true);
      await invoke('backup_database', { targetPath: filePath });
      setLastBackupPath(filePath);
      toast.success('备份成功！');
    } catch (error: any) {
      toast.error(error.message || '备份失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const filePath = await open({
        title: '选择要恢复的备份文件',
        filters: [{ name: 'Database', extensions: ['db'] }],
        multiple: false,
      });

      if (!filePath) return;

      // 确认恢复操作
      if (!confirm('⚠️ 警告：恢复操作将覆盖当前所有数据！\n\n确定要继续吗？建议先备份当前数据。')) {
        return;
      }

      setLoading(true);
      await invoke('restore_database', { sourcePath: filePath });
      toast.success('恢复成功！请重启应用以确保数据完全加载。');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || '恢复失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await invoke('set_auto_backup_config', {
        enabled: autoBackupEnabled,
        days: backupDays,
      });
      toast.success('备份配置已保存');
    } catch (error: any) {
      toast.error(error.message || '保存配置失败');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            数据备份与恢复
          </DialogTitle>
          <DialogDescription>
            定期备份数据以防丢失，必要时可从备份恢复
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 手动备份 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">手动备份</Label>
            <div className="flex gap-2">
              <Button
                onClick={handleBackup}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                立即备份
              </Button>
              <Button
                variant="outline"
                onClick={handleRestore}
                disabled={loading}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                从备份恢复
              </Button>
            </div>
            {lastBackupPath && (
              <p className="text-xs text-muted-foreground truncate">
                上次备份：{lastBackupPath}
              </p>
            )}
          </div>

          {/* 自动备份配置 */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold">自动备份设置</Label>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用自动备份</Label>
                <p className="text-xs text-muted-foreground">
                  系统将在启动时自动检查并备份
                </p>
              </div>
              <Switch
                checked={autoBackupEnabled}
                onCheckedChange={setAutoBackupEnabled}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>备份保留天数</Label>
                <Select
                  value={String(backupDays)}
                  onValueChange={(v) => setBackupDays(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 天</SelectItem>
                    <SelectItem value="14">14 天</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  超过此天数的备份将被自动清理
                </p>
              </div>
            </div>

            <Button onClick={handleSaveConfig} variant="secondary" size="sm">
              保存配置
            </Button>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md text-sm space-y-1">
            <p className="font-medium flex items-center gap-1">
              <RotateCcw className="h-4 w-4" />
              备份说明
            </p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
              <li>备份文件包含所有商品、出入库记录、客户供应商信息</li>
              <li>建议每周至少手动备份一次到外部存储设备</li>
              <li>恢复操作会完全覆盖当前数据，请谨慎操作</li>
              <li>备份文件为 SQLite 数据库格式，可用专业工具查看</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
