import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

// همان کلید برنامهٔ اصلی؛ index.html پیش از اولین نقاشی اعمالش می‌کند.
function read(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem('kelid.theme') ?? '"auto"') as Theme;
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && mq.matches));
    apply();
    try {
      localStorage.setItem('kelid.theme', JSON.stringify(theme));
    } catch {
      /* فقط تا بستن صفحه */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme];
}
