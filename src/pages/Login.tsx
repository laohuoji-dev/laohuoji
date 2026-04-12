import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [form] = Form.useForm();

  // 检查是否首次使用
  useEffect(() => {
    invoke<boolean>('has_password')
      .then((hasPassword) => {
        setIsFirstTime(!hasPassword);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (values: { password: string; confirmPassword?: string }) => {
    setLoading(true);

    try {
      if (isFirstTime) {
        // 首次设置密码
        if (values.password !== values.confirmPassword) {
          message.error('两次密码输入不一致');
          return;
        }
        await invoke('setup_password', { password: values.password });
        message.success('密码设置成功');
        onLogin();
      } else {
        // 验证密码
        const valid = await invoke<boolean>('verify_password', { password: values.password });
        if (valid) {
          message.success('登录成功');
          onLogin();
        } else {
          message.error('密码错误');
        }
      }
    } catch (error) {
      message.error('操作失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        title={isFirstTime ? '设置管理员密码' : '进销存系统'}
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      >
        <Form form={form} onFinish={handleSubmit} autoComplete="off">
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={isFirstTime ? '设置密码' : '请输入密码'}
              size="large"
            />
          </Form.Item>

          {isFirstTime && (
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次密码输入不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认密码"
                size="large"
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {isFirstTime ? '设置密码' : '登录'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
