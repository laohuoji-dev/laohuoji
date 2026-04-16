import { invoke } from '@tauri-apps/api/core';

export async function getLowStockThreshold(): Promise<number> {
  return invoke<number>('get_low_stock_threshold');
}

export async function setLowStockThreshold(threshold: number): Promise<void> {
  await invoke('set_low_stock_threshold', { threshold });
}

