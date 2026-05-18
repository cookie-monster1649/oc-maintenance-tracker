'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const GOD_MODE_PASSWORD = process.env.NEXT_PUBLIC_GOD_MODE_PASSWORD || 'eastmentbabes';
// Note: Uses NEXT_PUBLIC_ prefix to be accessible in client-side code

interface GodModeContextType {
  godMode: boolean;
  enable: (password: string) => boolean;
  disable: () => void;
}

const GodModeContext = createContext<GodModeContextType | undefined>(undefined);

export function GodModeProvider({ children }: { children: React.ReactNode }) {
  // Use lazy initializer to avoid setState in effect and hydration issues
  const [godMode, setGodMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('godMode') === 'true';
  });
  const [mounted, setMounted] = useState(false);

  // Mark as mounted after initial render to prevent hydration mismatch.
  // setState in effect is necessary here for hydration safety in Next.js to prevent
  // server/client state divergence when reading from localStorage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const enable = (password: string): boolean => {
    if (password === GOD_MODE_PASSWORD) {
      setGodMode(true);
      localStorage.setItem('godMode', 'true');
      return true;
    }
    return false;
  };

  const disable = () => {
    setGodMode(false);
    localStorage.removeItem('godMode');
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <GodModeContext.Provider value={{ godMode, enable, disable }}>
      {children}
    </GodModeContext.Provider>
  );
}

export function useGodMode() {
  const context = useContext(GodModeContext);
  if (context === undefined) {
    return { godMode: false, enable: () => false, disable: () => {} };
  }
  return context;
}
