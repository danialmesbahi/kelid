import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@kelid/ui';

type Toast = { id: number; text: string; action?: { label: string; run: () => void }; leaving?: boolean };
type Notify = (text: string, action?: { label: string; run: () => void }) => void;

const ToastContext = createContext<Notify>(() => undefined);

/**
 * اعلان کوچک پایین صفحه، مثل «فایل ثبت شد» با دکمهٔ «برگرداندن».
 * همیشه فقط یکی دیده می‌شود (تازه جای قبلی را می‌گیرد) تا روی صفحه انبار نشوند و جلوی کار را نگیرند؛
 * دکمهٔ × هم دارد و تا موس رویش است بسته نمی‌شود.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 220);
  }, []);

  const arm = useCallback((t: Toast) => {
    clearTimeout(timers.current.get(t.id));
    timers.current.set(t.id, setTimeout(() => dismiss(t.id), t.action ? 6000 : 3200));
  }, [dismiss]);

  const notify = useCallback<Notify>(
    (text, action) => {
      const t = { id: ++seq.current, text, action };
      // قبلی‌ها کنار می‌روند؛ فقط تازه‌ترین می‌ماند
      setToasts((ts) => [...ts.filter((x) => !x.leaving).map((x) => ({ ...x, leaving: true })), t]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => !x.leaving || x.id === t.id)), 220);
      for (const [id, h] of timers.current) if (id !== t.id) { clearTimeout(h); timers.current.delete(id); }
      arm(t);
    },
    [arm],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.leaving ? 'out' : ''}`}
            onPointerEnter={() => clearTimeout(timers.current.get(t.id))}
            onPointerLeave={() => !t.leaving && arm(t)}
          >
            <Icon name="check" size="s" thick />
            <span className="sp sm">{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-x" aria-label="بستن اعلان" onClick={() => dismiss(t.id)}>
              <Icon name="x" size="s" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
