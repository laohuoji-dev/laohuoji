import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { getTauriErrorMessage } from '../utils/tauriError';

const ChangePassword = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    setLoading(true);
    try {
      // Verify old password
      const valid = await invoke<boolean>('verify_password', { password: values.oldPassword });
      if (!valid) {
        message.error('旧密码错误');
        return;
      }

      // Set new password
      await invoke('change_password', { password: values.newPassword });
      message.success('密码修改成功');
      form.resetFields();
    } catch (error) {
      message.error(getTauriErrorMessage(error) || '操作失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
      <Card title="修改密码" style={{ width: 400 }}>
        <Form form={form} onFinish={handleSubmit} layout="vertical" autoComplete="off">
          <Form.Item
            name="oldPassword"
            label="旧密码"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入旧密码"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 1, message: '新密码不能为空' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入新密码"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码输入不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请确认新密码"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePassword;
