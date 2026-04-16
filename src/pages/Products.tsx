import { useEffect, useState, useRef } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { getFirstLetter, toPinyin } from '../utils/pinyin';
import { getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold } from '../utils/settings';

interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

interface Suggestion {
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [form] = Form.useForm();
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProducts();
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

  useEffect(() => {
    if (!searchText) {
      setFilteredProducts(products);
    } else {
      const searchLower = searchText.toLowerCase();
      const filtered = products.filter(p => {
        // Match original text
        if (p.name.toLowerCase().includes(searchLower)) return true;
        if (p.category && p.category.toLowerCase().includes(searchLower)) return true;
        // Match pinyin first letter
        if (getFirstLetter(p.name).includes(searchLower)) return true;
        if (p.category && getFirstLetter(p.category).includes(searchLower)) return true;
        // Match full pinyin
        if (toPinyin(p.name).includes(searchLower)) return true;
        if (p.category && toPinyin(p.category).includes(searchLower)) return true;
        return false;
      });
      setFilteredProducts(filtered);
    }
  }, [searchText, products]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载商品列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (name: string) => {
    if (name.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const data = await invoke<Suggestion[]>('get_product_suggestions', { name });
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleNameSearch = (value: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const applySuggestion = (s: Suggestion) => {
    form.setFieldsValue({
      category: s.category,
      unit: s.unit,
      cost_price: s.cost_price,
      sell_price: s.sell_price,
    });
    setShowSuggestions(false);
    message.success('已自动填充推荐值');
  };

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    setSuggestions([]);
    setShowSuggestions(false);
    setModalVisible(true);
  };

  const handleEdit = (record: Product) => {
    setEditingProduct(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke('delete_product', { id });
      message.success('删除成功');
      loadProducts();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '删除失败');
      console.error(error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingProduct) {
        await invoke('update_product', {
          id: editingProduct.id,
          product: values,
        });
        message.success('更新成功');
      } else {
        await invoke('add_product', { product: values });
        message.success('添加成功');
      }
      setModalVisible(false);
      loadProducts();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || (editingProduct ? '更新失败' : '添加失败'));
      console.error(error);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '商品名称', dataIndex: 'name', width: 150 },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '单位', dataIndex: 'unit', width: 80 },
    {
      title: '成本价',
      dataIndex: 'cost_price',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '销售价',
      dataIndex: 'sell_price',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 80,
      render: (val: number) => (
        <span style={{ color: val < lowStockThreshold ? '#cf1322' : '#3f8600' }}>
          {val}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Product) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个商品吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>商品管理</h2>
        <Space>
          <Input
            placeholder="搜索商品名称或分类"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加商品
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredProducts}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingProduct ? '编辑商品' : '添加商品'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <div style={{ position: 'relative' }}>
              <Input
                placeholder="请输入商品名称"
                onChange={(e) => handleNameSearch(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      }}
                      onMouseDown={() => applySuggestion(s)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                    >
                      <div style={{ fontSize: 12, color: '#666' }}>
                        分类: {s.category} | 单位: {s.unit} | 成本: ¥{s.cost_price.toFixed(2)} | 售价: ¥{s.sell_price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
          >
            <Input placeholder="请输入分类（可选）" />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
            rules={[{ required: true, message: '请输入单位' }]}
          >
            <Input placeholder="如：件、箱、个" />
          </Form.Item>

          <Form.Item
            name="cost_price"
            label="成本价"
            rules={[{ required: true, message: '请输入成本价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入成本价"
            />
          </Form.Item>

          <Form.Item
            name="sell_price"
            label="销售价"
            rules={[{ required: true, message: '请输入销售价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入销售价"
            />
          </Form.Item>

          <Form.Item
            name="stock"
            label="初始库存"
            rules={[{ required: true, message: '请输入初始库存' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="请输入初始库存"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
