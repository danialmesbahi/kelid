import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './ui';
import { Login } from './Login';
import { Shell } from './Shell';
import { Offices } from './pages/Offices';
import { OfficePage } from './pages/OfficePage';
import { Payments } from './pages/Payments';
import { Plans } from './pages/Plans';
import { Beta } from './pages/Beta';
import { TicketPage, Tickets } from './pages/Tickets';

/** بی ورود فقط صفحهٔ ورود؛ هیچ داده‌ای پیش از آن از سرور خواسته نمی‌شود. */
function Gate() {
  const { admin } = useAuth();
  return admin ? <Shell /> : <Login />;
}

const router = createHashRouter([
  {
    element: <Gate />,
    children: [
      { index: true, element: <Offices /> },
      { path: 'offices/:id', element: <OfficePage /> },
      { path: 'payments', element: <Payments /> },
      { path: 'plans', element: <Plans /> },
      { path: 'tickets', element: <Tickets /> },
      { path: 'tickets/:office/:id', element: <TicketPage /> },
      { path: 'beta', element: <Beta /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
