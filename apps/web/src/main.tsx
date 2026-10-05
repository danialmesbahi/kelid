import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// فونت متغیر: یک فایل برای همهٔ وزن‌ها به جای پنج فایل جدا
import 'vazirmatn/Vazirmatn-Variable-font-face.css';
import '@kelid/ui/kelid.css';
import '@kelid/ui/motion.css';
import './app.css';
import { App } from './App';
import { registerPwa } from './pwa';
import { openStore } from './data';

// نصب روی گوشی و کار بدون اینترنت فقط در وب
registerPwa();

// باز کردن دیتابیس هم‌زمان با اولین رندر شروع می‌شود، نه بعد از آن
void openStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
