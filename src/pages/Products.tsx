import { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { getFirstLetter, toPinyin } from '../utils/pinyin';
import { getTauriAppError, getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold, getCategories, getUnits, Category, Unit } from '../utils/settings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Plus, Search, Upload, Download, Edit, Trash2, HelpCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  barcode?: string;
  status: string;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

const formSchema = z.object({
  name: z.string().min(1, '请输入商品名称'),
  barcode: z.string().optional(),
  category: z.string().min(1, '请选择分类'),
  unit: z.string().min(1, '请选择单位'),
  cost_price: z.coerce.number().min(0, '请输入有效的成本价'),
  sell_price: z.coerce.number().min(0, '请输入有效的销售价'),
  stock: z.coerce.number().min(0, '请输入有效的初始库存'),
  min_stock: z.coerce.number().min(0, '请输入有效的安全库存').default(0),
  status: z.string().min(1, '请选择状态'),
});

type FormValues = z.infer<typeof formSchema>;

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      barcode: '',
      category: '',
      unit: '',
      cost_price: 0,
      sell_price: 0,
      stock: 0,
      min_stock: 0,
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    loadProducts();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [threshold, cats, uns] = await Promise.all([
        getLowStockThreshold(),
        getCategories(),
        getUnits()
      ]);
      setLowStockThreshold(threshold);
      setCategories(cats);
      setUnits(uns);
    } catch (error) {
      console.error('加载基础配置失败:', error);
    }
  };

  useEffect(() => {
    if (!searchText) {
      setFilteredProducts(products);
    } else {
      const searchLower = searchText.toLowerCase();
      const filtered = products.filter(p => {
        if (p.name.toLowerCase().includes(searchLower)) return true;
        if (p.barcode && p.barcode.toLowerCase().includes(searchLower)) return true;
        if (p.category && p.category.toLowerCase().includes(searchLower)) return true;
        if (getFirstLetter(p.name).includes(searchLower)) return true;
        if (p.category && getFirstLetter(p.category).includes(searchLower)) return true;
        if (toPinyin(p.name).includes(searchLower)) return true;
        if (p.category && toPinyin(p.category).includes(searchLower)) return true;
        return false;
      });
      setFilteredProducts(filtered);
    }
  }, [searchText, products]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载商品列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    form.reset({
      name: '',
      barcode: '',
      category: '',
      unit: '',
      cost_price: 0,
      sell_price: 0,
      stock: 0,
      min_stock: 0,
      status: 'ACTIVE',
    });
    setModalVisible(true);
  };

  const handleEdit = (record: Product) => {
    setEditingProduct(record);
    form.reset({
      name: record.name,
      barcode: record.barcode || '',
      category: record.category,
      unit: record.unit,
      cost_price: record.cost_price,
      sell_price: record.sell_price,
      stock: record.stock,
      min_stock: record.min_stock || 0,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_product', { id });
      toast.success('商品已删除');
      loadProducts();
    } catch (error: any) {
      const errObj = getTauriAppError(error);
      if (errObj && errObj.code === 'PRODUCT_HAS_HISTORY') {
        toast.error('无法删除：该商品存在历史流水，建议将其库存清零或修改状态为停售。');
      } else {
        toast.error(getTauriErrorMessage(error) || '删除商品失败');
      }
      console.error(error);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (editingProduct) {
        await invoke('update_product', {
          id: editingProduct.id,
          product: values,
        });
        toast.success('更新成功');
      } else {
        await invoke('add_product', { product: values });
        toast.success('添加成功');
      }
      setModalVisible(false);
      loadProducts();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || (editingProduct ? '更新失败' : '添加失败'));
      console.error(error);
    }
  };

  const exportToExcel = async () => {
    try {
      const filePath = await save({
        title: '导出商品列表',
        defaultPath: `商品列表_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (!filePath) return;

      const toastId = toast.loading('正在导出数据...');

      const exportData = filteredProducts.map((p) => ({
        '商品ID': p.id,
        '条码': p.barcode || '',
        '商品名称': p.name,
        '分类': p.category,
        '单位': p.unit,
        '成本价': p.cost_price,
        '销售价': p.sell_price,
        '当前库存': p.stock,
        '安全库存': p.min_stock,
        '状态': p.status === 'ACTIVE' ? '在售' : '停售',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
        { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, '商品列表');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(excelBuffer));

      toast.dismiss(toastId);
      toast.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      toast.dismiss();
      toast.error(getTauriErrorMessage(error) || '导出失败');
    }
  };

  const importFromExcel = async () => {
    try {
      const filePath = await open({
        title: '选择商品数据文件',
        filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        multiple: false,
      });

      if (!filePath) return;

      const toastId = toast.loading('正在解析并导入数据...');

      try {
        const fileData = await readFile(filePath as string);
        const wb = XLSX.read(fileData, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

        if (jsonData.length === 0) {
          toast.dismiss(toastId);
          toast.warning('导入文件为空或无有效数据');
          return;
        }

        const importPayload = jsonData.map(row => ({
          name: row['商品名称'] || row['name'] || '',
          barcode: String(row['条码'] || row['barcode'] || ''),
          category: row['分类'] || row['category'] || '',
          unit: row['单位'] || row['unit'] || '',
          cost_price: Number(row['成本价'] || row['cost_price'] || 0),
          sell_price: Number(row['销售价'] || row['sell_price'] || 0),
          stock: Number(row['当前库存'] || row['初始库存'] || row['stock'] || 0),
          min_stock: Number(row['安全库存'] || row['min_stock'] || 0),
          status: (row['状态'] === '停售' || row['status'] === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE',
        })).filter(p => p.name && p.unit);

        if (importPayload.length === 0) {
          toast.dismiss(toastId);
          toast.warning('没有找到有效的商品数据，请检查列名');
          return;
        }

        const successCount = await invoke<number>('import_products', { products: importPayload });

        toast.dismiss(toastId);
        toast.success(`成功导入 ${successCount} 条商品记录`);

        loadProducts();
        loadSettings();
      } catch (error) {
        toast.dismiss(toastId);
        console.error('导入处理失败:', error);
        toast.error(getTauriErrorMessage(error) || '导入失败，请检查文件格式');
      }
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  };

  // Setup Table
  const table = useReactTable({
    data: filteredProducts,
    columns: useMemo(() => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'barcode', header: '条码', cell: (info: any) => info.getValue() || '-' },
      { accessorKey: 'name', header: '商品名称' },
      { accessorKey: 'category', header: '分类', cell: (info: any) => info.getValue() || '-' },
      { accessorKey: 'unit', header: '单位' },
      { 
        accessorKey: 'cost_price', 
        header: '成本价',
        cell: (info: any) => `¥${info.getValue().toFixed(2)}`
      },
      { 
        accessorKey: 'sell_price', 
        header: '销售价',
        cell: (info: any) => `¥${info.getValue().toFixed(2)}`
      },
      { 
        accessorKey: 'status', 
        header: '状态',
        cell: (info: any) => {
          const val = info.getValue();
          return (
            <Badge variant={val === 'ACTIVE' ? 'default' : 'secondary'} className={val === 'ACTIVE' ? 'bg-green-600 hover:bg-green-700' : ''}>
              {val === 'ACTIVE' ? '在售' : '停售'}
            </Badge>
          );
        }
      },
      { 
        accessorKey: 'stock', 
        header: '库存',
        cell: (info: any) => {
          const record = info.row.original;
          const val = info.getValue();
          const threshold = (record.min_stock && record.min_stock > 0) ? record.min_stock : lowStockThreshold;
          const isLow = val < threshold;
          return (
            <span className={isLow ? 'text-red-600 font-bold' : 'text-green-600 font-medium'}>
              {val}
            </span>
          );
        }
      },
      {
        id: 'actions',
        header: '操作',
        cell: (info: any) => {
          const record = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(record)} className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                <Edit className="h-4 w-4 mr-1" /> 编辑
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4 mr-1" /> 删除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除这个商品吗？如果商品已有流水记录，可能无法直接删除。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(record.id)} className="bg-red-600 hover:bg-red-700">
                      确定删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        }
      }
    ], [lowStockThreshold]),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">商品管理</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索名称、条码、拼音..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9 w-[250px]"
            />
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" /> 添加商品
          </Button>
          <Button variant="outline" onClick={importFromExcel}>
            <Upload className="mr-2 h-4 w-4" /> 导入
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="mr-2 h-4 w-4" /> 导出
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-end space-x-2 py-4 px-4 border-t">
          <div className="flex-1 text-sm text-muted-foreground">
            共 {filteredProducts.length} 条记录
          </div>
          <div className="space-x-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              第 {table.getState().pagination.pageIndex + 1} 页
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? '编辑商品' : '添加商品'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control as any}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel>商品名称</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入商品名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel>商品条码</FormLabel>
                      <FormControl>
                        <Input placeholder="选填，如: 6901234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分类</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>单位</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择单位" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map(u => (
                            <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>成本价</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="sell_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>销售价</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>初始库存</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="min_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        安全库存
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger type="button" tabIndex={-1}>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>当库存低于此值时触发预警，填0则使用全局配置</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control as any}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel>状态</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">在售</SelectItem>
                          <SelectItem value="INACTIVE">停售 (归档)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setModalVisible(false)}>
                  取消
                </Button>
                <Button type="submit">确定</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
