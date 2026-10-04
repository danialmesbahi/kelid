import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'vazirmatn/Vazirmatn-font-face.css';
import '@kelid/ui/kelid.css';
import '@kelid/ui/motion.css';
import './app.css';
import { App } from './App';
import { registerPwa } from './pwa';

// نصب روی گوشی و کار بدون اینترنت فقط در وب
registerPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
