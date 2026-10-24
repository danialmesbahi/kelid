import { useEffect, useState } from 'react';
import { usePrefsContext } from '../App';
import { useAuth, useMember } from '../auth/AuthContext';
import { flushProfile, queueProfile } from '../auth/profile';
import { loadCities, loadCity, type CityPlaces, type CityRef } from './places';

/** دادهٔ شهر؛ تا بار شود undefined، شهری که داده ندارد null. */
export function useCityPlaces(city: string): CityPlaces | null | undefined {
  const [got, setGot] = useState<{ city: string; data: CityPlaces | null }>();
  useEffect(() => {
    let live = true;
    loadCity(city).then(
      (data) => live && setGot({ city, data }),
      () => live && setGot({ city, data: null }),
    );
    return () => {
      live = false;
    };
  }, [city]);
  return got?.city === city ? got.data : undefined;
}

export function useCities(): CityRef[] | undefined {
  const [all, setAll] = useState<CityRef[]>();
  useEffect(() => {
    let live = true;
    void loadCities().then((c) => live && setAll(c));
    return () => {
      live = false;
    };
  }, []);
  return all;
}

/** شهر دفتر؛ عوض کردنش با حساب کلید روی سرور هم می‌رود تا همکاران همان پیشنهادها را ببینند (فقط مدیر). */
export function useOfficeCity(): { city: string; setCity: (c: string) => void; canEdit: boolean } {
  const { city, setCity } = usePrefsContext();
  const { status, api, withToken, setNames } = useAuth();
  const { manager } = useMember();
  const signedIn = status === 'signedIn' && !!api;
  return {
    city,
    canEdit: !signedIn || manager,
    setCity: (c: string) => {
      setCity(c);
      if (!signedIn || !c) return;
      queueProfile({ city: c });
      void flushProfile(api, withToken, (r) => void setNames(r.name, r.officeName, r.city));
    },
  };
}
