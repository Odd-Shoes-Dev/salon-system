'use client';

import { useSalon } from '@/contexts/SalonContext';
import { useUser } from '@/contexts/UserContext';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const QUICK_ACTIONS = [
  {
    label: 'New Sale',
    href: '/pos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'New Client',
    href: '/clients?new=true',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    label: 'New Service',
    href: '/services?new=true',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
  },
  {
    label: 'New Stock Item',
    href: '/inventory?new=true',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'New Expense',
    href: '/expenses?new=true',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'New Add-on',
    href: '/addons?new=true',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

/**
 * Displays salon logo and name
 * Adapts to each salon's branding
 */
export function SalonLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { salon } = useSalon();
  
  const sizes = {
    sm: { h: 32, img: 'h-8' },
    md: { h: 48, img: 'h-12' },
    lg: { h: 64, img: 'h-16' },
  };
  
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };
  
  if (!salon) {
    return (
      <div className="flex items-center gap-3">
        <Image
          src="/assets/images/logo.png"
          alt="Blue Ox Logo"
          width={sizes[size].h}
          height={sizes[size].h}
          className={`${sizes[size].img} w-auto object-contain`}
        />
        <span className={`${textSizes[size]} font-bold text-brand-primary`}>
          Blue Ox
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      {salon.logo_url ? (
        <Image
          src={salon.logo_url}
          alt={`${salon.name} logo`}
          width={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          height={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
          className={`${sizes[size]} w-auto object-contain`}
        />
      ) : (
        <div 
          className={`${sizes[size]} ${sizes[size]} rounded-full flex items-center justify-center text-white font-bold`}
          style={{ backgroundColor: salon.theme_primary_color }}
        >
          {salon.name.charAt(0)}
        </div>
      )}
      <span 
        className={`${textSizes[size]} font-bold`}
        style={{ color: salon.theme_primary_color }}
      >
        {salon.name}
      </span>
    </div>
  );
}

/**
 * Header with salon branding
 */
export function SalonHeader({ title, children }: { title?: string; children?: React.ReactNode }) {
  const { salon } = useSalon();
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const primaryColor = salon?.theme_primary_color || '#E31C23';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <header
      className="bg-white shadow-sm border-b"
      style={{ borderBottomColor: primaryColor + '20' }}
    >
      <div className="px-4 md:px-6 py-3 md:py-4">
        {/* Single row: logo/title left, actions right */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: mobile logo | desktop title */}
          <div className="flex items-center gap-3">
            <Link href="/" className="md:hidden shrink-0">
              <SalonLogo size="md" />
            </Link>
            {title && (
              <h1 className="hidden md:block text-xl font-semibold text-gray-900">{title}</h1>
            )}
          </div>

          {/* Right: quick-actions + children + user avatar */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Quick Actions */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 rounded-lg text-sm font-medium text-white shadow-sm transition-all active:scale-95"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New</span>
                <svg
                  className={`hidden sm:block w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  {QUICK_ACTIONS.map(action => (
                    <button
                      key={action.label}
                      onClick={() => { setOpen(false); router.push(action.href); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-gray-400">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-300 transition-all"
              title="Search (Ctrl K)"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden lg:inline text-xs font-mono opacity-50 bg-white border border-gray-200 px-1 rounded">Ctrl K</kbd>
            </button>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
              className="sm:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              title="Search (Ctrl K)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {children}

            {/* User avatar — consistent across all pages */}
            {user && (
              <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-1">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize leading-tight">{user.role}</p>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                  style={{ backgroundColor: primaryColor }}
                  title={`${user.name} · ${user.role}`}
                >
                  {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile-only: page title below the top row */}
        {title && (
          <p className="mt-1 text-base font-semibold text-gray-900 md:hidden">{title}</p>
        )}
      </div>
    </header>
  );
}

/**
 * Primary button with salon branding
 */
export function BrandButton({ 
  children, 
  onClick,
  disabled,
  className = '',
  variant = 'primary'
}: { 
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}) {
  const { salon } = useSalon();
  const primaryColor = salon?.theme_primary_color || '#2563EB';
  
  const baseStyles = 'btn-touch font-semibold transition-all';
  
  const styles = {
    primary: {
      backgroundColor: primaryColor,
      color: '#fff',
    },
    secondary: {
      backgroundColor: salon?.theme_secondary_color || '#F59E0B',
      color: '#fff',
    },
    outline: {
      borderColor: primaryColor,
      color: primaryColor,
      borderWidth: '2px',
    },
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

/**
 * Card with salon accent border
 */
export function BrandCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { salon } = useSalon();
  
  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-sm border-2 ${className}`}
      style={{ borderColor: salon?.theme_primary_color + '20' }}
    >
      {children}
    </div>
  );
}
