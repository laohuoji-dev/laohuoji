import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Save, RefreshCw, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { getTauriErrorMessage } from '../utils/tauriError';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { cn } from '../lib/utils';

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  barcode: string | null;
  status: string;
  min_stock: number;
}

interface CheckItem {
  key: string;
  product_id?: number;
  product?: Product;
  actual_stock?: number;
}

const InventoryCheck = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadProducts();
    handleAddRow(); // 初始添加一行
  }, []);

  const loadProducts = async () => {
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载商品列表失败');
    }
  };

  const handleAddRow = () => {
    setItems(prev => [...prev, { key: Date.now().toString() + Math.random().toString() }]);
  };

  const handleRemoveRow = (key: string) => {
    setItems(prev => prev.filter(item => item.key !== key));
  };

  const handleItemChange = (key: string, field: keyof CheckItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.key === key) {
        const newItem = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          newItem.product = product;
          newItem.actual_stock = product?.stock;
        }
        return newItem;
      }
      return item;
    }));
  };

  const handleBatchUpdate = async () => {
    const validItems = items.filter(item => item.product_id && item.actual_stock !== undefined);
    
    if (validItems.length === 0) {
      toast.warning('没有有效的盘点数据');
      return;
    }

    const productIds = validItems.map(i => i.product_id);
    if (new Set(productIds).size !== productIds.length) {
      toast.error('列表中存在重复的商品，请合并后再提交');
      return;
    }

    const changedItems = validItems.filter(item => item.actual_stock !== item.product?.stock);
    
    if (changedItems.length === 0) {
      toast.success('所有实盘数量与系统账面一致，无需更新');
      setItems([{ key: Date.now().toString() }]);
      return;
    }

    const payload = changedItems.map(item => ({
      product_id: item.product_id,
      actual_stock: item.actual_stock,
      reason: '库存盘点',
    }));

    setSubmitting(true);
    try {
      const count = await invoke<number>('batch_update_stock', { adjustments: payload });
      toast.success(`成功更新 ${count} 种商品的库存`);
      
      await loadProducts();
      setItems([{ key: Date.now().toString() }]);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '盘点提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">库存盘点</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadProducts}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新数据
          </Button>
          <Button onClick={handleBatchUpdate} disabled={submitting}>
            <Save className="mr-2 h-4 w-4" />
            提交盘点
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">商品</TableHead>
                <TableHead className="w-[120px]">账面库存</TableHead>
                <TableHead className="w-[150px]">实盘数量</TableHead>
                <TableHead className="w-[80px]">单位</TableHead>
                <TableHead className="w-[120px]">盈亏差异</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((record) => {
                const diff = record.product && record.actual_stock !== undefined
                  ? record.actual_stock - record.product.stock
                  : null;

                return (
                  <TableRow key={record.key}>
                    <TableCell>
                      <Popover
                        open={openCombobox[record.key]}
                        onOpenChange={(open) => setOpenCombobox(prev => ({ ...prev, [record.key]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between font-normal",
                              !record.product_id && "text-muted-foreground"
                            )}
                          >
                            {record.product_id
                              ? (() => {
                                  const p = products.find((p) => p.id === record.product_id);
                                  return p ? `${p.name} ${p.barcode ? `(${p.barcode})` : ''}` : "请选择商品";
                                })()
                              : "请选择商品"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command filter={(value, search) => {
                            const p = products.find(p => p.id.toString() === value);
                            if (!p) return 0;
                            const s = search.toLowerCase();
                            if (p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.toLowerCase().includes(s))) {
                              return 1;
                            }
                            return 0;
                          }}>
                            <CommandInput placeholder="搜索商品名称/条码..." />
                            <CommandList>
                              <CommandEmpty>未找到商品</CommandEmpty>
                              <CommandGroup>
                                {products.map((p) => {
                                  const disabled = items.some(i => i.key !== record.key && i.product_id === p.id);
                                  return (
                                    <CommandItem
                                      key={p.id}
                                      value={p.id.toString()}
                                      disabled={disabled}
                                      onSelect={(currentValue) => {
                                        handleItemChange(record.key, 'product_id', parseInt(currentValue));
                                        setOpenCombobox(prev => ({ ...prev, [record.key]: false }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          record.product_id === p.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{p.name} {p.status === 'INACTIVE' ? <span className="text-destructive text-xs">[停售]</span> : ''}</span>
                                        {p.barcode && <span className="text-xs text-muted-foreground">{p.barcode}</span>}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {record.product?.stock ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={record.actual_stock ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          handleItemChange(record.key, 'actual_stock', val);
                        }}
                        disabled={!record.product_id}
                        className="w-full"
                      />
                    </TableCell>
                    <TableCell>
                      {record.product?.unit ?? '-'}
                    </TableCell>
                    <TableCell>
                      {!record.product || record.actual_stock === undefined ? '-' : (
                        diff! > 0 ? <Badge variant="default" className="bg-green-500 hover:bg-green-600">盘盈 +{diff}</Badge> :
                        diff! < 0 ? <Badge variant="destructive">盘亏 {diff}</Badge> :
                        <Badge variant="secondary">正常</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveRow(record.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddRow}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加盘点行
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryCheck;