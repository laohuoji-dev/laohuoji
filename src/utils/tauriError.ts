export type AppErrorPayload = {
  code?: unknown;
  message?: unknown;
};

export function getTauriErrorMessage(error: unknown): string {
  if (!error) return '未知错误';

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error) as AppErrorPayload;
      if (parsed && typeof parsed.message === 'string') return parsed.message;
    } catch {}
    return error;
  }

  if (typeof error === 'object') {
    const anyError = error as AppErrorPayload;
    if (typeof anyError.message === 'string') return anyError.message;
  }

  return String(error);
}
