import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useLocation, useNavigate, useRouteError } from 'react-router';
import { Icon } from '@kelid/ui';
import { captureError } from '../beta/beta';

/**
 * جای صفحهٔ انگلیسی پیش‌فرض React Router: نشانی ناشناخته یا خطای یک صفحه.
 * داخل Shell نوار کناری می‌ماند؛ بیرون از آن (فرم‌های تمام‌صفحه) خودش کل صفحه را می‌گیرد.
 */
export function RouteError({ full = false }: { full?: boolean }) {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // خطای واقعی به گزارش خطاهای نسخهٔ آزمایشی می‌رود؛ نشانی اشتباه خطای برنامه نیست.
  useEffect(() => {
    if (!notFound) captureError(error);
  }, [error, notFound]);

  return (
    <div role="alert" className={full ? 'rterr full' : 'rterr'}>
      <span className="rterr-i"><Icon name={notFound ? 'search' : 'warn'} /></span>
      <h1 className="t2" style={{ margin: 0 }}>{notFound ? 'این صفحه پیدا نشد' : 'این صفحه درست باز نشد'}</h1>
      <p className="mute" style={{ margin: 0 }}>
        {notFound ? 'شاید نشانی عوض شده باشد. از صفحهٔ امروز ادامه دهید.' : 'اطلاعات شما سر جایش است. یک بار دیگر امتحان کنید؛ اگر باز تکرار شد، گزارشش برای ما آمده است.'}
      </p>
      <div className="rw" style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!notFound && (
          <button type="button" className="btn btn-p" onClick={() => navigate(pathname + search, { replace: true })}>دوباره امتحان کنید</button>
        )}
        <Link viewTransition className={notFound ? 'btn btn-p' : 'btn btn-g'} to="/">رفتن به امروز</Link>
      </div>
    </div>
  );
}
