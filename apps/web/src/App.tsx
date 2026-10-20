import { createContext, useContext, useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { getSyncTarget, StoreProvider } from './data';
import { usePrefs } from './prefs';
import { Shell } from './layout/Shell';
import { ScrollMemory } from './layout/ScrollMemory';
import { useDesktopHistoryKeys } from './layout/useGoBack';
import { RouteError } from './layout/RouteError';
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
import { SupportPage, TicketRoute } from './support/SupportPage';
import { ToastProvider } from './layout/Toasts';
import { UpdateNotice } from './pwa';
import { Welcome } from './welcome/Welcome';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { SyncRunner } from './sync/SyncRunner';
import { BetaRunner } from './beta/BetaRunner';
import { Greeting } from './auth/Greeting';
import { Login } from './auth/Login';
import { OfficeSwitch } from './auth/OfficeSwitch';
import { takeJoining } from './auth/storage';
import { PlansPage } from './billing/PlansPage';
import { ReadOnlyToast, WriteGate } from './billing/LicenseUi';

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
    // نشانی ناشناخته یا خطای فرم‌های تمام‌صفحه: صفحهٔ فارسی به جای صفحهٔ انگلیسی پیش‌فرض.
    errorElement: <RouteError full />,
    children: [
      {
        path: '/',
        element: <Shell />,
        children: [
          {
            // خطای یک صفحه فقط جای همان صفحه را می‌گیرد و نوار کناری سر جایش می‌ماند.
            errorElement: <RouteError />,
            children: [
              { index: true, element: <TodayPage /> },
              { path: 'files', element: <FilesPage /> },
              { path: 'files/:id', element: <FileDetailPage /> },
              { path: 'clients', element: <ClientsPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'deals', element: <DealsPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'plans', element: <PlansPage /> },
              { path: 'support', element: <SupportPage /> },
              { path: 'support/:id', element: <TicketRoute /> },
            ],
          },
        ],
      },
      // فرم‌های ثبت و ویرایش بعد از پایان اشتراک به جای فرمی که ذخیره نمی‌شود، راه تمدید را نشان می‌دهند.
      { path: '/add', element: <WriteGate><AddPage /></WriteGate> },
      { path: '/clients/new', element: <WriteGate><NewClientPage /></WriteGate> },
      { path: '/clients/:id/edit', element: <WriteGate><EditClientPage /></WriteGate> },
      { path: '/files/:id/edit', element: <WriteGate><EditListingPage /></WriteGate> },
      { path: '/show', element: <ShowPage /> },
    ],
  },
]);

export function App() {
  const prefs = usePrefs();
  useDesktopHistoryKeys();
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

const goPlans = (to: string) => void router.navigate(to, { viewTransition: true });

type OfficeCheck = { office: string; state: 'ok' } | { office: string; state: 'other'; pending: number };

/**
 * دیتابیس این دستگاه مال همین دفتر است؟ تا جواب نیامده (چند میلی‌ثانیه) برنامه باز نمی‌شود،
 * تا اطلاعات دفتر دیگری حتی یک لحظه در این حساب دیده نشود.
 */
function useOfficeCheck(office: string | undefined): [OfficeCheck | null, () => void] {
  const [check, setCheck] = useState<OfficeCheck | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const target = getSyncTarget();
    if (!office) return;
    if (!target) return setCheck({ office, state: 'ok' });
    let live = true;
    void target.store.syncInfo().then(async (i) => {
      let other = !!i.office && i.office !== office;
      if (other && !i.pending && takeJoining(office)) {
        await target.store.resetLocalData();
        target.refresh();
        other = false;
      }
      if (live) setCheck(other ? { office, state: 'other', pending: i.pending } : { office, state: 'ok' });
    });
    return () => {
      live = false;
    };
  }, [office, round]);
  return [check && check.office === office ? check : null, () => setRound((r) => r + 1)];
}

/** بدون سرور (VITE_KELID_API_URL) مثل قبل؛ با سرور، تا ورود نشده خود برنامه ساخته نمی‌شود. */
function Gate({ welcomed }: { welcomed: boolean }) {
  const { status, session } = useAuth();
  const [check, recheck] = useOfficeCheck(status === 'signedIn' ? session?.office.id : undefined);
  // صفحهٔ ورود بعد از ورود موفق تا پایان انیمیشن کنار رفتنش می‌ماند.
  const [loginOpen, setLoginOpen] = useState(false);
  const [afterLogin, setAfterLogin] = useState(false);
  const [greet, setGreet] = useState<'back' | 'new' | 'joined' | null>(null);
  const prefs = usePrefsContext();
  useEffect(() => {
    if (status === 'signedOut') setLoginOpen(true);
  }, [status]);
  const showLogin = status === 'signedOut' || loginOpen;
  const ready = status === 'off' || (status === 'signedIn' && check?.state === 'ok');
  return (
    <>
      {ready && <RouterProvider router={router} />}
      {ready && status === 'signedIn' && <SyncRunner />}
      {ready && status === 'signedIn' && <BetaRunner />}
      {ready && status === 'signedIn' && <ReadOnlyToast go={goPlans} />}
      {status === 'signedIn' && check?.state === 'other' && !showLogin && <OfficeSwitch pending={check.pending} onCleared={recheck} />}
      {showLogin && (
        <Login
          onDone={(mode) => {
            setLoginOpen(false);
            setAfterLogin(true);
            // بعد از ورود همیشه صفحهٔ امروز، نه صفحه‌ای که از آن خارج شده بود (مثلاً تنظیمات).
            void router.navigate('/', { replace: true });
            // دفتر تازه آشنایی کامل خودش را دارد؛ کارت خوش‌آمد فقط برای ورود دوباره.
            setGreet(mode === 'login' ? 'back' : mode === 'join' ? 'joined' : null);
          }}
        />
      )}
      {ready && !showLogin && !welcomed && (
        <Welcome continued={afterLogin} signedUp={status === 'signedIn'} onStart={(to) => void router.navigate(to, { viewTransition: true })} />
      )}
      {greet && ready && status === 'signedIn' && !showLogin && welcomed && (
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
