import { useEffect, useState } from 'react';
import { Form, Select, InputNumber, Input, Button, Card, message, Space, Alert, Table, Tag, DatePicker } from 'antd';
import { SendOutlined, DownloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import type { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { getTauriAppError, getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold } from '../utils/settings';

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  sell_price: number;
}

interface OutboundRecord {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  customer: string;
  created_at: string;
}

const Outbound = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [records, setRecords] = useState<OutboundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);

  useEffect(() => {
    loadProducts();
    loadRecords();
    loadLowStockThreshold();
  }, []);

  const loadLowStockThreshold = async () => {
    try {
      const value = await getLowStockThreshold();
      setLowStockThreshold(value);
    } catch (error) {
      console.error(error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await invoke<any[]>('get_products');
      setProducts(data);
    } catch (error) {
      message.error('加载商品列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (startDate?: string, endDate?: string) => {
    try {
      const data = await invoke<OutboundRecord[]>('get_outbound_records', {
        start_date: startDate || null,
        end_date: endDate || null,
      });
      setRecords(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      loadRecords(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
    } else {
      loadRecords();
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      await invoke('add_outbound', {
        order: {
          product_id: values.product_id,
          quantity: values.quantity,
          price: values.price,
          customer: values.customer || '未填写',
        },
      });
      message.success('出库成功');
      form.resetFields();
      loadProducts();
      loadRecords();
    } catch (error: any) {
      const appError = getTauriAppError(error);
      if (appError?.code === 'STOCK_INSUFFICIENT') {
        message.error(appError.message);
      } else {
        message.error(getTauriErrorMessage(error) || '出库失败');
      }
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProductId = Form.useWatch('product_id', form);
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const quantity = Form.useWatch('quantity', form);
  const price = Form.useWatch('price', form);

  // 自动填充销售价
  useEffect(() => {
    if (selectedProduct) {
      form.setFieldsValue({ price: selectedProduct.sell_price });
    }
  }, [selectedProductId, selectedProduct, form]);

  const isStockInsufficient = selectedProduct && quantity && quantity > selectedProduct.stock;
  const isLowStock = selectedProduct ? selectedProduct.stock < lowStockThreshold : false;

  const recordColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '商品', dataIndex: 'product_name', width: 120 },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    { 
      title: '单价', 
      dataIndex: 'price', 
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    { 
      title: '总金额', 
      dataIndex: 'total', 
      width: 100,
      render: (val: number) => <Tag color="green">¥{val.toFixed(2)}</Tag>,
    },
    { title: '客户', dataIndex: 'customer', width: 120 },
    { title: '时间', dataIndex: 'created_at', width: 160 },
  ];

  return (
    <div>
      <h2>出库管理</h2>
      <Card style={{ maxWidth: 600, marginBottom: 24 }}>
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="product_id"
            label="选择商品"
            rules={[{ required: true, message: '请选择商品' }]}
          >
            <Select
              placeholder="请选择商品"
              loading={loading}
              showSearch
              optionFilterProp="children"
            >
              {products.map((product) => (
                <Select.Option key={product.id} value={product.id}>
                  {product.name} (库存: {product.stock} {product.unit})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedProduct && (
            <Alert
              message={`当前库存: ${selectedProduct.stock} ${selectedProduct.unit}`}
              type={isLowStock ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="quantity"
            label="出库数量"
            rules={[{ required: true, message: '请输入出库数量' }]}
          >
            <InputNumber
              min={1}
              max={selectedProduct?.stock}
              style={{ width: '100%' }}
              placeholder="请输入出库数量"
              addonAfter={selectedProduct?.unit}
            />
          </Form.Item>

          {isStockInsufficient && (
            <Alert
              message="库存不足"
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="price"
            label="单价"
            rules={[{ required: true, message: '请输入单价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入单价"
              addonBefore="¥"
            />
          </Form.Item>

          <Form.Item name="customer" label="客户">
            <Input placeholder="请输入客户名称（可选）" />
          </Form.Item>

          {Number(quantity) > 0 && Number(price) > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <strong>总金额: </strong>
              ¥{(Number(quantity) * Number(price || 0)).toFixed(2)}
            </div>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={submitting}
                disabled={isStockInsufficient}
              >
                确认出库
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>出库记录</h3>
        <Space>
          <DatePicker.RangePicker value={dateRange} onChange={handleDateChange} />
          <Button icon={<DownloadOutlined />} onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const data = records.map(r => ({
              'ID': r.id,
              '商品': r.product_name,
              '数量': r.quantity,
              '单价': r.price,
              '总金额': r.total,
              '客户': r.customer,
              '时间': r.created_at,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '出库记录');
            XLSX.writeFile(wb, `出库记录_${today}.xlsx`);
          }}>
            导出
          </Button>
        </Space>
      </div>
      <Table
        columns={recordColumns}
        dataSource={records}
        rowKey="id"
        size="small"
        scroll={{ x: 700 }}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default Outbound;
