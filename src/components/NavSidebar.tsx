'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useSalon } from '@/contexts/SalonContext';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'pos',
    label: 'New Sale',
    href: '/pos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'clients',
    label: 'Clients',
    href: '/clients',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'services',
    label: 'Services',
    href: '/services',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'staff',
    label: 'Staff',
    href: '/staff',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const { salon } = useSalon();
  const [fabOpen, setFabOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const primaryColor = salon?.theme_primary_color || '#E31C23';
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Hide on login page
  if (pathname === '/login' || pathname === '/') return null;

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <>
      {/* ── Desktop: Thin left sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-16 flex-col bg-white border-r border-gray-200 shadow-sm z-30">
        {/* Brand mark */}
        <div className="flex items-center justify-center h-16 border-b border-gray-100 shrink-0">
          {salon?.logo_url ? (
            <Image
              src={salon.logo_url}
              alt={salon.name}
              width={36}
              height={36}
              className="w-9 h-9 object-contain rounded-lg"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {salon?.name?.charAt(0) || 'S'}
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center py-4 gap-1 overflow-visible">
          {NAV_ITEMS.map(item => (
            <div key={item.id} className="relative group w-full flex justify-center">
              <Link
                href={item.href}
                className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
                  isActive(item.href)
                    ? 'text-white shadow-md'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                style={isActive(item.href) ? { backgroundColor: primaryColor } : {}}
              >
                {item.icon}
                {/* Active dot */}
                {isActive(item.href) && (
                  <span
                    className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </Link>

              {/* Tooltip */}
              <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                  <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                    {item.label}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom buttons */}
        <div className="shrink-0 flex flex-col items-center pb-4 gap-2">
          <div className="w-10 h-px bg-gray-100" />
          {/* Search */}
          <div className="relative group flex justify-center w-full">
            <button
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
                )
              }
              className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  Search  <kbd className="opacity-60">Ctrl K</kbd>
                </span>
              </div>
            </div>
          </div>
          {/* Logout */}
          <div className="relative group flex justify-center w-full">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">Logout</span>
              </div>
            </div>
          </div>
          {/* Shortcuts help */}
          <div className="relative group flex justify-center w-full">
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="pointer-events-none absolute left-14 bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-900 rotate-45 -mr-1 rounded-sm" />
                <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  Keyboard shortcuts
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile: Floating Action Button ── */}
      <div className="md:hidden fixed bottom-6 right-6 z-40 flex flex-col-reverse items-center gap-3">
        {/* Speed-dial items (visible when open) */}
        {fabOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[-1]"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
              onClick={() => setFabOpen(false)}
            />
            {/* Logout item */}
            <div
              className="flex items-center gap-3"
              style={{ animation: `fabItemIn 0.15s ease-out 0s both` }}
            >
              <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                Logout
              </span>
              <button
                onClick={() => { setFabOpen(false); handleLogout(); }}
                className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg bg-red-50 text-red-500 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
            {[...NAV_ITEMS].reverse().map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-3"
                style={{
                  animation: `fabItemIn 0.15s ease-out ${(idx + 1) * 0.03}s both`,
                }}
              >
                <span className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                  {item.label}
                </span>
                <Link
                  href={item.href}
                  onClick={() => setFabOpen(false)}
                  className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all ${
                    isActive(item.href) ? 'text-white' : 'bg-white text-gray-600'
                  }`}
                  style={isActive(item.href) ? { backgroundColor: primaryColor } : {}}
                >
                  {item.icon}
                </Link>
              </div>
            ))}
          </>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setFabOpen(prev => !prev)}
          className="flex items-center justify-center w-14 h-14 rounded-full shadow-xl text-white transition-all active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          {fabOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Shortcuts modal ── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 4a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h2 className="font-semibold text-gray-900">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Shortcuts list */}
            <div className="px-5 py-4 space-y-1">
              {[
                { keys: ['Ctrl', 'K'], label: 'Open command palette / search', category: 'Navigation' },
                { keys: ['Alt', 'N'],  label: 'Go to POS — new transaction',   category: 'Navigation' },
                { keys: ['Esc'],       label: 'Go back to previous page',       category: 'Navigation' },
                { keys: ['↑', '↓'],   label: 'Move through palette results',   category: 'Palette' },
                { keys: ['↵'],         label: 'Navigate to selected page',      category: 'Palette' },
                { keys: ['Esc'],       label: 'Close palette',                  category: 'Palette' },
              ].reduce<{ category: string; items: { keys: string[]; label: string; category: string }[] }[]>((acc, s, i, arr) => {
                if (i === 0 || arr[i - 1].category !== s.category)
                  acc.push({ category: s.category, items: [] });
                acc[acc.length - 1].items.push(s);
                return acc;
              }, []).map(group => (
                <div key={group.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 mt-3 first:mt-0">{group.category}</p>
                  {group.items.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600">{s.label}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        {s.keys.map((k, ki) => (
                          <kbd key={ki} className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">Click anywhere outside to close</p>
            </div>
          </div>
        </div>
      )}

      {/* FAB animation keyframes */}
      <style>{`
        @keyframes fabItemIn {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0)   scale(1);   }
        }
      `}</style>
    </>
  );
}
