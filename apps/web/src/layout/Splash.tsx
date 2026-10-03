/** صفحهٔ شروع: فقط اگر باز شدن دیتابیس بیش از ۱۵۰ میلی‌ثانیه طول بکشد ظاهر می‌شود. */
export function Splash({ error }: { error?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="plq">کلید</span>
      {error ? <span className="mute sm">{error}</span> : <span className="line" aria-label="در حال آماده‌سازی" />}
    </div>
  );
}
