import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SalesTrend from '../components/SalesTrend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Inbox, 
  ShoppingCart, 
  LayoutGrid, 
  Wallet, 
  AlertTriangle, 
  Plus, 
  History,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  total_products: number;
  total_stock_value: number;
  today_inbound: number;
  today_outbound: number;
  total_receivables: number;
  total_payables: number;
}

interface SlowProduct {
  id: number;
  name: string;
  stock: number;
  days_since_last_sale: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  category: string | null;
  stock: number;
  min_stock: number | null;
}

function StatisticCard({ title, value, icon, loading, prefix = '', precision = 0, valueClass = '' }: { title: string, value: string | number, icon?: React.ReactNode, loading?: boolean, prefix?: string, precision?: number, valueClass?: string }) {
  const displayValue = typeof value === 'number' ? value.toFixed(precision) : value;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className={`text-2xl font-bold ${valueClass}`}>
            {prefix}{displayValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Dashboard = ({ onChangeMenu }: { onChangeMenu?: (key: string) => void }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [slowProducts, setSlowProducts] = useState<SlowProduct[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadLowStock();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, slowData] = await Promise.all([
        invoke<DashboardStats>('get_dashboard_stats'),
        invoke<SlowProduct[]>('get_slow_moving_products', { days: 30, limit: 5 })
      ]);
      setStats(statsData);
      setSlowProducts(slowData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLowStock = async () => {
    setLowStockLoading(true);
    try {
      const data = await invoke<LowStockProduct[]>('get_low_stock_products');
      setLowStockProducts(data);
    } catch (error) {
      console.error('Failed to load low stock:', error);
    } finally {
      setLowStockLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatisticCard
          title="在售商品种类"
          value={stats?.total_products || 0}
          icon={<LayoutGrid className="h-4 w-4 text-blue-500" />}
          loading={loading}
        />
        <StatisticCard
          title="今日入库单数"
          value={stats?.today_inbound || 0}
          icon={<Inbox className="h-4 w-4 text-green-500" />}
          loading={loading}
        />
        <StatisticCard
          title="今日出库单数"
          value={stats?.today_outbound || 0}
          icon={<ShoppingCart className="h-4 w-4 text-orange-500" />}
          loading={loading}
        />
        <StatisticCard
          title="库存总成本(元)"
          value={stats?.total_stock_value || 0}
          precision={2}
          icon={<Wallet className="h-4 w-4 text-purple-500" />}
          loading={loading}
        />
      </div>

      {/* Middle Section: Trend and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>近30天销售趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesTrend />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button size="lg" className="w-full" onClick={() => onChangeMenu?.('outbound')}>
              <ShoppingCart className="mr-2 h-5 w-5" /> 新建出库单
            </Button>
            <Button size="lg" variant="secondary" className="w-full" onClick={() => onChangeMenu?.('inbound')}>
              <Inbox className="mr-2 h-5 w-5" /> 新建入库单
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => onChangeMenu?.('products')}>
              <Plus className="mr-2 h-5 w-5" /> 新增商品
            </Button>
            <Button size="lg" variant="ghost" className="w-full" onClick={() => onChangeMenu?.('inventory-logs')}>
              <History className="mr-2 h-5 w-5" /> 查库存流水
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatisticCard
          title="客户总欠款 (应收)"
          value={stats?.total_receivables || 0}
          prefix="¥ "
          precision={2}
          valueClass="text-blue-600"
          loading={loading}
        />
        <StatisticCard
          title="欠供应商款 (应付)"
          value={stats?.total_payables || 0}
          prefix="¥ "
          precision={2}
          valueClass="text-red-600"
          loading={loading}
        />
      </div>

      {/* Bottom Section: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              库存预警 (需要补货)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>当前库存</TableHead>
                    <TableHead>安全库存</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">暂无预警商品</TableCell></TableRow>
                  ) : lowStockProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category || '-'}</TableCell>
                      <TableCell className="font-bold text-red-600">{p.stock}</TableCell>
                      <TableCell>{p.min_stock || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>滞销预警 (近30天未出库)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品名称</TableHead>
                    <TableHead>当前库存</TableHead>
                    <TableHead>未出库天数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowProducts.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">暂无滞销商品</TableCell></TableRow>
                  ) : slowProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell className="text-yellow-600">{p.days_since_last_sale}天</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
