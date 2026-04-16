import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm, Select, Tooltip, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, QuestionCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { getFirstLetter, toPinyin } from '../utils/pinyin';
import { getTauriAppError, getTauriErrorMessage } from '../utils/tauriError';
import { getLowStockThreshold, getCategories, getUnits, Category, Unit } from '../utils/settings';

interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  barcode?: string;
  status: string;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

// interface Suggestion {
//   name: string;
//   category: string;
//   unit: string;
//   cost_price: number;
//   sell_price: number;
// }

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadProducts();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [threshold, cats, uns] = await Promise.all([
        getLowStockThreshold(),
        getCategories(),
        getUnits()
      ]);
      setLowStockThreshold(threshold);
      setCategories(cats);
      setUnits(uns);
    } catch (error) {
      console.error('加载基础配置失败:', error);
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
        if (p.barcode && p.barcode.toLowerCase().includes(searchLower)) return true;
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

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', min_stock: 0 });
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
      message.success('商品已删除');
      loadProducts();
    } catch (error: any) {
      const errObj = getTauriAppError(error);
      if (errObj && errObj.code === 'PRODUCT_HAS_HISTORY') {
        Modal.warning({
          title: '无法删除商品',
          content: '该商品存在入库、出库或修改流水，无法直接删除以保证数据完整性。建议将其库存清零或修改名称进行归档。',
        });
      } else {
        message.error(getTauriErrorMessage(error) || '删除商品失败');
      }
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

  const exportToExcel = async () => {
    try {
      const filePath = await save({
        title: '导出商品列表',
        defaultPath: `商品列表_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (!filePath) return;

      const hide = message.loading('正在导出数据...', 0);

      // 准备导出数据
      const exportData = filteredProducts.map((p) => ({
        '商品ID': p.id,
        '条码': p.barcode || '',
        '商品名称': p.name,
        '分类': p.category,
        '单位': p.unit,
        '成本价': p.cost_price,
        '销售价': p.sell_price,
        '当前库存': p.stock,
        '安全库存': p.min_stock,
        '状态': p.status === 'ACTIVE' ? '在售' : '停售',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // 设置列宽
      ws['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
        { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, '商品列表');
      
      // 写入文件
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(excelBuffer));
      
      hide();
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error(getTauriErrorMessage(error) || '导出失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '条码', dataIndex: 'barcode', width: 120 },
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
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => (
        <Tag color={val === 'ACTIVE' ? 'success' : 'default'}>
          {val === 'ACTIVE' ? '在售' : '停售'}
        </Tag>
      ),
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 80,
      render: (val: number, record: Product) => {
        // 如果该商品设置了特定的安全库存，且大于0，则使用该特定值；否则使用全局阈值
        const threshold = (record.min_stock && record.min_stock > 0) ? record.min_stock : lowStockThreshold;
        return (
          <span style={{ color: val < threshold ? '#cf1322' : '#3f8600' }}>
            {val}
          </span>
        );
      },
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
            placeholder="搜索名称、条码、分类、拼音..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加商品
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportToExcel}>
            导出商品
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
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>

          <Form.Item
            name="barcode"
            label="商品条码"
            tooltip="支持扫码枪直接录入，为空则仅靠名称识别"
          >
            <Input placeholder="选填，如: 6901234567890" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
          >
            <Select placeholder="请选择分类" allowClear>
              {categories.map(c => (
                <Select.Option key={c.id} value={c.name}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
            rules={[{ required: true, message: '请选择单位' }]}
          >
            <Select placeholder="请选择单位">
              {units.map(u => (
                <Select.Option key={u.id} value={u.name}>{u.name}</Select.Option>
              ))}
            </Select>
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

          <Space style={{ display: 'flex', width: '100%' }}>
            <Form.Item name="min_stock" label={<span>安全库存 <Tooltip title="当库存低于此值时触发预警，填0则使用全局配置"><QuestionCircleOutlined /></Tooltip></span>} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="商品专属预警值" />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select>
                <Select.Option value="ACTIVE">在售</Select.Option>
                <Select.Option value="INACTIVE">停售 (归档)</Select.Option>
              </Select>
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
