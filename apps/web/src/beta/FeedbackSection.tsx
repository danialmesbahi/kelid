import { useState } from 'react';
import { Icon, type IconName } from '@kelid/ui';
import { FeedbackDialog } from './FeedbackDialog';
import type { FeedbackKind } from './beta';

const START: Array<{ kind: FeedbackKind; icon: IconName; label: string }> = [
  { kind: 'problem', icon: 'msg', label: 'مشکلی دیدم' },
  { kind: 'idea', icon: 'spark', label: 'پیشنهاد دارم' },
];

/** تنظیمات ← نظر شما: راه مستقیم به تیم کلید. */
export function FeedbackSection() {
  const [open, setOpen] = useState<FeedbackKind | null>(null);
  return (
    <section aria-labelledby="fb" className="card col" style={{ padding: 24, gap: 14 }}>
      <div className="col" style={{ gap: 4 }}>
        <h2 id="fb" className="t2">
          نظر شما
        </h2>
        <span className="sm mute">کلید هنوز در حال ساخته شدن است. هر مشکل یا پیشنهادی دارید مستقیم به تیم کلید برسانید.</span>
      </div>
      <div className="rw" style={{ gap: 10, flexWrap: 'wrap' }}>
        {START.map((s) => (
          <button key={s.kind} type="button" className="btn btn-g" onClick={() => setOpen(s.kind)}>
            <Icon name={s.icon} size="s" />
            {s.label}
          </button>
        ))}
      </div>
      {open && <FeedbackDialog initial={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
