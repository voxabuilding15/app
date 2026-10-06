import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/constants/app';
import { zustandStorage } from '@/services/storage';

import { parsePreference, type Language } from './languages';

interface LanguageState {
  preference: Language;
  setPreference: (preference: Language) => void;
}

/** The chosen language, kept on the device so it survives restarts. */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: STORAGE_KEYS.language,
      storage: createJSONStorage(() => zustandStorage),
      merge: (stored, current) => ({
        ...current,
        preference: parsePreference((stored as Partial<LanguageState> | undefined)?.preference),
      }),
    },
  ),
);
