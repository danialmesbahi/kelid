import { createContext, useContext } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { StoreProvider } from './data';
import { usePrefs } from './prefs';
import { Shell } from './layout/Shell';
import { TodayPage } from './pages/Today';
import { FilesPage } from './pages/Files';
import { FileDetailPage } from './pages/FileDetail';
import { ClientsPage } from './pages/Clients';
import { AddPage } from './pages/Add';
import { ShowPage } from './pages/Show';
import { SettingsPage } from './pages/Settings';
import { SoonPage } from './pages/Soon';
import { ToastProvider } from './layout/Toasts';
import { UpdateNotice } from './pwa';

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
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'files/:id', element: <FileDetailPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'calendar', element: <SoonPage title="تقویم" /> },
      { path: 'deals', element: <SoonPage title="قراردادها" /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '/add', element: <AddPage /> },
  { path: '/show', element: <ShowPage /> },
]);

export function App() {
  const prefs = usePrefs();
  return (
    <PrefsContext.Provider value={prefs}>
      <StoreProvider>
        <ToastProvider>
          <RouterProvider router={router} />
          <UpdateNotice />
        </ToastProvider>
      </StoreProvider>
    </PrefsContext.Provider>
  );
}
