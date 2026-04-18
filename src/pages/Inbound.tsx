import { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
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

import { getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold } from '../utils/settings';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShoppingCart, Download, RefreshCw, ChevronLeft, ChevronRight, Loader2, ArrowRight } from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  cost_price: number;
  barcode?: string;
  status: string;
}

interface InboundRecord {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  supplier: string;
  created_at: string;
}

const formSchema = z.object({
  product_id: z.coerce.number().min(1, '请选择商品'),
  quantity: z.coerce.number().min(1, '请输入有效的入库数量'),
  price: z.coerce.number().min(0, '请输入有效的单价'),
  supplier: z.string().optional(),
  paid_amount: z.coerce.number().min(0, '请输入有效的付款金额').default(0),
});

type FormValues = z.infer<typeof formSchema>;

const Inbound = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [records, setRecords] = useState<InboundRecord[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      product_id: 0,
      quantity: 1,
      price: 0,
      supplier: '',
      paid_amount: 0,
    },
  });

  useEffect(() => {
    loadProducts();
    loadSuppliers();
    loadRecords();
    loadLowStockThreshold();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await invoke<Supplier[]>('get_suppliers');
      setSuppliers(data);
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    }
  };

  const loadLowStockThreshold = async () => {
    try {
      const value = await getLowStockThreshold();
      setLowStockThreshold(value);
    } catch (error) {
      console.error(error);
    }
  };

  const loadProducts = async () => {
    
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data.filter(p => p.status === 'ACTIVE'));
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载商品列表失败');
      console.error(error);
    } finally {
      
    }
  };

  const loadRecords = async (start?: string, end?: string) => {
    try {
      const data = await invoke<InboundRecord[]>('get_inbound_records', {
        start_date: start || null,
        end_date: end || null,
      });
      setRecords(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadRecords(startDate, endDate);
    } else if (!startDate && !endDate) {
      loadRecords();
    }
  }, [startDate, endDate]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await invoke('add_inbound', {
        order: {
          product_id: values.product_id,
          quantity: values.quantity,
          price: values.price,
          supplier: values.supplier || '未填写',
          paid_amount: values.paid_amount || 0,
        },
      });
      toast.success('入库成功');
      form.reset({
        product_id: 0,
        quantity: 1,
        price: 0,
        supplier: '',
        paid_amount: 0,
      });
      loadProducts();
      loadRecords(startDate, endDate);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '入库失败');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProductId = form.watch('product_id');
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const quantity = form.watch('quantity');
  const price = form.watch('price');
  const totalAmount = (quantity || 0) * (price || 0);

  const exportToExcel = async () => {
    try {
      const filePath = await save({
        title: '导出入库记录',
        defaultPath: `入库记录_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (!filePath) return;

      const toastId = toast.loading('正在导出数据...');

      const exportData = records.map((r) => ({
        'ID': r.id,
        '商品': r.product_name,
        '数量': r.quantity,
        '单价': r.price,
        '总金额': r.total,
        '供应商': r.supplier,
        '时间': r.created_at,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      ws['!cols'] = [
        { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, '入库记录');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(excelBuffer));

      toast.dismiss(toastId);
      toast.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      toast.dismiss();
      toast.error('导出失败');
    }
  };

  // Setup Table
  const table = useReactTable({
    data: records,
    columns: useMemo(() => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'product_name', header: '商品' },
      { accessorKey: 'quantity', header: '数量' },
      { 
        accessorKey: 'price', 
        header: '单价',
        cell: (info: any) => `¥${info.getValue().toFixed(2)}`
      },
      { 
        accessorKey: 'total', 
        header: '总金额',
        cell: (info: any) => <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-mono">¥{info.getValue().toFixed(2)}</Badge>
      },
      { accessorKey: 'supplier', header: '供应商' },
      { accessorKey: 'created_at', header: '时间' },
    ], []),
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
        <h2 className="text-2xl font-bold tracking-tight">入库管理</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">新建入库单</CardTitle>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control as any}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>选择商品</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            field.onChange(val);
                            // Auto-fill price if selected
                            const p = products.find(prod => String(prod.id) === val);
                            if (p && !form.getValues('price')) {
                              form.setValue('price', p.cost_price);
                            }
                          }} 
                          value={field.value ? String(field.value) : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择商品" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name} (库存: {p.stock} {p.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedProduct && (
                    <div className={`p-3 rounded-md border text-sm ${
                      selectedProduct.stock < lowStockThreshold 
                        ? 'bg-red-50 border-red-200 text-red-800' 
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      当前库存: <strong>{selectedProduct.stock}</strong> {selectedProduct.unit}
                      {selectedProduct.stock < lowStockThreshold && (
                        <span className="ml-1">(低于阈值 {lowStockThreshold})</span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>入库数量</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type="number" min="1" {...field} />
                              {selectedProduct && (
                                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground pointer-events-none">
                                  {selectedProduct.unit}
                                </span>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control as any}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>单价</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground pointer-events-none">¥</span>
                              <Input type="number" step="0.01" min="0" className="pl-7" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control as any}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>供应商</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择供应商" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="未填写">未填写</SelectItem>
                            {suppliers.map(s => (
                              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="paid_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>本次实付</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground pointer-events-none">¥</span>
                              <Input type="number" step="0.01" min="0" className="pl-7" placeholder="赊账留空或填0" {...field} />
                            </div>
                          </FormControl>
                          <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => form.setValue('paid_amount', totalAmount)}
                          >
                            全额
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {totalAmount > 0 && (
                    <div className="p-4 bg-slate-50 border rounded-md flex justify-between items-center">
                      <span className="text-slate-600 font-medium">总金额</span>
                      <span className="text-xl font-bold text-slate-900 font-mono">¥{totalAmount.toFixed(2)}</span>
                    </div>
                  )}

                </CardContent>
                <CardFooter className="flex gap-2 border-t pt-6">
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                    确认入库
                  </Button>
                  <Button type="button" variant="outline" onClick={() => form.reset()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>

        {/* Table Section */}
        <div className="lg:col-span-8">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
              <CardTitle className="text-lg">入库记录</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="w-36 h-9"
                  />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="w-36 h-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9">
                  <Download className="mr-2 h-4 w-4" /> 导出
                </Button>
              </div>
            </CardHeader>
            <div className="flex-1 border-t">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        暂无记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-end space-x-2 py-3 px-4 border-t mt-auto">
              <div className="flex-1 text-sm text-muted-foreground">
                共 {records.length} 条记录
              </div>
              <div className="space-x-2 flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  {table.getState().pagination.pageIndex + 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Inbound;
