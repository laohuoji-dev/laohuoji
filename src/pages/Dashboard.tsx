import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Space, Button } from 'antd';
import { InboxOutlined, ShoppingCartOutlined, AppstoreOutlined, AccountBookOutlined, WarningOutlined, PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import SalesTrend from '../components/SalesTrend';

interface DashboardStats {
  total_products: number;
  total_stock_value: number;
  today_inbound: number;
  today_outbound: number;
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

  const slowColumns = [
    { title: '商品名称', dataIndex: 'name' },
    { title: '当前库存', dataIndex: 'stock' },
    { title: '未出库天数', dataIndex: 'days_since_last_sale', render: (val: number) => <span style={{color: '#faad14'}}>{val}天</span> },
  ];

  const lowStockColumns = [
    { title: '商品名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', render: (val: string) => val || '-' },
    { title: '当前库存', dataIndex: 'stock', render: (val: number) => <strong style={{color: '#cf1322'}}>{val}</strong> },
    { title: '安全库存', dataIndex: 'min_stock', render: (val: number) => val || '-' },
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title="在售商品种类"
              value={stats?.total_products || 0}
              prefix={<AppstoreOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title="今日入库单数"
              value={stats?.today_inbound || 0}
              prefix={<InboxOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title="今日出库单数"
              value={stats?.today_outbound || 0}
              prefix={<ShoppingCartOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} loading={loading}>
            <Statistic
              title="库存总成本(元)"
              value={stats?.total_stock_value || 0}
              precision={2}
              prefix={<AccountBookOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Card title="近30天销售趋势" bordered={false}>
            <SalesTrend />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="快捷操作" bordered={false} style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Button type="primary" block size="large" icon={<ShoppingCartOutlined />} onClick={() => onChangeMenu?.('outbound')}>
                新建出库单
              </Button>
              <Button block size="large" icon={<InboxOutlined />} onClick={() => onChangeMenu?.('inbound')}>
                新建入库单
              </Button>
              <Button block size="large" icon={<PlusOutlined />} onClick={() => onChangeMenu?.('products')}>
                新增商品
              </Button>
              <Button block size="large" icon={<HistoryOutlined />} onClick={() => onChangeMenu?.('inventory-logs')}>
                查库存流水
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card size="small" bordered={false} loading={loading}>
            <Statistic
              title="客户总欠款 (应收)"
              value={(stats as any)?.total_receivables || 0}
              precision={2}
              valueStyle={{ color: '#1677ff' }}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" bordered={false} loading={loading}>
            <Statistic
              title="欠供应商款 (应付)"
              value={(stats as any)?.total_payables || 0}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title={<Space><WarningOutlined style={{color: '#cf1322'}} /> 库存预警 (需要补货)</Space>} bordered={false}>
            <Table
              dataSource={lowStockProducts}
              columns={lowStockColumns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="small"
              loading={lowStockLoading}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="滞销预警 (近30天未出库)" bordered={false}>
            <Table
              dataSource={slowProducts}
              columns={slowColumns}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
