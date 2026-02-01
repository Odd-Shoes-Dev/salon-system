'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Salon } from '@/types';

interface SalonContextType {
  salon: Salon | null;
  loading: boolean;
}

const SalonContext = createContext<SalonContextType>({
  salon: null,
  loading: true,
});

interface SalonProviderProps {
  children: ReactNode;
  initialSalon: Salon | null;
}

/**
 * Salon Context Provider
 * Provides current salon data throughout the app
 * 
 * Usage:
 * const { salon } = useSalon();
 * <h1>{salon?.name}</h1>
 */
export function SalonProvider({ children, initialSalon }: SalonProviderProps) {
  return (
    <SalonContext.Provider value={{ salon: initialSalon, loading: false }}>
      {children}
    </SalonContext.Provider>
  );
}

/**
 * Hook to access current salon
 */
export function useSalon() {
  const context = useContext(SalonContext);
  
  if (!context) {
    throw new Error('useSalon must be used within SalonProvider');
  }
  
  return context;
}

/**
 * Helper to get brand colors with fallback
 */
export function useBrandColors() {
  const { salon } = useSalon();
  
  return {
    primary: salon?.theme_primary_color || '#2563EB',
    secondary: salon?.theme_secondary_color || '#F59E0B',
  };
}
