import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, Download, RefreshCw, Check, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

import { getTauriErrorMessage } from '../utils/tauriError';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
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
}

interface InventoryLog {
  id: number;
  product_id: number;
  product_name: string;
  change_type: string;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  reference_id: number | null;
  created_at: string;
}

const InventoryLogs = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [openProductCombo, setOpenProductCombo] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadProducts();
    loadLogs();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data.map((p) => ({ id: p.id, name: p.name })));
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载商品列表失败');
    }
  };

  const loadLogs = async (nextProductId?: number, startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const data = await invoke<InventoryLog[]>('get_inventory_logs', {
        product_id: nextProductId ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
      });
      setLogs(data);
      setCurrentPage(1);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载库存流水失败');
    } finally {
      setLoading(false);
    }
  };

  const changeTypeLabel = (t: string) => {
    switch (t) {
      case 'INBOUND':
        return <Badge className="bg-blue-500 hover:bg-blue-600">入库</Badge>;
      case 'OUTBOUND':
        return <Badge className="bg-orange-500 hover:bg-orange-600">出库</Badge>;
      case 'MANUAL_ADJUST':
        return <Badge className="bg-purple-500 hover:bg-purple-600">手动调整</Badge>;
      case 'CREATE':
        return <Badge className="bg-green-500 hover:bg-green-600">建档</Badge>;
      default:
        return <Badge variant="outline">{t}</Badge>;
    }
  };

  const exportLogs = () => {
    const rows = logs.map((l) => ({
      ID: l.id,
      商品: l.product_name,
      类型: l.change_type,
      变动: l.quantity,
      变动前: l.previous_stock,
      变动后: l.current_stock,
      关联单据: l.reference_id ?? '',
      时间: l.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存流水');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `库存流水_${today}.xlsx`);
    toast.success('已导出');
  };

  const onDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      loadLogs(productId, format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
    } else if (!range?.from && !range?.to) {
      loadLogs(productId);
    }
  };

  const onProductChange = (val: number | undefined) => {
    setProductId(val);
    if (dateRange?.from && dateRange?.to) {
      loadLogs(val, format(dateRange.from, 'yyyy-MM-dd'), format(dateRange.to, 'yyyy-MM-dd'));
    } else {
      loadLogs(val);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(logs.length / pageSize);
  const currentLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">库存流水</h2>
      
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Popover open={openProductCombo} onOpenChange={setOpenProductCombo}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openProductCombo}
                className="w-[240px] justify-between"
              >
                {productId
                  ? products.find((p) => p.id === productId)?.name
                  : "筛选商品（可选）"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0">
              <Command>
                <CommandInput placeholder="搜索商品..." />
                <CommandList>
                  <CommandEmpty>未找到商品</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        onProductChange(undefined);
                        setOpenProductCombo(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          productId === undefined ? "opacity-100" : "opacity-0"
                        )}
                      />
                      全部商品
                    </CommandItem>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.name}
                        onSelect={() => {
                          onProductChange(product.id);
                          setOpenProductCombo(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            productId === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {product.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "yyyy-MM-dd")} -{" "}
                      {format(dateRange.to, "yyyy-MM-dd")}
                    </>
                  ) : (
                    format(dateRange.from, "yyyy-MM-dd")
                  )
                ) : (
                  <span>选择日期范围</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={onDateChange}
                numberOfMonths={2}
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadLogs(productId, dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined, dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button onClick={exportLogs} disabled={!logs.length}>
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead className="w-[160px]">商品</TableHead>
              <TableHead className="w-[120px]">类型</TableHead>
              <TableHead className="w-[100px]">变动</TableHead>
              <TableHead className="w-[100px]">变动前</TableHead>
              <TableHead className="w-[100px]">变动后</TableHead>
              <TableHead className="w-[120px]">关联单据</TableHead>
              <TableHead className="w-[180px]">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  加载中...
                </TableCell>
              </TableRow>
            ) : currentLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              currentLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.id}</TableCell>
                  <TableCell>{log.product_name}</TableCell>
                  <TableCell>{changeTypeLabel(log.change_type)}</TableCell>
                  <TableCell>
                    <span className={cn("font-semibold", log.quantity >= 0 ? "text-green-600" : "text-red-600")}>
                      {log.quantity >= 0 ? `+${log.quantity}` : log.quantity}
                    </span>
                  </TableCell>
                  <TableCell>{log.previous_stock}</TableCell>
                  <TableCell>{log.current_stock}</TableCell>
                  <TableCell>{log.reference_id || '-'}</TableCell>
                  <TableCell>{log.created_at}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2">
          <div className="text-sm text-muted-foreground">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryLogs;

