import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, message, Space, Typography, Alert, Modal } from 'antd';
import { SaveOutlined, DownloadOutlined, UploadOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { getLowStockThreshold, setLowStockThreshold as saveLowStockThreshold } from '../utils/settings';
import { getTauriErrorMessage } from '../utils/tauriError';

const { Title, Text } = Typography;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const threshold = await getLowStockThreshold();
      form.setFieldsValue({ lowStockThreshold: threshold });
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = async (values: any) => {
    setSaving(true);
    try {
      await saveLowStockThreshold(values.lowStockThreshold);
      message.success('基础设置保存成功');
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const filePath = await save({
        title: '导出数据库备份',
        defaultPath: `inventory_backup_${new Date().toISOString().slice(0, 10)}.sqlite`,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      });

      if (!filePath) return;

      const hide = message.loading('正在备份数据...', 0);
      try {
        await invoke('backup_database', { targetPath: filePath });
        hide();
        message.success('数据备份成功');
      } catch (error) {
        hide();
        message.error(getTauriErrorMessage(error) || '备份失败');
      }
    } catch (error) {
      console.error('备份过程发生错误:', error);
    }
  };

  const handleRestore = async () => {
    try {
      const filePath = await open({
        title: '选择要恢复的数据库备份文件',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
        multiple: false,
      });

      if (!filePath) return;

      Modal.confirm({
        title: '确认恢复数据？',
        content: (
          <div>
            <p style={{ color: 'red', fontWeight: 'bold' }}>
              此操作将完全覆盖当前的所有数据，并且不可撤销！
            </p>
            <p>恢复完成后，应用程序将会自动重载以应用新的数据。</p>
          </div>
        ),
        okText: '确认覆盖并恢复',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          const hide = message.loading('正在恢复数据...', 0);
          try {
            await invoke('restore_database', { sourcePath: filePath });
            hide();
            message.success('数据恢复成功，即将重新加载应用');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (error) {
            hide();
            message.error(getTauriErrorMessage(error) || '恢复失败');
          }
        },
      });
    } catch (error) {
      console.error('恢复过程发生错误:', error);
    }
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>系统设置</Title>
      
      <Card title={<Space><SettingOutlined /> 基础设置</Space>} style={{ marginBottom: 24 }} loading={loading}>
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={handleSaveGeneralSettings}
          style={{ maxWidth: 400 }}
        >
          <Form.Item 
            name="lowStockThreshold" 
            label="低库存预警阈值" 
            tooltip="当商品库存等于或低于此值时，将在首页数据概览和商品列表中触发预警"
            rules={[{ required: true, message: '请输入预警阈值' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title={<Space><DatabaseOutlined /> 数据管理</Space>}>
        <Alert 
          message="数据安全" 
          description="建议定期备份数据库文件，以防数据丢失。恢复数据将覆盖当前所有数据，请谨慎操作。" 
          type="info" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
        <Space size="middle" direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fafafa', borderRadius: 4 }}>
            <div>
              <Text strong>导出数据库备份</Text>
              <br/>
              <Text type="secondary">将当前所有数据导出为一个备份文件 (.sqlite)</Text>
            </div>
            <Button icon={<DownloadOutlined />} onClick={handleBackup}>
              备份数据
            </Button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fafafa', borderRadius: 4 }}>
            <div>
              <Text strong>从备份文件恢复</Text>
              <br/>
              <Text type="danger">注意：此操作将清空并覆盖当前所有数据</Text>
            </div>
            <Button danger icon={<UploadOutlined />} onClick={handleRestore}>
              恢复数据
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default Settings;
