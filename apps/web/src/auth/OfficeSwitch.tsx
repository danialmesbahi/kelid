import { useState } from 'react';
import { Icon } from '@kelid/ui';
import { toFaDigits } from '@kelid/core';
import { getSyncTarget } from '../data';
import { useAuth } from './AuthContext';
import './officeSwitch.css';

/**
 * دیتابیس این دستگاه مال دفتر دیگری است. اطلاعات یک دفتر هرگز در حساب دفتر دیگر دیده یا فرستاده نمی‌شود،
 * پس تا کاربر تصمیم نگرفته خود برنامه باز نمی‌شود.
 */
export function OfficeSwitch({ pending, onCleared }: { pending: number; onCleared: () => void }) {
  const { session, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    const target = getSyncTarget();
    if (!target || busy) return;
    setBusy(true);
    try {
      await target.store.resetLocalData();
      target.refresh();
      onCleared();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ofs" role="dialog" aria-modal="true" aria-labelledby="ofs-title">
      <div className="ofs-card card enter">
        <span className="ofs-ic" aria-hidden="true"><Icon name="shield" size="l" /></span>
        <h1 id="ofs-title" className="t2">این دستگاه اطلاعات دفتر دیگری را دارد</h1>
        <p className="ofs-p">
          برای امنیت، اطلاعات یک دفتر هیچ‌وقت در حساب دفتر دیگری دیده یا فرستاده نمی‌شود. برای ادامه با «{session?.office.name || 'دفتر شما'}»،
          اطلاعات قبلی از این دستگاه پاک می‌شود؛ نسخهٔ آن روی سرور، در حساب دفتر خودش، سالم می‌ماند.
        </p>
        {pending > 0 && (
          <p className="ofs-warn" role="alert">
            <Icon name="warn" size="s" />
            <span>
              {toFaDigits(pending)} تغییر از دفتر قبلی هنوز به سرور نرسیده و با پاک کردن از بین می‌رود. اگر لازمشان دارید، اول خارج شوید و با حساب همان دفتر وارد شوید تا همگام شوند.
            </span>
          </p>
        )}
        <div className="ofs-actions">
          <button type="button" className="btn btn-g btn-lg" onClick={() => void signOut()} disabled={busy}>خروج</button>
          <button type="button" className="btn btn-d btn-lg" onClick={() => void wipe()} disabled={busy} aria-busy={busy}>
            {busy ? 'لحظه‌ای صبر کنید…' : 'پاک کردن و ادامه'}
          </button>
        </div>
      </div>
    </div>
  );
}
