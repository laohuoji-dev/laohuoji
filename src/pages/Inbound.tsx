import { useEffect, useState } from 'react';
import { Form, Select, InputNumber, Button, Card, message, Space, Table, Tag, DatePicker } from 'antd';
import { ShoppingCartOutlined, DownloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import type { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold } from '../utils/settings';

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  stock: number;
  unit: string;
  cost_price: number;
  barcode?: string;
  status: string;
}

interface InboundRecord {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  supplier: string;
  created_at: string;
}

const Inbound = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [records, setRecords] = useState<InboundRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
    loadRecords();
    loadLowStockThreshold();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await invoke<Supplier[]>('get_suppliers');
      setSuppliers(data);
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    }
  };

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
      const data = await invoke<Product[]>('get_products');
      setProducts(data.filter(p => p.status === 'ACTIVE'));
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载商品列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async (startDate?: string, endDate?: string) => {
    try {
      const data = await invoke<InboundRecord[]>('get_inbound_records', {
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
      await invoke('add_inbound', {
        order: {
          product_id: values.product_id,
          quantity: values.quantity,
          price: values.price,
          supplier: values.supplier || '未填写',
          paid_amount: Number(values.paid_amount || 0),
        },
      });
      message.success('入库成功');
      form.resetFields();
      loadProducts();
      loadRecords();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '入库失败');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProductId = Form.useWatch('product_id', form);
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const quantity = Form.useWatch('quantity', form);
  const price = Form.useWatch('price', form);
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
      render: (val: number) => <Tag color="blue">¥{val.toFixed(2)}</Tag>,
    },
    { title: '供应商', dataIndex: 'supplier', width: 120 },
    { title: '时间', dataIndex: 'created_at', width: 160 },
  ];

  return (
    <div>
      <h2>入库管理</h2>
      <Card style={{ maxWidth: 600, marginBottom: 24 }}>
        <Form 
          form={form} 
          onFinish={handleSubmit} 
          layout="vertical"
          initialValues={{ quantity: 1, price: 0, paid_amount: 0 }}
        >
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
                  {product.name} (当前库存: {product.stock} {product.unit})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedProduct && (
            <Tag color={isLowStock ? 'red' : 'blue'} style={{ marginBottom: 16 }}>
              当前库存: {selectedProduct.stock} {selectedProduct.unit}
              {isLowStock ? `（低于阈值 ${lowStockThreshold}）` : ''}
            </Tag>
          )}

          <Form.Item
            name="quantity"
            label="入库数量"
            rules={[{ required: true, message: '请输入入库数量' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="请输入入库数量"
              addonAfter={selectedProduct?.unit}
            />
          </Form.Item>

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

          <Form.Item name="supplier" label="供应商">
            <Select placeholder="请选择供应商" allowClear showSearch>
              {suppliers.map(s => (
                <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="本次实付">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="paid_amount" noStyle>
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="如赊账请留空或填0"
                />
              </Form.Item>
              <Button onClick={() => {
                const price = form.getFieldValue('price') || 0;
                const qty = form.getFieldValue('quantity') || 0;
                form.setFieldValue('paid_amount', price * qty);
              }}>
                全额付款
              </Button>
            </Space.Compact>
          </Form.Item>

          {Number(quantity) > 0 && Number(price) > 0 && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <strong>总金额: </strong>
              ¥{(Number(quantity) * Number(price || 0)).toFixed(2)}
            </div>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<ShoppingCartOutlined />} loading={submitting}>
                确认入库
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>入库记录</h3>
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
              '供应商': r.supplier,
              '时间': r.created_at,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '入库记录');
            XLSX.writeFile(wb, `入库记录_${today}.xlsx`);
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

export default Inbound;
