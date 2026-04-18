import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TrendDay {
  date: string;
  amount: number;
}

interface SalesTrendData {
  daily: TrendDay[];
  last_period_daily: TrendDay[];
}

const SalesTrend = () => {
  const [data, setData] = useState<SalesTrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrend();
  }, []);

  const loadTrend = async () => {
    setLoading(true);
    try {
      const result = await invoke<SalesTrendData>('get_sales_trend');
      setData(result);
    } catch (error) {
      console.error('Failed to load sales trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBarChart = (trendData: TrendDay[], color: string, label: string) => {
    const maxAmount = Math.max(...trendData.map(d => d.amount), 1);
    return (
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-2 text-center">{label}</div>
        <div className="flex items-end gap-1 h-32">
          {trendData.map((day, i) => {
            const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="text-[10px] text-muted-foreground mb-0.5">
                  {day.amount > 0 ? day.amount.toFixed(0) : ''}
                </div>
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${Math.max(height, 2)}%`,
                    backgroundColor: color,
                    minHeight: '2px',
                  }}
                />
                <div className="text-[9px] text-muted-foreground mt-1 text-center truncate w-full">
                  {day.date.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="mt-4 border-none shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-base font-medium">销售趋势（近7天）</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex gap-6">
            {renderBarChart(data.daily, '#3b82f6', '本期')}
            {renderBarChart(data.last_period_daily, '#f59e0b', '上期同期')}
          </div>
        ) : (
          <div className="text-center text-muted-foreground h-32 flex items-center justify-center">暂无数据</div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesTrend;
