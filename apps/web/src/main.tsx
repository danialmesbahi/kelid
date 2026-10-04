import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'vazirmatn/Vazirmatn-font-face.css';
import '@kelid/ui/kelid.css';
import '@kelid/ui/motion.css';
import './app.css';
import { App } from './App';

// نصب روی گوشی و کار بدون اینترنت فقط در وب؛ نسخهٔ ویندوز همه‌چیز را از فایل‌های خود برنامه می‌خواند.
if (import.meta.env.PROD && !window.kelid && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
