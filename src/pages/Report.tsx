import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Spin, message } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, RiseOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

interface ReportData {
  sales: number;
  purchase: number;
  profit: number;
  new_products: number;
  inbound_count: number;
  outbound_count: number;
}

interface WeeklyReport {
  current: ReportData;
  previous: ReportData;
}

const calcChange = (current: number, previous: number): string => {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
};

const Report = () => {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await invoke<WeeklyReport>('get_weekly_report');
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const c = report.current;
    const p = report.previous;
    const text = [
      '===== 经营周报 =====',
      `生成时间: ${new Date().toLocaleString()}`,
      '',
      '--- 本周数据 ---',
      `销售额: ¥${c.sales.toFixed(2)} (上周: ¥${p.sales.toFixed(2)}, ${calcChange(c.sales, p.sales)})`,
      `采购额: ¥${c.purchase.toFixed(2)} (上周: ¥${p.purchase.toFixed(2)}, ${calcChange(c.purchase, p.purchase)})`,
      `利润: ¥${c.profit.toFixed(2)} (上周: ¥${p.profit.toFixed(2)}, ${calcChange(c.profit, p.profit)})`,
      `新增商品: ${c.new_products} 个`,
      `入库单数: ${c.inbound_count} 单`,
      `出库单数: ${c.outbound_count} 单`,
      '',
      '--- 同比分析 ---',
      `销售额变化: ${calcChange(c.sales, p.sales)}`,
      `采购额变化: ${calcChange(c.purchase, p.purchase)}`,
      `利润变化: ${calcChange(c.profit, p.profit)}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `经营周报_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('报告已导出');
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>;
  }

  if (!report) {
    return <div style={{ textAlign: 'center', color: '#999' }}>暂无数据</div>;
  }

  const c = report.current;
  const p = report.previous;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>经营周报</h2>
        <Button icon={<DownloadOutlined />} onClick={exportReport}>
          导出报告
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="本周销售额"
              value={c.sales}
              prefix={<DollarOutlined />}
              precision={2}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              上周: ¥{p.sales.toFixed(2)} | 变化: {calcChange(c.sales, p.sales)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="本周采购额"
              value={c.purchase}
              prefix={<ShoppingCartOutlined />}
              precision={2}
              suffix="元"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              上周: ¥{p.purchase.toFixed(2)} | 变化: {calcChange(c.purchase, p.purchase)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="本周利润"
              value={c.profit}
              prefix={<RiseOutlined />}
              precision={2}
              suffix="元"
              valueStyle={{ color: c.profit >= 0 ? '#3f8600' : '#cf1322' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              上周: ¥{p.profit.toFixed(2)} | 变化: {calcChange(c.profit, p.profit)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="新增商品"
              value={c.new_products}
              prefix={<FileTextOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="入库单数"
              value={c.inbound_count}
              suffix="单"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              上周: {p.inbound_count} 单 | 变化: {calcChange(c.inbound_count, p.inbound_count)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="出库单数"
              value={c.outbound_count}
              suffix="单"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              上周: {p.outbound_count} 单 | 变化: {calcChange(c.outbound_count, p.outbound_count)}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Report;
