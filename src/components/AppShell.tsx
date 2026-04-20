'use client';

import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/';

  return (
    <div className={isAuthPage ? '' : 'md:pl-16'}>
      {children}
    </div>
  );
}
