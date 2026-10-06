import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/constants/app';
import { zustandStorage } from '@/services/storage';

import type { Language } from './translator';

interface LanguageState {
  preference: Language;
  setPreference: (preference: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: STORAGE_KEYS.language,
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
