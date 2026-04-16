import { invoke } from '@tauri-apps/api/core';

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export interface Unit {
  id: number;
  name: string;
  created_at: string;
}

export const getLowStockThreshold = async (): Promise<number> => {
  try {
    return await invoke<number>('get_low_stock_threshold');
  } catch (error) {
    console.error('获取预警阈值失败:', error);
    return 10; // 默认值
  }
};

export const setLowStockThreshold = async (threshold: number): Promise<void> => {
  await invoke('set_low_stock_threshold', { threshold });
};

// 分类管理 API
export const getCategories = async (): Promise<Category[]> => {
  return await invoke<Category[]>('get_categories');
};

export const addCategory = async (name: string): Promise<number> => {
  return await invoke<number>('add_category', { name });
};

export const deleteCategory = async (id: number): Promise<void> => {
  await invoke('delete_category', { id });
};

// 单位管理 API
export const getUnits = async (): Promise<Unit[]> => {
  return await invoke<Unit[]>('get_units');
};

export const addUnit = async (name: string): Promise<number> => {
  return await invoke<number>('add_unit', { name });
};

export const deleteUnit = async (id: number): Promise<void> => {
  await invoke('delete_unit', { id });
};

