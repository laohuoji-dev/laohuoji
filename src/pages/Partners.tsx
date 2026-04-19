import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Edit, Trash2, Users, Store, BadgeDollarSign, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { getTauriErrorMessage } from '../utils/tauriError';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

interface Partner {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  balance: number;
  created_at: string;
}

interface FinancialLog {
  id: number;
  associated_order_id: number | null;
  change_amount: number;
  after_balance: number;
  remark: string | null;
  created_at: string;
}

const partnerFormSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  contact: z.string().optional(),
  phone: z.string().optional(),
});

const paymentFormSchema = z.object({
  amount: z.number().min(0.01, '金额必须大于0'),
  remark: z.string().optional(),
});

const Partners = () => {
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerType, setPartnerType] = useState<'customer' | 'supplier'>('customer');

  const partnerForm = useForm<z.infer<typeof partnerFormSchema>>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', contact: '', phone: '' }
  });

  // Payment State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentPartner, setPaymentPartner] = useState<Partner | null>(null);
  
  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { amount: 0, remark: '' }
  });

  // Logs State
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [financialLogs, setFinancialLogs] = useState<FinancialLog[]>([]);
  const [logsPartner, setLogsPartner] = useState<Partner | null>(null);

  // Pagination states
  const [customerPage, setCustomerPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const pageSize = 10;
  const logsPageSize = 15;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cus, sup] = await Promise.all([
        invoke<Partner[]>('get_customers'),
        invoke<Partner[]>('get_suppliers'),
      ]);
      setCustomers(cus);
      setSuppliers(sup);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载往来单位失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (type: 'customer' | 'supplier') => {
    setPartnerType(type);
    setEditingPartner(null);
    partnerForm.reset({ name: '', contact: '', phone: '' });
    setModalVisible(true);
  };

  const handleEdit = (record: Partner, type: 'customer' | 'supplier') => {
    setPartnerType(type);
    setEditingPartner(record);
    partnerForm.reset({
      name: record.name,
      contact: record.contact || '',
      phone: record.phone || '',
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number, type: 'customer' | 'supplier') => {
    try {
      if (type === 'customer') {
        await invoke('delete_customer', { id });
      } else {
        await invoke('delete_supplier', { id });
      }
      toast.success('删除成功');
      loadData();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '删除失败');
    }
  };

  const handlePartnerSubmit = async (values: z.infer<typeof partnerFormSchema>) => {
    try {
      if (editingPartner) {
        if (partnerType === 'customer') {
          await invoke('update_customer', { id: editingPartner.id, ...values });
        } else {
          await invoke('update_supplier', { id: editingPartner.id, ...values });
        }
        toast.success('更新成功');
      } else {
        if (partnerType === 'customer') {
          await invoke('add_customer', values);
        } else {
          await invoke('add_supplier', values);
        }
        toast.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '保存失败');
    }
  };

  const handlePaymentSubmit = async (values: z.infer<typeof paymentFormSchema>) => {
    if (!paymentPartner) return;
    try {
      await invoke('add_payment', {
        partnerType: partnerType === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        partnerName: paymentPartner.name,
        amount: values.amount,
        remark: values.remark || '手动结款',
      });
      toast.success('结款成功');
      setPaymentModalVisible(false);
      loadData();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '结款失败');
    }
  };

  const showLogs = async (record: Partner, type: 'customer' | 'supplier') => {
    setLogsPartner(record);
    setPartnerType(type);
    setLogsPage(1);
    try {
      const logs = await invoke<FinancialLog[]>('get_financial_logs', {
        partnerType: type === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        partnerName: record.name,
      });
      setFinancialLogs(logs);
      setLogsDrawerVisible(true);
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载流水失败');
    }
  };

  const renderTable = (type: 'customer' | 'supplier', data: Partner[], page: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(data.length / pageSize);
    const currentData = data.slice((page - 1) * pageSize, page * pageSize);

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => handleAdd(type)}>
            <Plus className="mr-2 h-4 w-4" />
            添加{type === 'customer' ? '客户' : '供应商'}
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">ID</TableHead>
                <TableHead className="w-[200px]">{type === 'customer' ? '客户名称' : '供应商名称'}</TableHead>
                <TableHead className="w-[150px]">联系人</TableHead>
                <TableHead className="w-[150px]">联系电话</TableHead>
                <TableHead className="w-[120px]">{type === 'customer' ? '应收款' : '应付款'}</TableHead>
                <TableHead className="w-[300px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">加载中...</TableCell>
                </TableRow>
              ) : currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">暂无数据</TableCell>
                </TableRow>
              ) : (
                currentData.map((record) => {
                  const isDebt = record.balance > 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>{record.id}</TableCell>
                      <TableCell>{record.name}</TableCell>
                      <TableCell>{record.contact || '-'}</TableCell>
                      <TableCell>{record.phone || '-'}</TableCell>
                      <TableCell>
                        <span className={cn("font-bold", isDebt ? "text-red-500" : "text-green-600")}>
                          ¥{record.balance.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setPaymentPartner(record);
                            setPartnerType(type);
                            paymentForm.reset({ amount: 0, remark: '' });
                            setPaymentModalVisible(true);
                          }}>
                            <BadgeDollarSign className="mr-1 h-4 w-4" />结款
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => showLogs(record, type)}>
                            <History className="mr-1 h-4 w-4" />流水
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(record, type)}>
                            <Edit className="mr-1 h-4 w-4" />编辑
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="mr-1 h-4 w-4" />删除
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除这个单位吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(record.id, type)} className="bg-destructive hover:bg-destructive/90">
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end space-x-2">
            <div className="text-sm text-muted-foreground">
              第 {page} 页，共 {totalPages} 页
            </div>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                下一页 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">往来单位管理</h2>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            客户管理
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            供应商管理
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          {renderTable('customer', customers, customerPage, setCustomerPage)}
        </TabsContent>
        <TabsContent value="suppliers">
          {renderTable('supplier', suppliers, supplierPage, setSupplierPage)}
        </TabsContent>
      </Tabs>

      {/* Partner Modal */}
      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? `编辑${partnerType === 'customer' ? '客户' : '供应商'}` : `添加${partnerType === 'customer' ? '客户' : '供应商'}`}
            </DialogTitle>
          </DialogHeader>
          <Form {...partnerForm}>
            <form onSubmit={partnerForm.handleSubmit(handlePartnerSubmit)} className="space-y-4">
              <FormField
                control={partnerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input placeholder="必填，如公司名或个人姓名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={partnerForm.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系人</FormLabel>
                    <FormControl>
                      <Input placeholder="选填" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={partnerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系电话</FormLabel>
                    <FormControl>
                      <Input placeholder="选填" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setModalVisible(false)}>取消</Button>
                <Button type="submit">保存</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModalVisible} onOpenChange={setPaymentModalVisible}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {partnerType === 'customer' ? '客户结款 (收款)' : '供应商结款 (付款)'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">往来单位：</span>
              <span className="font-semibold">{paymentPartner?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">当前欠款：</span>
              <span className="font-bold text-red-500">¥{paymentPartner?.balance.toFixed(2)}</span>
            </div>
          </div>

          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结款金额</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0.01" 
                        placeholder="请输入本次结款金额" 
                        {...field} 
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="remark"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Input placeholder="选填，如：银行转账、微信支付" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setPaymentModalVisible(false)}>取消</Button>
                <Button type="submit">确认结款</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Financial Logs Drawer */}
      <Sheet open={logsDrawerVisible} onOpenChange={setLogsDrawerVisible}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{logsPartner?.name} - 账款流水</SheetTitle>
          </SheetHeader>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">时间</TableHead>
                  <TableHead className="w-[120px]">事项</TableHead>
                  <TableHead className="w-[120px] text-right">变动金额</TableHead>
                  <TableHead className="w-[120px] text-right">变动后欠款</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">暂无数据</TableCell>
                  </TableRow>
                ) : (
                  financialLogs.slice((logsPage - 1) * logsPageSize, logsPage * logsPageSize).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{log.created_at}</TableCell>
                      <TableCell>{log.remark || '-'}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-medium", log.change_amount > 0 ? "text-red-500" : "text-green-600")}>
                          {log.change_amount > 0 ? '+' : ''}{log.change_amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">¥{log.after_balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {Math.ceil(financialLogs.length / logsPageSize) > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {logsPage} 页，共 {Math.ceil(financialLogs.length / logsPageSize)} 页
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => setLogsPage(Math.max(1, logsPage - 1))} disabled={logsPage === 1}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLogsPage(Math.min(Math.ceil(financialLogs.length / logsPageSize), logsPage + 1))} disabled={logsPage === Math.ceil(financialLogs.length / logsPageSize)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Partners;