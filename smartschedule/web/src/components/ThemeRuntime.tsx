'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { applyTheme, getBasicPreferences, setBasicPreferences } from '@/lib/preferences';

export default function ThemeRuntime() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(getBasicPreferences().theme);
    const storage = (event: StorageEvent) => {
      if (!event.key || event.key === 'smartschedule.basicPreferences') update();
    };
    update();
    // Keep the workspace appearance consistent on every signed-in page, not
    // only after the user visits Settings.
    if (window.localStorage.getItem('smartschedule_token')) {
      api.settings.get().then((saved: any) => {
        if (saved?.basic) setBasicPreferences(saved.basic);
      }).catch(() => { /* Retain the cached theme while offline. */ });
    }
    media.addEventListener('change', update);
    window.addEventListener('storage', storage);
    window.addEventListener('smartschedule:preferences-changed', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', storage);
      window.removeEventListener('smartschedule:preferences-changed', update);
    };
  }, []);
  return null;
}
