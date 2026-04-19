import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Save, Download, Upload, Database, Settings as SettingsIcon, 
  Trash2, Plus, Tags, Beaker, Store, AlertCircle, Info 
} from 'lucide-react';
import { toast } from 'sonner';

import { 
  getLowStockThreshold, setLowStockThreshold as saveLowStockThreshold,
  getCategories, addCategory, deleteCategory, Category,
  getUnits, addUnit, deleteUnit, Unit,
  getCompanyInfo, setCompanyInfo as saveCompanyInfo,
  getAutoBackupConfig, setAutoBackupConfig as saveAutoBackupConfig
} from '../utils/settings';
import { getTauriErrorMessage } from '../utils/tauriError';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '../components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';

const companyFormSchema = z.object({
  name: z.string().min(1, '请输入公司/店铺名称'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const generalFormSchema = z.object({
  lowStockThreshold: z.number().min(1, '请输入预警阈值'),
});

const autoBackupFormSchema = z.object({
  enabled: z.boolean(),
  days: z.number().min(1).max(365),
});

const Settings = () => {
  const [saving, setSaving] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [autoBackupSaving, setAutoBackupSaving] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  const companyForm = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { name: '', phone: '', address: '' }
  });

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: { lowStockThreshold: 10 }
  });

  const autoBackupForm = useForm<z.infer<typeof autoBackupFormSchema>>({
    resolver: zodResolver(autoBackupFormSchema),
    defaultValues: { enabled: true, days: 7 }
  });

  useEffect(() => {
    loadSettings();
    loadCategoriesAndUnits();
  }, []);

  const loadCategoriesAndUnits = async () => {
    try {
      const [cats, uns] = await Promise.all([getCategories(), getUnits()]);
      setCategories(cats);
      setUnits(uns);
    } catch (error) {
      console.error('加载分类与单位失败:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addCategory(newCategoryName.trim());
      setNewCategoryName('');
      toast.success('分类添加成功');
      loadCategoriesAndUnits();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '添加分类失败');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCategory(id);
      toast.success('分类删除成功');
      loadCategoriesAndUnits();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '删除分类失败');
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      await addUnit(newUnitName.trim());
      setNewUnitName('');
      toast.success('单位添加成功');
      loadCategoriesAndUnits();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '添加单位失败');
    }
  };

  const handleDeleteUnit = async (id: number) => {
    try {
      await deleteUnit(id);
      toast.success('单位删除成功');
      loadCategoriesAndUnits();
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '删除单位失败');
    }
  };

  const loadSettings = async () => {
    try {
      const [threshold, companyInfo, autoBackupConfig] = await Promise.all([
        getLowStockThreshold(),
        getCompanyInfo(),
        getAutoBackupConfig()
      ]);
      generalForm.reset({ lowStockThreshold: threshold });
      companyForm.reset({
        name: companyInfo.name,
        phone: companyInfo.phone || '',
        address: companyInfo.address || '',
      });
      autoBackupForm.reset({
        enabled: autoBackupConfig.enabled,
        days: autoBackupConfig.days,
      });
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '加载设置失败');
    }
  };

  const handleSaveGeneralSettings = async (values: z.infer<typeof generalFormSchema>) => {
    setSaving(true);
    try {
      await saveLowStockThreshold(values.lowStockThreshold);
      toast.success('基础设置保存成功');
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompanyInfo = async (values: z.infer<typeof companyFormSchema>) => {
    setCompanySaving(true);
    try {
      await saveCompanyInfo({
        name: values.name,
        phone: values.phone || '',
        address: values.address || '',
      });
      toast.success('公司信息保存成功');
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '保存失败');
    } finally {
      setCompanySaving(false);
    }
  };

  const handleSaveAutoBackup = async (values: z.infer<typeof autoBackupFormSchema>) => {
    setAutoBackupSaving(true);
    try {
      await saveAutoBackupConfig(values.enabled, values.days);
      toast.success('自动备份设置已保存');
    } catch (error) {
      toast.error(getTauriErrorMessage(error) || '保存自动备份设置失败');
    } finally {
      setAutoBackupSaving(false);
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

      toast.promise(
        invoke('backup_database', { targetPath: filePath }),
        {
          loading: '正在备份数据...',
          success: '数据备份成功',
          error: (err) => getTauriErrorMessage(err) || '备份失败'
        }
      );
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

      toast.promise(
        async () => {
          await invoke('restore_database', { sourcePath: filePath });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        },
        {
          loading: '正在恢复数据...',
          success: '数据恢复成功，即将重新加载应用',
          error: (err) => getTauriErrorMessage(err) || '恢复失败'
        }
      );
    } catch (error) {
      console.error('恢复过程发生错误:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold tracking-tight">系统设置</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Store className="mr-2 h-5 w-5" />
            公司信息设置
          </CardTitle>
          <CardDescription>
            公司信息将用于打印对账单、报表等单据的抬头和落款。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit(handleSaveCompanyInfo)} className="space-y-4 max-w-md">
              <FormField
                control={companyForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司/店铺名称</FormLabel>
                    <FormControl>
                      <Input placeholder="如：老伙计五金建材批发" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={companyForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系电话</FormLabel>
                    <FormControl>
                      <Input placeholder="如：010-12345678 / 13800000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={companyForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系地址</FormLabel>
                    <FormControl>
                      <Input placeholder="如：XX市XX区XX路18号" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={companySaving}>
                <Save className="mr-2 h-4 w-4" />
                {companySaving ? '保存中...' : '保存公司信息'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <SettingsIcon className="mr-2 h-5 w-5" />
            基础设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(handleSaveGeneralSettings)} className="space-y-4 max-w-md">
              <FormField
                control={generalForm.control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>低库存预警阈值</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        {...field} 
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 1)} 
                      />
                    </FormControl>
                    <FormDescription>
                      当商品库存等于或低于此值时，将在首页数据概览和商品列表中触发预警
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '保存设置'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Tags className="mr-2 h-5 w-5" />
            分类与单位管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="categories" className="w-full max-w-2xl">
            <TabsList className="mb-4">
              <TabsTrigger value="categories" className="flex items-center">
                <Tags className="mr-2 h-4 w-4" />
                分类管理
              </TabsTrigger>
              <TabsTrigger value="units" className="flex items-center">
                <Beaker className="mr-2 h-4 w-4" />
                单位管理
              </TabsTrigger>
            </TabsList>
            <TabsContent value="categories" className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="新分类名称" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  className="max-w-[200px]"
                />
                <Button onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加分类
                </Button>
              </div>
              <div className="border rounded-md divide-y">
                {categories.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">暂无分类</div>
                ) : (
                  categories.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <span>{item.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除分类？</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除 "{item.name}" 吗？此操作无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCategory(item.id)} className="bg-destructive hover:bg-destructive/90">
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="units" className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="新单位名称" 
                  value={newUnitName} 
                  onChange={e => setNewUnitName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddUnit()}
                  className="max-w-[200px]"
                />
                <Button onClick={handleAddUnit}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加单位
                </Button>
              </div>
              <div className="border rounded-md divide-y">
                {units.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">暂无单位</div>
                ) : (
                  units.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <span>{item.name}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除单位？</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除 "{item.name}" 吗？此操作无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUnit(item.id)} className="bg-destructive hover:bg-destructive/90">
                              确认删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Database className="mr-2 h-5 w-5" />
            数据管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-base font-medium mb-2">自动备份</h3>
            <p className="text-sm text-muted-foreground mb-4">
              开启后，系统会在每次启动时检查，如果距离上次备份超过设定的天数，则会自动将数据库备份到应用数据目录下（最多保留最近 5 份）。
            </p>
            <Form {...autoBackupForm}>
              <form onSubmit={autoBackupForm.handleSubmit(handleSaveAutoBackup)} className="flex flex-wrap items-end gap-4">
                <FormField
                  control={autoBackupForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 pb-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        {field.value ? '已开启' : '已关闭'}
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={autoBackupForm.control}
                  name="days"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormLabel className="font-normal mb-0">备份周期（天）</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="365" 
                          className="w-24" 
                          {...field} 
                          onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 1)} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={autoBackupSaving}>
                  {autoBackupSaving ? '保存中...' : '保存自动备份设置'}
                </Button>
              </form>
            </Form>
          </div>

          <Separator />

          <div>
            <h3 className="text-base font-medium mb-4">手动备份与恢复</h3>
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertTitle>数据安全</AlertTitle>
              <AlertDescription>
                建议定期手动备份数据库文件，以防数据丢失。恢复数据将覆盖当前所有数据，请谨慎操作。
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-muted/30 rounded-lg border gap-4">
                <div>
                  <p className="font-medium">导出数据库备份</p>
                  <p className="text-sm text-muted-foreground">将当前所有数据导出为一个备份文件 (.sqlite)</p>
                </div>
                <Button onClick={handleBackup}>
                  <Download className="mr-2 h-4 w-4" />
                  备份数据
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-muted/30 rounded-lg border gap-4">
                <div>
                  <p className="font-medium">从备份文件恢复</p>
                  <p className="text-sm text-destructive flex items-center mt-1">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    注意：此操作将清空并覆盖当前所有数据
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Upload className="mr-2 h-4 w-4" />
                      恢复数据
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认恢复数据？</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="block text-destructive font-bold mb-2">
                          此操作将完全覆盖当前的所有数据，并且不可撤销！
                        </span>
                        <span>恢复完成后，应用程序将会自动重载以应用新的数据。</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRestore} className="bg-destructive hover:bg-destructive/90">
                        确认覆盖并恢复
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
