import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Download, Printer, RefreshCw, Calendar as CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

import { getTauriErrorMessage } from '../utils/tauriError';
import { getCompanyInfo, CompanyInfo } from '../utils/settings';

import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Calendar } from '../components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';

interface Partner {
  id: number;
  name: string;
}

interface CustomerItem {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  sales_total: number;
  cost_total: number;
  profit_total: number;
}

interface SupplierItem {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  purchase_total: number;
}

interface CustomerStatement {
  type: 'customer';
  name: string;
  start_date?: string;
  end_date?: string;
  summary: {
    sales_total: number;
    quantity_total: number;
    cost_total: number;
    profit_total: number;
    order_count: number;
    product_count: number;
  };
  items: CustomerItem[];
}

interface SupplierStatement {
  type: 'supplier';
  name: string;
  start_date?: string;
  end_date?: string;
  summary: {
    purchase_total: number;
    quantity_total: number;
    order_count: number;
    product_count: number;
  };
  items: SupplierItem[];
}

const Statements = () => {
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', phone: '', address: '' });

  const [tab, setTab] = useState<'customer' | 'supplier'>('customer');
  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  const [openPartnerCombo, setOpenPartnerCombo] = useState(false);

  const [customerStatement, setCustomerStatement] = useState<CustomerStatement | null>(null);
  const [supplierStatement, setSupplierStatement] = useState<SupplierStatement | null>(null);

  useEffect(() => {
    loadPartners();
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const info = await getCompanyInfo();
      setCompanyInfo(info);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPartners = async () => {
    try {
      const [cus, sup] = await Promise.all([
        invoke<Partner[]>('get_customers'),
        invoke<Partner[]>('get_suppliers'),
      ]);
      setCustomers(cus);
      setSuppliers(sup);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载往来单位失败');
    }
  };

  const query = async () => {
    setLoading(true);
    try {
      const start = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
      const end = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null;
      
      if (tab === 'customer') {
        const data = await invoke<CustomerStatement>('get_customer_statement', {
          customer: partnerName ?? null,
          start_date: start,
          end_date: end,
        });
        setCustomerStatement(data);
      } else {
        const data = await invoke<SupplierStatement>('get_supplier_statement', {
          supplier: partnerName ?? null,
          start_date: start,
          end_date: end,
        });
        setSupplierStatement(data);
      }
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      const filePath = await save({
        title: '导出对账单',
        defaultPath: `对账单_${tab === 'customer' ? '客户' : '供应商'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (!filePath) return;

      const data =
        tab === 'customer'
          ? (customerStatement?.items ?? []).map((i) => ({
              商品: i.product_name,
              单位: i.unit,
              数量: i.quantity,
              销售额: i.sales_total,
              成本: i.cost_total,
              利润: i.profit_total,
            }))
          : (supplierStatement?.items ?? []).map((i) => ({
              商品: i.product_name,
              单位: i.unit,
              数量: i.quantity,
              采购额: i.purchase_total,
            }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, '对账单');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(buf));
      toast.success('已导出');
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '导出失败');
    }
  };

  const printReport = () => {
    window.print();
  };

  const currentStatement = tab === 'customer' ? customerStatement : supplierStatement;
  const currentPartners = tab === 'customer' ? customers : suppliers;

  return (
    <div className="space-y-6 print:space-y-0 print:block">
      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-8">
        <h2 className="text-2xl font-bold text-center mb-2">
          {companyInfo.name || '对账单'}
        </h2>
        <div className="text-center text-muted-foreground mb-6">
          {tab === 'customer' ? '客户销售对账单' : '供应商采购对账单'}
        </div>
        
        <div className="flex justify-between mb-4 text-sm">
          <div>
            <span className="font-bold">{tab === 'customer' ? '客户名称：' : '供应商名称：'}</span>
            <span>{partnerName || '全部'}</span>
          </div>
          <div>
            <span className="font-bold">对账期间：</span>
            <span>
              {dateRange?.from ? `${format(dateRange.from, 'yyyy-MM-dd')} 至 ${dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}` : '全部'}
            </span>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight">对账与统计</h2>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4">
          <Tabs
            value={tab}
            onValueChange={(k) => {
              const next = k as 'customer' | 'supplier';
              setTab(next);
              setPartnerName(undefined);
              setDateRange(undefined);
              setCustomerStatement(null);
              setSupplierStatement(null);
            }}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="customer">客户对账</TabsTrigger>
              <TabsTrigger value="supplier">供应商对账</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-3">
            <Popover open={openPartnerCombo} onOpenChange={setOpenPartnerCombo}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openPartnerCombo}
                  className="w-[240px] justify-between"
                >
                  {partnerName || (tab === 'customer' ? '选择客户（可选）' : '选择供应商（可选）')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput placeholder="搜索名称..." />
                  <CommandList>
                    <CommandEmpty>未找到数据</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setPartnerName(undefined);
                          setOpenPartnerCombo(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            partnerName === undefined ? "opacity-100" : "opacity-0"
                          )}
                        />
                        全部
                      </CommandItem>
                      {currentPartners.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setPartnerName(p.name);
                            setOpenPartnerCombo(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              partnerName === p.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.name}
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
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={zhCN}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={query} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              查询
            </Button>
            
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={exportExcel} disabled={!currentStatement?.items?.length}>
                <Download className="mr-2 h-4 w-4" />
                导出
              </Button>
              <Button variant="outline" onClick={printReport} disabled={!currentStatement?.items?.length}>
                <Printer className="mr-2 h-4 w-4" />
                打印
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentStatement && (
        <Card className="print:border-none print:shadow-none">
          <CardContent className="p-4 print:p-0">
            <div className="flex flex-wrap gap-8 print:gap-12">
              {tab === 'customer' ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">销售额</p>
                    <p className="text-2xl font-bold">¥{customerStatement?.summary.sales_total.toFixed(2) ?? '0.00'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">成本</p>
                    <p className="text-2xl font-bold">¥{customerStatement?.summary.cost_total.toFixed(2) ?? '0.00'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">利润</p>
                    <p className={cn("text-2xl font-bold", (customerStatement?.summary.profit_total ?? 0) >= 0 ? "text-green-600" : "text-red-500")}>
                      ¥{customerStatement?.summary.profit_total.toFixed(2) ?? '0.00'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">单据数</p>
                    <p className="text-2xl font-bold">{customerStatement?.summary.order_count ?? 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">商品数</p>
                    <p className="text-2xl font-bold">{customerStatement?.summary.product_count ?? 0}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">采购额</p>
                    <p className="text-2xl font-bold">¥{supplierStatement?.summary.purchase_total.toFixed(2) ?? '0.00'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">单据数</p>
                    <p className="text-2xl font-bold">{supplierStatement?.summary.order_count ?? 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">商品数</p>
                    <p className="text-2xl font-bold">{supplierStatement?.summary.product_count ?? 0}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border print:border-black print:border-collapse">
        <Table className="print:w-full print:text-sm">
          <TableHeader className="print:border-b print:border-black">
            <TableRow>
              <TableHead className="w-[220px] print:border print:border-black print:p-2">商品</TableHead>
              <TableHead className="w-[80px] print:border print:border-black print:p-2">单位</TableHead>
              <TableHead className="w-[100px] print:border print:border-black print:p-2">数量</TableHead>
              {tab === 'customer' ? (
                <>
                  <TableHead className="w-[120px] print:border print:border-black print:p-2">销售额</TableHead>
                  <TableHead className="w-[120px] print:border print:border-black print:p-2">成本</TableHead>
                  <TableHead className="w-[120px] print:border print:border-black print:p-2">利润</TableHead>
                </>
              ) : (
                <TableHead className="w-[120px] print:border print:border-black print:p-2">采购额</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={tab === 'customer' ? 6 : 4} className="h-24 text-center">加载中...</TableCell>
              </TableRow>
            ) : !currentStatement?.items?.length ? (
              <TableRow>
                <TableCell colSpan={tab === 'customer' ? 6 : 4} className="h-24 text-center">暂无数据</TableCell>
              </TableRow>
            ) : (
              (currentStatement.items as any[]).map((item, i) => (
                <TableRow key={item.product_id || i}>
                  <TableCell className="print:border print:border-black print:p-2">{item.product_name}</TableCell>
                  <TableCell className="print:border print:border-black print:p-2">{item.unit}</TableCell>
                  <TableCell className="print:border print:border-black print:p-2">{item.quantity}</TableCell>
                  {tab === 'customer' ? (
                    <>
                      <TableCell className="print:border print:border-black print:p-2 font-medium">¥{(item as CustomerItem).sales_total.toFixed(2)}</TableCell>
                      <TableCell className="print:border print:border-black print:p-2">¥{(item as CustomerItem).cost_total.toFixed(2)}</TableCell>
                      <TableCell className="print:border print:border-black print:p-2 font-medium text-green-600">¥{(item as CustomerItem).profit_total.toFixed(2)}</TableCell>
                    </>
                  ) : (
                    <TableCell className="print:border print:border-black print:p-2 font-medium">¥{(item as SupplierItem).purchase_total.toFixed(2)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Print Footer - Only visible when printing */}
      <div className="hidden print:block mt-10">
        <div className="grid grid-cols-3 gap-6 mb-4 text-sm">
          <div>
            <span className="font-bold">制单人：</span>
            <div className="inline-block border-b border-black w-32 align-bottom ml-1"></div>
          </div>
          <div>
            <span className="font-bold">{tab === 'customer' ? '客户确认签字/盖章：' : '供应商确认签字/盖章：'}</span>
            <div className="inline-block border-b border-black w-32 align-bottom ml-1"></div>
          </div>
          <div>
            <span className="font-bold">打印日期：</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
        
        {(companyInfo.phone || companyInfo.address) && (
          <>
            <Separator className="my-4 border-black" />
            <div className="text-center text-xs text-muted-foreground">
              {companyInfo.phone && <span className="mr-4">电话：{companyInfo.phone}</span>}
              {companyInfo.address && <span>地址：{companyInfo.address}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Statements;
