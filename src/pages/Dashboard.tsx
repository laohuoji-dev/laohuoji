import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, List, Tag } from 'antd';
import { AppstoreOutlined, DollarOutlined, ShoppingCartOutlined, RiseOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

interface Statistics {
  product_count: number;
  total_stock: number;
  total_value: number;
  monthly_sales: number;
  monthly_profit: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Statistics>({
    product_count: 0,
    total_stock: 0,
    total_value: 0,
    monthly_sales: 0,
    monthly_profit: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
    loadLowStockProducts();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const data = await invoke<Statistics>('get_statistics');
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLowStockProducts = async () => {
    try {
      const data = await invoke<LowStockProduct[]>('get_low_stock_products');
      setLowStockProducts(data);
    } catch (error) {
      console.error('Failed to load low stock products:', error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>数据概览</h2>
        <Button icon={<ReloadOutlined />} onClick={() => { loadStatistics(); loadLowStockProducts(); }} loading={loading}>
          刷新
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="商品总数"
              value={stats.product_count}
              prefix={<AppstoreOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="库存总数"
              value={stats.total_stock}
              prefix={<ShoppingCartOutlined />}
              suffix="件"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="库存总价值"
              value={stats.total_value}
              prefix={<DollarOutlined />}
              precision={2}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card loading={loading}>
            <Statistic
              title="本月销售额"
              value={stats.monthly_sales}
              prefix={<DollarOutlined />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12}>
          <Card loading={loading}>
            <Statistic
              title="本月利润"
              value={stats.monthly_profit}
              prefix={<RiseOutlined />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
      {lowStockProducts.length > 0 && (
        <Card
          title={
            <span>
              <WarningOutlined style={{ color: '#cf1322', marginRight: 8 }} />
              库存预警
              <Tag color="red" style={{ marginLeft: 8 }}>{lowStockProducts.length} 个商品</Tag>
            </span>
          }
          style={{ marginTop: 16 }}
          styles={{ body: { padding: 0 } }}
        >
          <List
            size="small"
            dataSource={lowStockProducts}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={item.name}
                  description={item.category ? `分类: ${item.category}` : ''}
                />
                <Tag color="red">库存: {item.stock} {item.unit}</Tag>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
