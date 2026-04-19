import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DollarSign, ShoppingCart, TrendingUp, FileText, Download, Loader2, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

import { getTauriErrorMessage } from '../utils/tauriError';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';

interface ReportData {
  sales: number;
  purchase: number;
  profit: number;
  new_products: number;
  inbound_count: number;
  outbound_count: number;
}

interface WeeklyReport {
  current: ReportData;
  previous: ReportData;
}

const calcChange = (current: number, previous: number): string => {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
};

const Report = () => {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await invoke<WeeklyReport>('get_weekly_report');
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
      toast.error(getTauriErrorMessage(error) || '加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const c = report.current;
    const p = report.previous;
    const text = [
      '===== 经营周报 =====',
      `生成时间: ${new Date().toLocaleString()}`,
      '',
      '--- 本周数据 ---',
      `销售额: ¥${c.sales.toFixed(2)} (上周: ¥${p.sales.toFixed(2)}, ${calcChange(c.sales, p.sales)})`,
      `采购额: ¥${c.purchase.toFixed(2)} (上周: ¥${p.purchase.toFixed(2)}, ${calcChange(c.purchase, p.purchase)})`,
      `利润: ¥${c.profit.toFixed(2)} (上周: ¥${p.profit.toFixed(2)}, ${calcChange(c.profit, p.profit)})`,
      `新增商品: ${c.new_products} 个`,
      `入库单数: ${c.inbound_count} 单`,
      `出库单数: ${c.outbound_count} 单`,
      '',
      '--- 同比分析 ---',
      `销售额变化: ${calcChange(c.sales, p.sales)}`,
      `采购额变化: ${calcChange(c.purchase, p.purchase)}`,
      `利润变化: ${calcChange(c.profit, p.profit)}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `经营周报_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('报告已导出');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        暂无数据
      </div>
    );
  }

  const c = report.current;
  const p = report.previous;

  const renderTrend = (change: string) => {
    const isPositive = change.startsWith('+');
    const isZero = change === '0%';
    
    if (isZero) return <span className="text-muted-foreground ml-2">({change})</span>;
    
    return (
      <span className={cn("ml-2 flex items-center text-xs", isPositive ? "text-green-600" : "text-red-500")}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {change}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">经营周报</h2>
        <Button onClick={exportReport}>
          <Download className="mr-2 h-4 w-4" />
          导出报告
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周销售额</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">¥{c.sales.toFixed(2)}</div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-muted-foreground">上周: ¥{p.sales.toFixed(2)}</p>
              {renderTrend(calcChange(c.sales, p.sales))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周采购额</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{c.purchase.toFixed(2)}</div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-muted-foreground">上周: ¥{p.purchase.toFixed(2)}</p>
              {renderTrend(calcChange(c.purchase, p.purchase))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周利润</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", c.profit >= 0 ? "text-green-600" : "text-red-500")}>
              ¥{c.profit.toFixed(2)}
            </div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-muted-foreground">上周: ¥{p.profit.toFixed(2)}</p>
              {renderTrend(calcChange(c.profit, p.profit))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">新增商品</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.new_products} <span className="text-sm font-normal text-muted-foreground">个</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">入库单数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.inbound_count} <span className="text-sm font-normal text-muted-foreground">单</span></div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-muted-foreground">上周: {p.inbound_count} 单</p>
              {renderTrend(calcChange(c.inbound_count, p.inbound_count))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">出库单数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.outbound_count} <span className="text-sm font-normal text-muted-foreground">单</span></div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-muted-foreground">上周: {p.outbound_count} 单</p>
              {renderTrend(calcChange(c.outbound_count, p.outbound_count))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Report;
