'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';

interface Stats {
  todayRevenue: number;
  totalClients: number;
  activeServices: number;
  loyaltyMembers: number;
}

interface Visit {
  id: string;
  created_at: string;
  client: {
    name: string;
  };
  total_amount: number;
  payment_method: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [stats, setStats] = useState<Stats>({
    todayRevenue: 0,
    totalClients: 0,
    activeServices: 0,
    loyaltyMembers: 0,
  });
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const statsResponse = await fetch('/api/dashboard/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load recent visits
      const visitsResponse = await fetch('/api/visits?date=today&limit=5');
      if (visitsResponse.ok) {
        const visitsData = await visitsResponse.json();
        setRecentVisits(visitsData);
      }

      // Load today's expenses
      const expRes = await fetch('/api/expenses?period=today');
      if (expRes.ok) {
        const expData = await expRes.json();
        setTodayExpenses(expData.summary?.total || 0);
      }

      // Load low stock count
      const invRes = await fetch('/api/inventory/items');
      if (invRes.ok) {
        const invData = await invRes.json();
        setLowStockCount(invData.summary?.lowStockCount || 0);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with User Info */}
      <SalonHeader title="Dashboard">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden lg:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 md:px-4 py-2 text-xs md:text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
          <Link href="/pos" className="btn-primary text-xs md:text-sm px-3 md:px-4">
            Open POS
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Today's Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalClients}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Services</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.activeServices}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Loyalty Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.loyaltyMembers}
                </p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Profit / Expenses / Inventory Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Net Profit */}
          <div className="stat-card border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Today&apos;s Net Profit</p>
                <p className={`text-2xl font-bold ${stats.todayRevenue - todayExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? '...' : formatCurrency(stats.todayRevenue - todayExpenses)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Revenue − Expenses</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          {/* Today's Expenses */}
          <Link href="/expenses" className="stat-card border-l-4 border-red-400 block hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Today&apos;s Expenses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : formatCurrency(todayExpenses)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Tap to view &amp; manage</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Low Stock */}
          <Link href="/inventory" className="stat-card border-l-4 border-orange-400 block hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Low Stock Alerts</p>
                <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {loading ? '...' : lowStockCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">{lowStockCount > 0 ? 'Items need restocking' : 'All stock levels OK'}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                <svg className={`w-6 h-6 ${lowStockCount > 0 ? 'text-orange-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Visits */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Today's Visits</h2>
            </div>
            <div className="mt-6">
              {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : recentVisits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No visits today</p>
                  <Link href="/pos" className="text-brand-primary hover:underline mt-2 inline-block">
                    Create first visit
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{visit.client.name}</p>
                        <p className="text-sm text-gray-600">{formatTime(visit.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(visit.total_amount)}</p>
                        <p className="text-xs text-gray-600 capitalize">{visit.payment_method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold">Quick Actions</h2>
            </div>
            <div className="mt-6 space-y-3">
              <Link href="/pos" className="block p-4 bg-brand-primary/5 hover:bg-brand-primary/10 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">New Transaction</p>
                    <p className="text-sm text-gray-600">Process a sale in POS</p>
                  </div>
                </div>
              </Link>

              <Link href="/clients" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Manage Clients</p>
                    <p className="text-sm text-gray-600">View and edit clients</p>
                  </div>
                </div>
              </Link>

              <Link href="/services" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 15.536c-1.171 1.952-3.07 1.952-4.242 0-1.172-1.952-1.172-5.119 0-7.072 1.171-1.952 3.07-1.952 4.242 0M8 10.5h4m-4 3h4m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Manage Services</p>
                    <p className="text-sm text-gray-600">Add and edit services</p>
                  </div>
                </div>
              </Link>

              <Link href="/sales" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Sales & Transactions</p>
                    <p className="text-sm text-gray-600">View all transactions</p>
                  </div>
                </div>
              </Link>

              <Link href="/reports" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Reports & Analytics</p>
                    <p className="text-sm text-gray-600">Revenue trends, top services & clients</p>
                  </div>
                </div>
              </Link>

              <Link href="/expenses" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Expenses</p>
                    <p className="text-sm text-gray-600">Track costs &amp; calculate profit</p>
                  </div>
                </div>
              </Link>

              <Link href="/inventory" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Inventory</p>
                    <p className="text-sm text-gray-600">Stock items, groups &amp; movements</p>
                  </div>
                </div>
              </Link>

              {(user?.role === 'owner' || user?.role === 'admin') && (
                <Link href="/staff" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">System Users</p>
                      <p className="text-sm text-gray-600">Manage login accounts &amp; roles</p>
                    </div>
                  </div>
                </Link>
              )}

              {user?.role === 'owner' && (
                <Link href="/workers" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Staff Performance</p>
                      <p className="text-sm text-gray-600">Ledger, revenue &amp; ratings per staff</p>
                    </div>
                  </div>
                </Link>
              )}

              <Link href="/loyalty" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Loyalty Program</p>
                    <p className="text-sm text-gray-600">View rewards and tiers</p>
                  </div>
                </div>
              </Link>

              {(user?.role === 'owner' || user?.role === 'admin') && (
                <Link href="/settings" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Settings</p>
                      <p className="text-sm text-gray-600">Salon info, branding &amp; SMS template</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
