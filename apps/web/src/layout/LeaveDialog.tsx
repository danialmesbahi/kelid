import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@kelid/ui';

/**
 * پرسش «بیرون رفتن بدون ذخیره؟» وسط صفحه، مثل یک هشدار؛ نه نوار گوشهٔ فرم که روی گوشی جا نمی‌شد.
 * Esc و کلیک بیرون = ماندن، تا کار کسی با یک اشتباه پاک نشود.
 */
export function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();
    return () => prev?.focus();
  }, []);

  // فوکوس بین دو دکمه می‌چرخد و به فرم پشت پنجره نمی‌رود
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !boxRef.current) return;
    const btns = boxRef.current.querySelectorAll<HTMLButtonElement>('button');
    const first = btns[0];
    const last = btns[btns.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div className="overlay ld-ov" onMouseDown={onStay}>
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ld-title"
        aria-describedby="ld-desc"
        className="ld pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <span className="ld-ic" aria-hidden="true"><Icon name="warn" size="l" /></span>
        <h2 id="ld-title" className="t2">تغییرات ذخیره نشده‌اند</h2>
        <p id="ld-desc" className="ld-p">اگر بدون ذخیره بیرون بروید، چیزهایی که نوشته‌اید پاک می‌شود.</p>
        <div className="ld-act">
          <button type="button" className="btn btn-s btn-lg" onClick={onLeave}>بیرون رفتن بدون ذخیره</button>
          <button ref={stayRef} type="button" className="btn btn-p btn-lg" onClick={onStay}>ادامهٔ ویرایش</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
