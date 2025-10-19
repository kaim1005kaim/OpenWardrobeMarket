import React, { createContext, useContext, ReactNode } from 'react';
import { useUrulaProfile } from '../../hooks/useUrulaProfile';
import type { UserUrulaProfile, EvolutionInput } from '../../types/urula';

interface UrulaContextValue {
  profile: UserUrulaProfile;
  loading: boolean;
  error: string | null;
  applyLocal: (delta: Partial<UserUrulaProfile>) => void;
  evolve: (input: EvolutionInput) => Promise<void>;
  reload: () => Promise<void>;
  flush: () => Promise<void>;
}

const UrulaContext = createContext<UrulaContextValue | undefined>(undefined);

export function UrulaProvider({ children }: { children: ReactNode }) {
  const urulaState = useUrulaProfile();

  return (
    <UrulaContext.Provider value={urulaState}>
      {children}
    </UrulaContext.Provider>
  );
}

export function useUrula(): UrulaContextValue {
  const context = useContext(UrulaContext);
  if (!context) {
    throw new Error('useUrula must be used within UrulaProvider');
  }
  return context;
}
