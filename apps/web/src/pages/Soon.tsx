import { Link } from 'react-router';

export function SoonPage({ title }: { title: string }) {
  return (
    <div className="bd" style={{ paddingTop: 26 }}>
      <h1 className="t1">{title}</h1>
      <div className="soft col" style={{ padding: 28, gap: 8, maxWidth: 560 }}>
        <span className="b">این بخش در فاز ۴ ساخته می‌شود.</span>
        <span className="mute">طرحش روی بوم آماده است. فعلاً کار با فایل‌ها و مشتری‌ها کامل است.</span>
        <Link className="lnk" to="/files" style={{ marginTop: 6 }}>رفتن به فایل‌ها</Link>
      </div>
    </div>
  );
}
