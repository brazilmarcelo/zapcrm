'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { BrandingConfig } from '@/types/branding';
import { DEFAULT_BRANDING } from '@/lib/branding/defaults';

interface BrandingContextValue {
  branding: BrandingConfig;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  setBranding: React.Dispatch<React.SetStateAction<BrandingConfig>>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch('/api/branding', {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao carregar branding (HTTP ${res.status})`);
      }

      setBranding({
        ...DEFAULT_BRANDING,
        ...(data?.branding || {}),
      });
    } catch (error) {
      console.warn('[Branding] Falha ao carregar branding:', error);
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  const value = useMemo(
    () => ({ branding, loading, refreshBranding, setBranding }),
    [branding, loading, refreshBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
