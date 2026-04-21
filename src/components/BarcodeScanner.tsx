import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Barcode, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (product: any) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export const BarcodeScanner = ({
  onScan,
  disabled = false,
  placeholder = '扫描商品条码...',
  autoFocus = false,
}: BarcodeScannerProps) => {
  const [inputValue, setInputValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 扫码枪输入特征：快速连续输入 + 回车
  // 普通键盘输入速度约 5-10 字符/秒，扫码枪约 50-100 字符/秒
  const SCAN_SPEED_THRESHOLD = 30; // 毫秒/字符，低于此值认为是扫码

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const now = Date.now();
    setInputValue(value);

    // 检测扫码特征：如果输入速度很快，标记为扫码中
    if (value.length > 3) {
      const timeDiff = now - lastScanTime;
      const avgTimePerChar = value.length > 1 ? timeDiff / value.length : 100;
      
      if (avgTimePerChar < SCAN_SPEED_THRESHOLD || timeDiff < 100) {
        setScanning(true);
        
        // 清除之前的定时器
        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current);
        }
        
        // 设置新定时器，等待输入完成（扫码枪通常会以回车结束）
        scanTimerRef.current = setTimeout(() => {
          processBarcode(value);
        }, 100);
      }
    }
    
    setLastScanTime(now);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        processBarcode(inputValue.trim());
      }
    }
  };

  const processBarcode = async (barcode: string) => {
    if (!barcode) return;

    // 清除定时器
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    try {
      setScanning(true);
      
      // 调用后端 API 查询商品
      const product = await invoke<any>('get_product_by_barcode', { barcode });
      
      if (product) {
        onScan(product);
        toast.success(`已扫描：${product.name}`);
        // 播放成功提示音（可选）
        playBeep(880, 100);
      } else {
        toast.warning(`未找到条码对应的商品：${barcode}`);
        // 播放错误提示音
        playBeep(440, 200);
        // 可以选择弹出新建商品窗口
        // onNotFound(barcode);
      }
    } catch (error: any) {
      console.error('扫码查询失败:', error);
      toast.error('扫码查询失败，请检查网络连接');
      playBeep(440, 300);
    } finally {
      setScanning(false);
      setInputValue('');
      // 保持焦点以便连续扫码
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // 简单的蜂鸣声提示（使用 Web Audio API）
  const playBeep = (frequency: number, duration: number) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
      // 忽略音频错误（某些环境可能不支持）
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {scanning ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : inputValue ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Barcode className="h-4 w-4" />
        )}
      </div>
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="pl-10 pr-10 font-mono"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
      {inputValue && !scanning && (
        <button
          onClick={() => {
            setInputValue('');
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
