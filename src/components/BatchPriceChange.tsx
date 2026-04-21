import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  category: string;
  sell_price: number;
  stock: number;
  status: string;
}

const formSchema = z.object({
  mode: z.enum(['category', 'manual']),
  category: z.string().optional(),
  priceMode: z.enum(['multiply', 'add', 'set']),
  priceValue: z.coerce.number().min(-10000, '请输入有效数值').max(10000, '请输入有效数值'),
  selectedIds: z.array(z.number()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface BatchPriceChangeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  products: Product[];
  categories: string[];
}

export const BatchPriceChange = ({
  open,
  onOpenChange,
  onSuccess,
  products,
  categories,
}: BatchPriceChangeProps) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      mode: 'category',
      category: '',
      priceMode: 'multiply',
      priceValue: 1,
      selectedIds: [],
    },
  });

  const watchMode = form.watch('mode');
  const watchCategory = form.watch('category');
  const watchPriceMode = form.watch('priceMode');
  const watchPriceValue = form.watch('priceValue');

  // 获取符合条件的商品
  const getTargetProducts = () => {
    if (watchMode === 'category') {
      if (!watchCategory) return [];
      return products.filter(
        (p) => p.category === watchCategory && p.status === 'ACTIVE'
      );
    } else {
      const selectedIds = form.getValues('selectedIds');
      return products.filter((p) => selectedIds.includes(p.id));
    }
  };

  // 计算新价格预览
  const calculateNewPrice = (oldPrice: number) => {
    switch (watchPriceMode) {
      case 'multiply':
        return oldPrice * watchPriceValue;
      case 'add':
        return oldPrice + watchPriceValue;
      case 'set':
        return watchPriceValue;
      default:
        return oldPrice;
    }
  };

  // 更新预览数据
  useEffect(() => {
    const targets = getTargetProducts();
    const preview = targets.map((p) => ({
      ...p,
      oldPrice: p.sell_price,
      newPrice: calculateNewPrice(p.sell_price),
      change: calculateNewPrice(p.sell_price) - p.sell_price,
    }));
    setPreviewData(preview);
  }, [watchMode, watchCategory, watchPriceMode, watchPriceValue]);

  const handlePreview = () => {
    const targets = getTargetProducts();
    if (targets.length === 0) {
      toast.warning('没有符合条件的商品');
      return;
    }
    setShowPreview(true);
  };

  const onSubmit = async (_values: FormValues) => {
    const targets = getTargetProducts();
    if (targets.length === 0) {
      toast.warning('没有符合条件的商品');
      return;
    }

    setLoading(true);
    try {
      const updates = targets.map((p) => ({
        id: p.id,
        newPrice: calculateNewPrice(p.sell_price),
      }));

      await invoke('batch_update_prices', { updates });
      toast.success(`成功更新 ${updates.length} 个商品价格`);
      onSuccess();
      onOpenChange(false);
      setShowPreview(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || '批量改价失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectProduct = (id: number) => {
    const current = form.getValues('selectedIds');
    const updated = current.includes(id)
      ? current.filter((i) => i !== id)
      : [...current, id];
    form.setValue('selectedIds', updated);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              批量改价
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择方式</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择筛选方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="category">按分类</SelectItem>
                        <SelectItem value="manual">手动勾选</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchMode === 'category' ? (
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>商品分类</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="border rounded-md max-h-40 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">选择</TableHead>
                        <TableHead>商品名称</TableHead>
                        <TableHead>当前价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products
                        .filter((p) => p.status === 'ACTIVE')
                        .map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Checkbox
                                checked={form
                                  .getValues('selectedIds')
                                  .includes(p.id)}
                                onCheckedChange={() => toggleSelectProduct(p.id)}
                              />
                            </TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>¥{p.sell_price.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priceMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>调整方式</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="multiply">
                            倍率 (× 系数)
                          </SelectItem>
                          <SelectItem value="add">增减 (± 金额)</SelectItem>
                          <SelectItem value="set">
                            直接设置 (覆盖原价)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priceValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchPriceMode === 'multiply'
                          ? '倍率系数'
                          : watchPriceMode === 'add'
                          ? '调整金额'
                          : '新价格'}
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  className="flex-1"
                >
                  预览影响
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认改价
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 预览对话框 */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>价格调整预览</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>原价</TableHead>
                  <TableHead>新价</TableHead>
                  <TableHead>变化</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>¥{item.oldPrice.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">
                      ¥{item.newPrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.change >= 0 ? 'default' : 'secondary'}
                        className={
                          item.change >= 0
                            ? 'bg-green-600'
                            : 'bg-red-600 hover:bg-red-700'
                        }
                      >
                        {item.change >= 0 ? '+' : ''}
                        {item.change.toFixed(2)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                form.handleSubmit(onSubmit as any)();
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              确认执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
