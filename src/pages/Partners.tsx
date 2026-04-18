import { useEffect, useState } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Space, message, Popconfirm, InputNumber, Drawer, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined, ShopOutlined, PayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { getTauriErrorMessage } from '../utils/tauriError';

const { Text } = Typography;

interface Partner {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  balance: number;
  created_at: string;
}

interface FinancialLog {
  id: number;
  associated_order_id: number | null;
  change_amount: number;
  after_balance: number;
  remark: string | null;
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

  // Payment State
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentPartner, setPaymentPartner] = useState<Partner | null>(null);
  const [paymentForm] = Form.useForm();

  // Logs State
  const [logsDrawerVisible, setLogsDrawerVisible] = useState(false);
  const [financialLogs, setFinancialLogs] = useState<FinancialLog[]>([]);
  const [logsPartner, setLogsPartner] = useState<Partner | null>(null);

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

  const handlePaymentSubmit = async (values: any) => {
    if (!paymentPartner) return;
    try {
      await invoke('add_payment', {
        partnerType: partnerType === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        partnerName: paymentPartner.name,
        amount: values.amount,
        remark: values.remark || '手动结款',
      });
      message.success('结款成功');
      setPaymentModalVisible(false);
      loadData();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '结款失败');
    }
  };

  const showLogs = async (record: Partner, type: 'customer' | 'supplier') => {
    setLogsPartner(record);
    setPartnerType(type);
    try {
      const logs = await invoke<FinancialLog[]>('get_financial_logs', {
        partnerType: type === 'customer' ? 'CUSTOMER' : 'SUPPLIER',
        partnerName: record.name,
      });
      setFinancialLogs(logs);
      setLogsDrawerVisible(true);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载流水失败');
    }
  };

  const columns = (type: 'customer' | 'supplier') => [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: type === 'customer' ? '客户名称' : '供应商名称', dataIndex: 'name', width: 200 },
    { title: '联系人', dataIndex: 'contact', width: 150 },
    { title: '联系电话', dataIndex: 'phone', width: 150 },
    {
      title: type === 'customer' ? '应收款' : '应付款',
      dataIndex: 'balance',
      width: 120,
      render: (val: number) => {
        const isDebt = val > 0;
        return (
          <Text type={isDebt ? 'danger' : 'success'} strong>
            ¥{val.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_: any, record: Partner) => (
        <Space>
          <Button
            type="link"
            icon={<PayCircleOutlined />}
            onClick={() => {
              setPaymentPartner(record);
              setPartnerType(type);
              paymentForm.resetFields();
              setPaymentModalVisible(true);
            }}
          >
            结款
          </Button>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => showLogs(record, type)}>
            流水
          </Button>
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

      {/* Payment Modal */}
      <Modal
        title={partnerType === 'customer' ? '客户结款 (收款)' : '供应商结款 (付款)'}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={paymentForm} onFinish={handlePaymentSubmit} layout="vertical">
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">往来单位：</Text> <Text strong>{paymentPartner?.name}</Text>
            <br />
            <Text type="secondary">当前欠款：</Text>{' '}
            <Text strong type="danger">
              ¥{paymentPartner?.balance.toFixed(2)}
            </Text>
          </div>
          <Form.Item
            name="amount"
            label="结款金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              placeholder="请输入本次结款金额"
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="选填，如：银行转账、微信支付" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setPaymentModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确认结款
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Financial Logs Drawer */}
      <Drawer
        title={`${logsPartner?.name} - 账款流水`}
        placement="right"
        width={600}
        onClose={() => setLogsDrawerVisible(false)}
        open={logsDrawerVisible}
      >
        <Table
          dataSource={financialLogs}
          rowKey="id"
          pagination={{ pageSize: 15 }}
          size="small"
          columns={[
            {
              title: '时间',
              dataIndex: 'created_at',
              width: 150,
            },
            {
              title: '事项',
              dataIndex: 'remark',
              width: 120,
            },
            {
              title: '变动金额',
              dataIndex: 'change_amount',
              width: 120,
              render: (val: number) => (
                <Text type={val > 0 ? 'danger' : 'success'}>
                  {val > 0 ? '+' : ''}
                  {val.toFixed(2)}
                </Text>
              ),
            },
            {
              title: '变动后欠款',
              dataIndex: 'after_balance',
              width: 120,
              render: (val: number) => `¥${val.toFixed(2)}`,
            },
          ]}
        />
      </Drawer>
    </div>
  );
};

export default Partners;