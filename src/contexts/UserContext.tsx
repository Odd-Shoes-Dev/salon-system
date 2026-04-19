'use client';

import { createContext, useContext, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'staff' | 'viewer' | 'manager' | 'stylist' | 'cashier';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  salon_id: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
});

interface UserProviderProps {
  children: ReactNode;
  initialUser: User | null;
}

/**
 * User Context Provider
 * Provides current authenticated user throughout the app
 */
export function UserProvider({ children, initialUser }: UserProviderProps) {
  return (
    <UserContext.Provider value={{ user: initialUser, loading: false }}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Hook to access current user
 */
export function useUser() {
  const context = useContext(UserContext);
  
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  
  return context;
}

/**
 * Check if user has permission
 */
export function usePermission(action: string): boolean {
  const { user } = useUser();
  
  if (!user) return false;
  
  const permissions: Record<string, string[]> = {
    'manage_staff':    ['owner', 'admin'],
    'manage_services': ['owner', 'admin', 'manager'],
    'manage_clients':  ['owner', 'admin', 'manager'],
    'view_reports':    ['owner', 'admin', 'manager', 'viewer'],
    'use_pos':         ['owner', 'admin', 'staff', 'manager', 'stylist', 'cashier'],
  };

  return permissions[action]?.includes(user.role) || false;
}
