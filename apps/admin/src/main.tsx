import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'vazirmatn/Vazirmatn-Variable-font-face.css';
import '@kelid/ui/kelid.css';
import '@kelid/ui/motion.css';
import './admin.css';
import { installLatinDigits } from '@kelid/ui';
import { App } from './App';

// رقم فارسی/عربی در همهٔ فیلدها همان لحظه انگلیسی می‌شود.
installLatinDigits();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
