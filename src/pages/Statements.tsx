import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Divider, message, Row, Select, Space, Statistic, Table, Tabs, Typography } from 'antd';
import { DownloadOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import type { Dayjs } from 'dayjs';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { getTauriErrorMessage } from '../utils/tauriError';
import { getCompanyInfo, CompanyInfo } from '../utils/settings';

const { Title, Text } = Typography;

interface Partner {
  id: number;
  name: string;
}

interface CustomerItem {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  sales_total: number;
  cost_total: number;
  profit_total: number;
}

interface SupplierItem {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  purchase_total: number;
}

interface CustomerStatement {
  type: 'customer';
  name: string;
  start_date?: string;
  end_date?: string;
  summary: {
    sales_total: number;
    quantity_total: number;
    cost_total: number;
    profit_total: number;
    order_count: number;
    product_count: number;
  };
  items: CustomerItem[];
}

interface SupplierStatement {
  type: 'supplier';
  name: string;
  start_date?: string;
  end_date?: string;
  summary: {
    purchase_total: number;
    quantity_total: number;
    order_count: number;
    product_count: number;
  };
  items: SupplierItem[];
}

const Statements = () => {
  const [customers, setCustomers] = useState<Partner[]>([]);
  const [suppliers, setSuppliers] = useState<Partner[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', phone: '', address: '' });

  const [tab, setTab] = useState<'customer' | 'supplier'>('customer');
  const [partnerName, setPartnerName] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerStatement, setCustomerStatement] = useState<CustomerStatement | null>(null);
  const [supplierStatement, setSupplierStatement] = useState<SupplierStatement | null>(null);

  useEffect(() => {
    loadPartners();
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const info = await getCompanyInfo();
      setCompanyInfo(info);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPartners = async () => {
    try {
      const [cus, sup] = await Promise.all([
        invoke<Partner[]>('get_customers'),
        invoke<Partner[]>('get_suppliers'),
      ]);
      setCustomers(cus);
      setSuppliers(sup);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载往来单位失败');
    }
  };

  const query = async () => {
    setLoading(true);
    try {
      const start = dateRange?.[0]?.format('YYYY-MM-DD');
      const end = dateRange?.[1]?.format('YYYY-MM-DD');
      if (tab === 'customer') {
        const data = await invoke<CustomerStatement>('get_customer_statement', {
          customer: partnerName ?? null,
          start_date: start ?? null,
          end_date: end ?? null,
        } as any);
        setCustomerStatement(data);
      } else {
        const data = await invoke<SupplierStatement>('get_supplier_statement', {
          supplier: partnerName ?? null,
          start_date: start ?? null,
          end_date: end ?? null,
        } as any);
        setSupplierStatement(data);
      }
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      const filePath = await save({
        title: '导出对账单',
        defaultPath: `对账单_${tab === 'customer' ? '客户' : '供应商'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (!filePath) return;

      const data =
        tab === 'customer'
          ? (customerStatement?.items ?? []).map((i) => ({
              商品: i.product_name,
              单位: i.unit,
              数量: i.quantity,
              销售额: i.sales_total,
              成本: i.cost_total,
              利润: i.profit_total,
            }))
          : (supplierStatement?.items ?? []).map((i) => ({
              商品: i.product_name,
              单位: i.unit,
              数量: i.quantity,
              采购额: i.purchase_total,
            }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, '对账单');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await writeFile(filePath, new Uint8Array(buf));
      message.success('已导出');
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '导出失败');
    }
  };

  const printReport = () => {
    window.print();
  };

  const customerColumns = useMemo(
    () => [
      { title: '商品', dataIndex: 'product_name', width: 220 },
      { title: '单位', dataIndex: 'unit', width: 80 },
      { title: '数量', dataIndex: 'quantity', width: 100 },
      {
        title: '销售额',
        dataIndex: 'sales_total',
        width: 120,
        render: (v: number) => `¥${v.toFixed(2)}`,
      },
      {
        title: '成本',
        dataIndex: 'cost_total',
        width: 120,
        render: (v: number) => `¥${v.toFixed(2)}`,
      },
      {
        title: '利润',
        dataIndex: 'profit_total',
        width: 120,
        render: (v: number) => `¥${v.toFixed(2)}`,
      },
    ],
    [],
  );

  const supplierColumns = useMemo(
    () => [
      { title: '商品', dataIndex: 'product_name', width: 220 },
      { title: '单位', dataIndex: 'unit', width: 80 },
      { title: '数量', dataIndex: 'quantity', width: 100 },
      {
        title: '采购额',
        dataIndex: 'purchase_total',
        width: 120,
        render: (v: number) => `¥${v.toFixed(2)}`,
      },
    ],
    [],
  );

  const currentStatement = tab === 'customer' ? customerStatement : supplierStatement;

  return (
    <div className="print-root">
      <div className="print-header" style={{ display: 'none', marginBottom: 24 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>
          {companyInfo.name || '对账单'}
        </Title>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Text type="secondary">{tab === 'customer' ? '客户销售对账单' : '供应商采购对账单'}</Text>
        </div>
        
        <Row style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text strong>{tab === 'customer' ? '客户名称：' : '供应商名称：'}</Text>
            <Text>{partnerName || '全部'}</Text>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Text strong>对账期间：</Text>
            <Text>
              {dateRange ? `${dateRange[0]?.format('YYYY-MM-DD') ?? ''} 至 ${dateRange[1]?.format('YYYY-MM-DD') ?? ''}` : '全部'}
            </Text>
          </Col>
        </Row>
      </div>

      <div className="no-print">
        <Title level={2} style={{ marginBottom: 16 }}>
          对账与统计
        </Title>
      </div>

      <Card className="no-print" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Tabs
            activeKey={tab}
            onChange={(k) => {
              const next = k as 'customer' | 'supplier';
              setTab(next);
              setPartnerName(undefined);
              setDateRange(null);
            }}
            items={[
              { key: 'customer', label: '客户对账' },
              { key: 'supplier', label: '供应商对账' },
            ]}
          />
          <Select
            allowClear
            showSearch
            placeholder={tab === 'customer' ? '选择客户（可选）' : '选择供应商（可选）'}
            style={{ width: 260 }}
            value={partnerName}
            options={(tab === 'customer' ? customers : suppliers).map((p) => ({
              value: p.name,
              label: p.name,
            }))}
            onChange={(v) => setPartnerName(v)}
            optionFilterProp="label"
          />
          <DatePicker.RangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
          <Button icon={<ReloadOutlined />} onClick={query} loading={loading}>
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportExcel} disabled={!currentStatement?.items?.length}>
            导出
          </Button>
          <Button icon={<PrinterOutlined />} onClick={printReport} disabled={!currentStatement?.items?.length}>
            打印
          </Button>
        </Space>
      </Card>

      {currentStatement && (
        <Card style={{ marginBottom: 16 }} className="statement-summary">
          <Space wrap size="large">
            {tab === 'customer' ? (
              <>
                <Statistic title="销售额" value={customerStatement?.summary.sales_total ?? 0} precision={2} prefix="¥" />
                <Statistic title="成本" value={customerStatement?.summary.cost_total ?? 0} precision={2} prefix="¥" />
                <Statistic title="利润" value={customerStatement?.summary.profit_total ?? 0} precision={2} prefix="¥" />
                <Statistic title="单据数" value={customerStatement?.summary.order_count ?? 0} />
                <Statistic title="商品数" value={customerStatement?.summary.product_count ?? 0} />
              </>
            ) : (
              <>
                <Statistic title="采购额" value={supplierStatement?.summary.purchase_total ?? 0} precision={2} prefix="¥" />
                <Statistic title="单据数" value={supplierStatement?.summary.order_count ?? 0} />
                <Statistic title="商品数" value={supplierStatement?.summary.product_count ?? 0} />
              </>
            )}
          </Space>
        </Card>
      )}

      <Table
        className="print-table"
        rowKey="product_id"
        loading={loading}
        dataSource={(currentStatement?.items as any) ?? []}
        columns={(tab === 'customer' ? customerColumns : supplierColumns) as any}
        pagination={false}
        bordered
      />

      <div className="print-footer" style={{ display: 'none', marginTop: 40 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text strong>制单人：</Text>
            <div style={{ borderBottom: '1px solid #000', width: '120px', display: 'inline-block' }}></div>
          </Col>
          <Col span={8}>
            <Text strong>{tab === 'customer' ? '客户确认签字/盖章：' : '供应商确认签字/盖章：'}</Text>
            <div style={{ borderBottom: '1px solid #000', width: '120px', display: 'inline-block' }}></div>
          </Col>
          <Col span={8}>
            <Text strong>打印日期：</Text>
            <Text>{new Date().toLocaleString()}</Text>
          </Col>
        </Row>
        {(companyInfo.phone || companyInfo.address) && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div style={{ textAlign: 'center', fontSize: '12px' }}>
              {companyInfo.phone && <Text type="secondary" style={{ marginRight: 16 }}>电话：{companyInfo.phone}</Text>}
              {companyInfo.address && <Text type="secondary">地址：{companyInfo.address}</Text>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Statements;
