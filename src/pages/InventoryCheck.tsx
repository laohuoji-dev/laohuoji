import { useEffect, useState } from 'react';
import { Table, Button, Space, InputNumber, message, Select, Typography, Card, Tag } from 'antd';
import { PlusOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { getTauriErrorMessage } from '../utils/tauriError';

const { Title, Text } = Typography;

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  barcode: string | null;
  status: string;
  min_stock: number;
}

interface CheckItem {
  key: string; // 本地生成的唯一key
  product_id?: number;
  product?: Product;
  actual_stock?: number;
}

const InventoryCheck = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
    handleAddRow(); // 初始添加一行
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await invoke<Product[]>('get_products');
      // 盘点页面也可以展示停用的商品，防止旧商品需要清库，但为了体验，这里默认过滤停售，除非你想全盘点
      setProducts(data);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setItems(prev => [...prev, { key: Date.now().toString() + Math.random().toString() }]);
  };

  const handleRemoveRow = (key: string) => {
    setItems(prev => prev.filter(item => item.key !== key));
  };

  const handleItemChange = (key: string, field: keyof CheckItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.key === key) {
        const newItem = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find(p => p.id === value);
          newItem.product = product;
          newItem.actual_stock = product?.stock; // 默认带出当前库存
        }
        return newItem;
      }
      return item;
    }));
  };

  const handleBatchUpdate = async () => {
    // 过滤掉无效行
    const validItems = items.filter(item => item.product_id && item.actual_stock !== undefined);
    
    if (validItems.length === 0) {
      message.warning('没有有效的盘点数据');
      return;
    }

    // 检查是否有重复盘点的商品
    const productIds = validItems.map(i => i.product_id);
    if (new Set(productIds).size !== productIds.length) {
      message.error('列表中存在重复的商品，请合并后再提交');
      return;
    }

    // 筛选出真正有差异的行
    const changedItems = validItems.filter(item => item.actual_stock !== item.product?.stock);
    
    if (changedItems.length === 0) {
      message.success('所有实盘数量与系统账面一致，无需更新');
      // 清空并重新加载
      setItems([{ key: Date.now().toString() }]);
      return;
    }

    const payload = changedItems.map(item => ({
      product_id: item.product_id,
      actual_stock: item.actual_stock,
      reason: '库存盘点',
    }));

    setSubmitting(true);
    try {
      const count = await invoke<number>('batch_update_stock', { adjustments: payload });
      message.success(`成功更新 ${count} 种商品的库存`);
      
      // 重新加载数据
      await loadProducts();
      setItems([{ key: Date.now().toString() }]);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '盘点提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '商品',
      dataIndex: 'product_id',
      width: 300,
      render: (value: any, record: CheckItem) => (
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder="请选择商品 (支持名称/条码拼音搜索)"
          optionFilterProp="children"
          value={value}
          onChange={(val) => handleItemChange(record.key, 'product_id', val)}
          filterOption={(input, option) => {
            const p = products.find(p => p.id === option?.value);
            if (!p) return false;
            const searchStr = input.toLowerCase();
            return !!((p.name?.toLowerCase().includes(searchStr)) || 
                   (p.barcode?.toLowerCase().includes(searchStr)));
          }}
        >
          {products.map(p => (
            <Select.Option key={p.id} value={p.id} disabled={items.some(i => i.key !== record.key && i.product_id === p.id)}>
              {p.name} {p.barcode ? `(${p.barcode})` : ''} {p.status === 'INACTIVE' ? '[停售]' : ''}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '账面库存',
      key: 'system_stock',
      width: 120,
      render: (_: any, record: CheckItem) => (
        <Text>{record.product?.stock ?? '-'}</Text>
      ),
    },
    {
      title: '实盘数量',
      dataIndex: 'actual_stock',
      width: 150,
      render: (value: any, record: CheckItem) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={value}
          onChange={(val) => handleItemChange(record.key, 'actual_stock', val)}
          disabled={!record.product_id}
        />
      ),
    },
    {
      title: '单位',
      key: 'unit',
      width: 80,
      render: (_: any, record: CheckItem) => (
        <Text>{record.product?.unit ?? '-'}</Text>
      ),
    },
    {
      title: '盈亏差异',
      key: 'diff',
      width: 120,
      render: (_: any, record: CheckItem) => {
        if (!record.product || record.actual_stock === undefined) return '-';
        const diff = record.actual_stock - record.product.stock;
        if (diff > 0) return <Tag color="green">盘盈 +{diff}</Tag>;
        if (diff < 0) return <Tag color="red">盘亏 {diff}</Tag>;
        return <Tag>正常</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: CheckItem) => (
        <Button type="link" danger onClick={() => handleRemoveRow(record.key)}>
          移除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>库存盘点</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadProducts}>
            刷新数据
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleBatchUpdate} loading={submitting}>
            提交盘点
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="key"
          pagination={false}
          loading={loading}
          footer={() => (
            <Button type="dashed" onClick={handleAddRow} icon={<PlusOutlined />} style={{ width: '100%' }}>
              添加盘点行
            </Button>
          )}
        />
      </Card>
    </div>
  );
};

export default InventoryCheck;