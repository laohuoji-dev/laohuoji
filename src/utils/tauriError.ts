export type AppErrorPayload = {
  code?: unknown;
  message?: unknown;
};

export type AppError = {
  code: string;
  message: string;
};

export function getTauriAppError(error: unknown): AppError | null {
  if (!error) return null;

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error) as AppErrorPayload;
      if (
        parsed &&
        typeof parsed.code === 'string' &&
        typeof parsed.message === 'string'
      ) {
        return { code: parsed.code, message: parsed.message };
      }
    } catch {}
    return null;
  }

  if (typeof error === 'object') {
    const anyError = error as AppErrorPayload;
    if (typeof anyError.code === 'string' && typeof anyError.message === 'string') {
      return { code: anyError.code, message: anyError.message };
    }
  }

  return null;
}

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
