import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, message, Select, Space, Table, Tag } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import type { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { getTauriErrorMessage } from '../utils/tauriError';

interface Product {
  id: number;
  name: string;
}

interface InventoryLog {
  id: number;
  product_id: number;
  product_name: string;
  change_type: string;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  reference_id: number | null;
  created_at: string;
}

const InventoryLogs = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProducts();
    loadLogs();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await invoke<Product[]>('get_products');
      setProducts(data.map((p) => ({ id: p.id, name: p.name })));
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载商品列表失败');
    }
  };

  const loadLogs = async (nextProductId?: number, startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const data = await invoke<InventoryLog[]>('get_inventory_logs', {
        product_id: nextProductId ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
      });
      setLogs(data);
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载库存流水失败');
    } finally {
      setLoading(false);
    }
  };

  const changeTypeLabel = (t: string) => {
    switch (t) {
      case 'INBOUND':
        return <Tag color="blue">入库</Tag>;
      case 'OUTBOUND':
        return <Tag color="orange">出库</Tag>;
      case 'MANUAL_ADJUST':
        return <Tag color="purple">手动调整</Tag>;
      case 'CREATE':
        return <Tag color="green">建档</Tag>;
      default:
        return <Tag>{t}</Tag>;
    }
  };

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: '商品', dataIndex: 'product_name', width: 160 },
      {
        title: '类型',
        dataIndex: 'change_type',
        width: 120,
        render: (val: string) => changeTypeLabel(val),
      },
      {
        title: '变动',
        dataIndex: 'quantity',
        width: 100,
        render: (val: number) => (
          <span style={{ color: val >= 0 ? '#3f8600' : '#cf1322', fontWeight: 600 }}>
            {val >= 0 ? `+${val}` : val}
          </span>
        ),
      },
      { title: '变动前', dataIndex: 'previous_stock', width: 100 },
      { title: '变动后', dataIndex: 'current_stock', width: 100 },
      {
        title: '关联单据',
        dataIndex: 'reference_id',
        width: 120,
        render: (val: number | null) => (val ? val : '-'),
      },
      { title: '时间', dataIndex: 'created_at', width: 180 },
    ],
    [],
  );

  const exportLogs = () => {
    const rows = logs.map((l) => ({
      ID: l.id,
      商品: l.product_name,
      类型: l.change_type,
      变动: l.quantity,
      变动前: l.previous_stock,
      变动后: l.current_stock,
      关联单据: l.reference_id ?? '',
      时间: l.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存流水');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `库存流水_${today}.xlsx`);
    message.success('已导出');
  };

  const onDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      loadLogs(productId, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
    } else {
      loadLogs(productId);
    }
  };

  return (
    <div>
      <h2>库存流水</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Select<number>
            allowClear
            style={{ width: 240 }}
            placeholder="筛选商品（可选）"
            value={productId}
            onChange={(val) => {
              const next = val ?? undefined;
              setProductId(next);
              if (dateRange && dateRange[0] && dateRange[1]) {
                loadLogs(next, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
              } else {
                loadLogs(next);
              }
            }}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            showSearch
            optionFilterProp="label"
          />
          <DatePicker.RangePicker value={dateRange} onChange={onDateChange} />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadLogs(productId)}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportLogs} disabled={!logs.length}>
            导出
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={logs}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
};

export default InventoryLogs;

