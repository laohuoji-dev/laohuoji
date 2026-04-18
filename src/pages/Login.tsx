import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getTauriErrorMessage } from '../utils/tauriError';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: () => void;
}

const Login = ({ onLogin }: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 检查是否首次使用
  useEffect(() => {
    invoke<boolean>('has_password')
      .then((hasPassword) => {
        setIsFirstTime(!hasPassword);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast.error('请输入密码');
      return;
    }

    setLoading(true);

    try {
      if (isFirstTime) {
        // 首次设置密码
        if (password !== confirmPassword) {
          toast.error('两次密码输入不一致');
          setLoading(false);
          return;
        }
        await invoke('setup_password', { password });
        toast.success('密码设置成功');
        onLogin();
      } else {
        // 验证密码
        const valid = await invoke<boolean>('verify_password', { password });
        if (valid) {
          toast.success('登录成功');
          onLogin();
        } else {
          toast.error('密码错误');
        }
      }
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '操作失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-700 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isFirstTime ? '设置管理员密码' : '进销存系统'}
          </CardTitle>
          <CardDescription>
            {isFirstTime ? '为了您的数据安全，请设置一个初始密码' : '请输入管理员密码以继续'}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={isFirstTime ? '设置密码' : '请输入密码'}
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {isFirstTime && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="请再次输入密码"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFirstTime ? '设置并登录' : '登录系统'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
