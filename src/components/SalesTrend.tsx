import { useEffect, useState } from 'react';
import { Card, Spin } from 'antd';
import { invoke } from '@tauri-apps/api/core';

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
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, textAlign: 'center' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {trendData.map((day, i) => {
            const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>
                  {day.amount > 0 ? day.amount.toFixed(0) : ''}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: Math.max(height, 2),
                    backgroundColor: color,
                    borderRadius: '2px 2px 0 0',
                    minHeight: 2,
                    transition: 'height 0.3s',
                  }}
                />
                <div style={{ fontSize: 9, color: '#999', marginTop: 4, textAlign: 'center' }}>
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
    <Card title="销售趋势（近7天）" loading={loading} style={{ marginTop: 16 }}>
      {loading ? (
        <Spin />
      ) : data ? (
        <div style={{ display: 'flex', gap: 24 }}>
          {renderBarChart(data.daily, '#1890ff', '本月')}
          {renderBarChart(data.last_period_daily, '#faad14', '上月同期')}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999' }}>暂无数据</div>
      )}
    </Card>
  );
};

export default SalesTrend;
