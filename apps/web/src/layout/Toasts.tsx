import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@kelid/ui';

type Toast = { id: number; text: string; action?: { label: string; run: () => void }; leaving?: boolean };
type Notify = (text: string, action?: { label: string; run: () => void }) => void;

const ToastContext = createContext<Notify>(() => undefined);

/** اعلان‌های کوچک پایین صفحه، مثل «فایل ثبت شد» با دکمهٔ «برگرداندن». */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 220);
  }, []);

  const notify = useCallback<Notify>(
    (text, action) => {
      const id = ++seq.current;
      setToasts((ts) => [...ts.slice(-2), { id, text, action }]);
      setTimeout(() => dismiss(id), action ? 6000 : 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.leaving ? 'out' : ''}`}>
            <Icon name="check" size="s" thick />
            <span className="sp sm">{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
