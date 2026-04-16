import { useEffect, useState } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, ShopOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { getTauriErrorMessage } from '../utils/tauriError';

interface Partner {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  created_at: string;
}

const Partners = () => {
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerType, setPartnerType] = useState<'customer' | 'supplier'>('customer');
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cus, sup] = await Promise.all([
        invoke<Partner[]>('get_customers'),
        invoke<Partner[]>('get_suppliers'),
      ]);
      setCustomers(cus);
      setSuppliers(sup);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载往来单位失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (type: 'customer' | 'supplier') => {
    setPartnerType(type);
    setEditingPartner(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Partner, type: 'customer' | 'supplier') => {
    setPartnerType(type);
    setEditingPartner(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number, type: 'customer' | 'supplier') => {
    try {
      if (type === 'customer') {
        await invoke('delete_customer', { id });
      } else {
        await invoke('delete_supplier', { id });
      }
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingPartner) {
        if (partnerType === 'customer') {
          await invoke('update_customer', { id: editingPartner.id, ...values });
        } else {
          await invoke('update_supplier', { id: editingPartner.id, ...values });
        }
        message.success('更新成功');
      } else {
        if (partnerType === 'customer') {
          await invoke('add_customer', values);
        } else {
          await invoke('add_supplier', values);
        }
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '保存失败');
    }
  };

  const columns = (type: 'customer' | 'supplier') => [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: type === 'customer' ? '客户名称' : '供应商名称', dataIndex: 'name', width: 200 },
    { title: '联系人', dataIndex: 'contact', width: 150 },
    { title: '联系电话', dataIndex: 'phone', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Partner) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record, type)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个单位吗？"
            onConfirm={() => handleDelete(record.id, type)}
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
      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            {
              key: 'customers',
              label: '客户管理',
              icon: <TeamOutlined />,
              children: (
                <div>
                  <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('customer')}>
                      添加客户
                    </Button>
                  </div>
                  <Table
                    dataSource={customers}
                    columns={columns('customer')}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
            {
              key: 'suppliers',
              label: '供应商管理',
              icon: <ShopOutlined />,
              children: (
                <div>
                  <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd('supplier')}>
                      添加供应商
                    </Button>
                  </div>
                  <Table
                    dataSource={suppliers}
                    columns={columns('supplier')}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={editingPartner ? `编辑${partnerType === 'customer' ? '客户' : '供应商'}` : `添加${partnerType === 'customer' ? '客户' : '供应商'}`}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="必填，如公司名或个人姓名" />
          </Form.Item>
          <Form.Item name="contact" label="联系人">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Partners;