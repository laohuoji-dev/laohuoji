import { useState, useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  SendOutlined,
  LogoutOutlined,
  LockOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inbound from './pages/Inbound';
import Outbound from './pages/Outbound';
import ChangePassword from './pages/ChangePassword';
import Report from './pages/Report';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    // 初始化数据库
    invoke('init_database')
      .then(() => setLoading(false))
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        setLoading(false);
      });
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '数据概览' },
    { key: 'products', icon: <ShoppingOutlined />, label: '商品管理' },
    { key: 'inbound', icon: <ShoppingCartOutlined />, label: '入库管理' },
    { key: 'outbound', icon: <SendOutlined />, label: '出库管理' },
    { key: 'report', icon: <FileTextOutlined />, label: '经营报告' },
  ];

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'inbound':
        return <Inbound />;
      case 'outbound':
        return <Outbound />;
      case 'report':
        return <Report />;
      case 'change-password':
        return <ChangePassword />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      加载中...
    </div>;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
        }}>
          进销存系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => setCurrentPage(key)}
        />
        <Menu
          theme="dark"
          mode="inline"
          style={{ position: 'absolute', bottom: 0, width: '100%' }}
          items={[
            {
              key: 'change-password',
              icon: <LockOutlined />,
              label: '修改密码',
              onClick: () => setCurrentPage('change-password'),
            },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: '退出登录',
              onClick: handleLogout,
            },
          ]}
        />
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: 18, fontWeight: 'bold' }}>
            {menuItems.find((item) => item.key === currentPage)?.label || (currentPage === 'change-password' ? '修改密码' : '')}
          </div>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
