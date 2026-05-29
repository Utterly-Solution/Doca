'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from './AuthGuard';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Login page: no sidebar/header, no auth guard needed
  if (isLoginPage) {
    return <>{children}</>;
  }

  // All other pages: require auth, show sidebar/header
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
