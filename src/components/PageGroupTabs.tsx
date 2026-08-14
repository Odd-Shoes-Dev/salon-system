'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSalon } from '@/contexts/SalonContext';

interface Tab { label: string; href: string }

export function PageGroupTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#E31C23';

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex">
          {tabs.map(tab => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? ''
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={active ? { color: brandColor, borderColor: brandColor, borderBottomWidth: '2px' } : {}}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const CLIENT_TABS:  Tab[] = [
  { label: 'Clients',   href: '/clients' },
  { label: 'Bookings',  href: '/bookings' },
  { label: 'Birthdays', href: '/birthdays' },
];

export const SERVICE_TABS: Tab[] = [
  { label: 'Services', href: '/services' },
  { label: 'Add-ons',  href: '/addons' },
  { label: 'Coupons',  href: '/coupons' },
];

export const FINANCE_TABS: Tab[] = [
  { label: 'Accounts', href: '/accounts' },
  { label: 'Expenses', href: '/expenses' },
];

export const TEAM_TABS: Tab[] = [
  { label: 'Staff', href: '/workers' },
  { label: 'Users', href: '/staff' },
];
