import { Skeleton } from '@kelid/ui';
import { useSlow } from '../data';

/** اسکلت لودینگ صفحه؛ برای بارگذاری‌های سریع اصلاً نمایش داده نمی‌شود. */
export function PageSkeleton({ rows = 6, aside = false }: { rows?: number; aside?: boolean }) {
  const slow = useSlow(true);
  if (!slow) return null;
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری" className="col" style={{ padding: '26px 28px', gap: 22 }}>
      <Skeleton w={220} h={34} />
      <div style={{ display: 'flex', gap: 24 }}>
        <div className="col" style={{ flex: 3, gap: 14 }}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="rw" style={{ gap: 14 }}>
              <Skeleton w={56} h={42} r={8} />
              <div className="col sp" style={{ gap: 8 }}>
                <Skeleton w="60%" h={14} />
                <Skeleton w="35%" h={12} />
              </div>
              <Skeleton w={90} h={16} />
            </div>
          ))}
        </div>
        {aside && (
          <div className="col" style={{ flex: 2, gap: 14 }}>
            <Skeleton h={200} r={16} />
            <Skeleton w="70%" h={20} />
            <Skeleton w="40%" h={30} />
          </div>
        )}
      </div>
    </div>
  );
}
