import { createContext, useContext, useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { StoreProvider } from './data';
import { usePrefs } from './prefs';
import { Shell } from './layout/Shell';
import { ScrollMemory } from './layout/ScrollMemory';
import { TodayPage } from './pages/Today';
import { FilesPage } from './pages/Files';
import { FileDetailPage } from './pages/FileDetail';
import { ClientsPage } from './pages/Clients';
import { AddPage } from './pages/Add';
import { EditClientPage, NewClientPage } from './pages/ClientForm';
import { EditListingPage } from './pages/EditListing';
import { ShowPage } from './pages/Show';
import { SettingsPage } from './pages/Settings';
import { CalendarPage } from './calendar/CalendarPage';
import { DealsPage } from './deals/DealsPage';
import { ToastProvider } from './layout/Toasts';
import { UpdateNotice } from './pwa';
import { Welcome } from './welcome/Welcome';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SyncRunner } from './sync/SyncRunner';
import { Greeting } from './auth/Greeting';
import { Login } from './auth/Login';

type Prefs = ReturnType<typeof usePrefs>;
const PrefsContext = createContext<Prefs | null>(null);
export function usePrefsContext(): Prefs {
  const p = useContext(PrefsContext);
  if (!p) throw new Error('PrefsContext missing');
  return p;
}

// مسیریابی با # تا در Electron (file://) و هر میزبان وبی بدون تنظیم سرور کار کند.
const router = createHashRouter([
  {
    // همهٔ صفحه‌ها زیر یک لایه تا جای اسکرول بین آن‌ها درست مدیریت شود
    element: <ScrollMemory />,
    children: [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <TodayPage /> },
          { path: 'files', element: <FilesPage /> },
          { path: 'files/:id', element: <FileDetailPage /> },
          { path: 'clients', element: <ClientsPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'deals', element: <DealsPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: '/add', element: <AddPage /> },
      { path: '/clients/new', element: <NewClientPage /> },
      { path: '/clients/:id/edit', element: <EditClientPage /> },
      { path: '/files/:id/edit', element: <EditListingPage /> },
      { path: '/show', element: <ShowPage /> },
    ],
  },
]);

export function App() {
  const prefs = usePrefs();
  return (
    <PrefsContext.Provider value={prefs}>
      <AuthProvider>
        <StoreProvider>
          <ToastProvider>
            <Gate welcomed={prefs.welcomed} />
            <UpdateNotice />
          </ToastProvider>
        </StoreProvider>
      </AuthProvider>
    </PrefsContext.Provider>
  );
}

/** بدون سرور (VITE_KELID_API_URL) مثل قبل؛ با سرور، تا ورود نشده خود برنامه ساخته نمی‌شود. */
function Gate({ welcomed }: { welcomed: boolean }) {
  const { status } = useAuth();
  // صفحهٔ ورود بعد از ورود موفق تا پایان انیمیشن کنار رفتنش می‌ماند.
  const [loginOpen, setLoginOpen] = useState(false);
  const [afterLogin, setAfterLogin] = useState(false);
  const [greet, setGreet] = useState<'back' | 'new' | null>(null);
  const prefs = usePrefsContext();
  useEffect(() => {
    if (status === 'signedOut') setLoginOpen(true);
  }, [status]);
  const showLogin = status === 'signedOut' || loginOpen;
  const ready = status === 'off' || status === 'signedIn';
  return (
    <>
      {ready && <RouterProvider router={router} />}
      {status === 'signedIn' && <SyncRunner />}
      {showLogin && (
        <Login
          onDone={(mode) => {
            setLoginOpen(false);
            setAfterLogin(true);
            // بعد از ورود همیشه صفحهٔ امروز، نه صفحه‌ای که از آن خارج شده بود (مثلاً تنظیمات).
            void router.navigate('/', { replace: true });
            setGreet(mode === 'login' ? 'back' : 'new');
          }}
        />
      )}
      {ready && !showLogin && !welcomed && <Welcome continued={afterLogin} signedUp={status === 'signedIn'} />}
      {greet && status === 'signedIn' && !showLogin && welcomed && (
        <Greeting
          kind={greet}
          name={prefs.userName}
          office={prefs.officeName}
          onClose={() => setGreet(null)}
          onStart={() => void router.navigate('/add', { viewTransition: true })}
        />
      )}
    </>
  );
}
