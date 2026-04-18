import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Send,
  LogOut,
  Lock,
  FileText,
  FileCheck,
  History,
  Settings,
  Users,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inbound from './pages/Inbound';
import Outbound from './pages/Outbound';
import ChangePassword from './pages/ChangePassword';
import Report from './pages/Report';
import InventoryLogs from './pages/InventoryLogs';
import Partners from './pages/Partners';
import Statements from './pages/Statements';
import InventoryCheck from './pages/InventoryCheck';
import SettingsPage from './pages/Settings';
import { Toaster } from '@/components/ui/sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentMenu, setCurrentMenu] = useState('dashboard');
  const [loading, setLoading] = useState(true);

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
    { key: 'dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: '数据概览' },
    { key: 'products', icon: <ShoppingBag className="h-5 w-5" />, label: '商品管理' },
    { key: 'inbound', icon: <ShoppingCart className="h-5 w-5" />, label: '入库管理' },
    { key: 'outbound', icon: <Send className="h-5 w-5" />, label: '出库管理' },
    { key: 'inventory-logs', icon: <History className="h-5 w-5" />, label: '库存流水' },
    { key: 'inventory-check', icon: <ShieldCheck className="h-5 w-5" />, label: '库存盘点' },
    { key: 'partners', icon: <Users className="h-5 w-5" />, label: '往来单位' },
    { key: 'statements', icon: <FileCheck className="h-5 w-5" />, label: '对账与统计' },
    { key: 'report', icon: <FileText className="h-5 w-5" />, label: '经营报告' },
  ];

  const bottomMenuItems = [
    { key: 'settings', icon: <Settings className="h-5 w-5" />, label: '系统设置' },
    { key: 'change-password', icon: <Lock className="h-5 w-5" />, label: '修改密码' },
    { key: 'logout', icon: <LogOut className="h-5 w-5" />, label: '退出登录', isDanger: true },
  ];

  const renderContent = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <Dashboard onChangeMenu={setCurrentMenu} />;
      case 'products':
        return <Products />;
      case 'inbound':
        return <Inbound />;
      case 'outbound':
        return <Outbound />;
      case 'partners':
        return <Partners />;
      case 'statements':
        return <Statements />;
      case 'report':
        return <Report />;
      case 'inventory-logs':
        return <InventoryLogs />;
      case 'inventory-check':
        return <InventoryCheck />;
      case 'change-password':
        return <ChangePassword />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const item = [...menuItems, ...bottomMenuItems].find(i => i.key === currentMenu);
    return item ? item.label : '进销存系统';
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <Toaster />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-muted/40 overflow-hidden text-foreground">
      <Toaster />
      
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 z-20 shadow-xl">
        <div className="h-16 flex items-center justify-center font-bold text-xl tracking-tight text-white border-b border-slate-800">
          进销存系统
        </div>
        
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setCurrentMenu(item.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  currentMenu === item.key 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-slate-800 space-y-1 bg-slate-950/50">
          {bottomMenuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === 'logout') {
                  handleLogout();
                } else {
                  setCurrentMenu(item.key);
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                item.isDanger
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : currentMenu === item.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "hover:bg-slate-800 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-16 flex-shrink-0 flex items-center px-8 border-b bg-card shadow-sm z-10">
          <h1 className="text-xl font-semibold tracking-tight">
            {getPageTitle()}
          </h1>
        </header>
        
        <div className="flex-1 overflow-auto p-8 relative">
          <div className="mx-auto max-w-7xl h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
