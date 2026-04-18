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

import { getTauriAppError, getTauriErrorMessage } from '../utils/tauriError';
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
import { Send, Download, RefreshCw, ChevronLeft, ChevronRight, Loader2, ArrowRight, AlertTriangle, Info } from 'lucide-react';

interface Customer {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  unit: string;
  sell_price: number;
  stock: number;
  barcode?: string;
  status: string;
}

interface OutboundRecord {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  customer: string;
  created_at: string;
}

const formSchema = z.object({
  product_id: z.coerce.number().min(1, '请选择商品'),
  quantity: z.coerce.number().min(1, '请输入有效的出库数量'),
  price: z.coerce.number().min(0, '请输入有效的单价'),
  customer: z.string().optional(),
  paid_amount: z.coerce.number().min(0, '请输入有效的收款金额').default(0),
});

type FormValues = z.infer<typeof formSchema>;

const Outbound = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [records, setRecords] = useState<OutboundRecord[]>([]);
  
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
      customer: '',
      paid_amount: 0,
    },
  });

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadRecords();
    loadLowStockThreshold();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await invoke<Customer[]>('get_customers');
      setCustomers(data);
    } catch (error) {
      console.error('加载客户列表失败:', error);
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
      const data = await invoke<OutboundRecord[]>('get_outbound_records', {
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
      await invoke('add_outbound', {
        order: {
          product_id: values.product_id,
          quantity: values.quantity,
          price: values.price,
          customer: values.customer || '未填写',
          paid_amount: values.paid_amount || 0,
        },
      });
      toast.success('出库成功');
      form.reset({
        product_id: 0,
        quantity: 1,
        price: 0,
        customer: '',
        paid_amount: 0,
      });
      loadProducts();
      loadRecords(startDate, endDate);
    } catch (error: any) {
      const appError = getTauriAppError(error);
      if (appError?.code === 'STOCK_INSUFFICIENT') {
        toast.error(appError.message);
      } else {
        toast.error(getTauriErrorMessage(error) || '出库失败');
      }
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

  useEffect(() => {
    if (selectedProduct && !form.formState.dirtyFields.price) {
      form.setValue('price', selectedProduct.sell_price);
    }
  }, [selectedProductId, selectedProduct, form]);

  const isStockInsufficient = selectedProduct && quantity && quantity > selectedProduct.stock;
  const isLowStock = selectedProduct ? selectedProduct.stock < lowStockThreshold : false;

  const exportToExcel = async () => {
    try {
      const filePath = await save({
        title: '导出出库记录',
        defaultPath: `出库记录_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        '客户': r.customer,
        '时间': r.created_at,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      ws['!cols'] = [
        { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, '出库记录');
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
        cell: (info: any) => <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 font-mono">¥{info.getValue().toFixed(2)}</Badge>
      },
      { accessorKey: 'customer', header: '客户' },
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
        <h2 className="text-2xl font-bold tracking-tight">出库管理</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">新建出库单</CardTitle>
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
                          onValueChange={(val) => field.onChange(val)} 
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
                    <div className={`p-3 rounded-md border text-sm flex items-start gap-2 ${
                      isLowStock 
                        ? 'bg-amber-50 border-amber-200 text-amber-800' 
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      {isLowStock ? <AlertTriangle className="h-4 w-4 mt-0.5" /> : <Info className="h-4 w-4 mt-0.5" />}
                      <div>
                        当前库存: <strong>{selectedProduct.stock}</strong> {selectedProduct.unit}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control as any}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>出库数量</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                min="1" 
                                max={selectedProduct?.stock} 
                                className={isStockInsufficient ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                {...field} 
                              />
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

                  {isStockInsufficient && (
                    <div className="p-3 rounded-md border text-sm bg-red-50 border-red-200 text-red-800 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <div>
                        <strong>库存不足</strong>，当前仅剩 {selectedProduct.stock} {selectedProduct.unit}
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control as any}
                    name="customer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>客户</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择客户" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="未填写">未填写</SelectItem>
                            {customers.map(c => (
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
                    name="paid_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>本次实收</FormLabel>
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
                  <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700" disabled={submitting || !!isStockInsufficient}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    确认出库
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
              <CardTitle className="text-lg">出库记录</CardTitle>
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

export default Outbound;
