'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';

const PERIODS = [
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3months',    label: 'Last 3 Months' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

const PAY_COLORS: Record<string, string> = {
  cash:             '#22c55e',
  mtn_mobile_money: '#f59e0b',
  airtel_money:     '#ef4444',
  card:             '#6366f1',
  unknown:          '#9ca3af',
};

const PAY_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN MoMo',
  airtel_money:     'Airtel Money',
  card:             'Card',
};

interface Summary {
  totalRevenue: number;
  totalVisits: number;
  avgOrderValue: number;
  uniqueClients: number;
}

interface DayData    { date: string; revenue: number; visits: number }
interface PayData    { method: string; amount: number; count: number }
interface ServiceRow { service_id: string; name: string; category: string; revenue: number; count: number }
interface ClientRow  { client_id: string; name: string; phone: string; total_spent: number; visits: number }

export default function ReportsPage() {
  const router  = useRouter();
  const { user } = useUser();

  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [loading, setLoading]     = useState(true);

  const [summary, setSummary]                 = useState<Summary | null>(null);
  const [revenueByDay, setRevenueByDay]       = useState<DayData[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PayData[]>([]);
  const [topServices, setTopServices]         = useState<ServiceRow[]>([]);
  const [topClients, setTopClients]           = useState<ClientRow[]>([]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (period === 'custom' && fromDate && toDate) {
        qs.set('from_date', fromDate);
        qs.set('to_date', toDate);
      }
      const res = await fetch(`/api/reports?${qs}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSummary(data.summary);
      setRevenueByDay(data.revenueByDay);
      setPaymentBreakdown(data.paymentBreakdown);
      setTopServices(data.topServices);
      setTopClients(data.topClients);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  const maxDayRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Reports & Analytics">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">

        {/* Period Selector */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      period === p.value
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date" value={fromDate} max={toDate || undefined}
                    onChange={e => setFromDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date" value={toDate} min={fromDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setToDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-4 gap-6 animate-pulse mb-6">
            {[1,2,3,4].map(i => <div key={i} className="card h-24 bg-gray-100" />)}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="card border-l-4 border-brand-primary">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
              </div>
              <div className="card border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.totalVisits || 0}</p>
              </div>
              <div className="card border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Avg. Order Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.avgOrderValue || 0)}</p>
              </div>
              <div className="card border-l-4 border-purple-500">
                <p className="text-sm text-gray-600">Unique Clients</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.uniqueClients || 0}</p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="card mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
              {revenueByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      width={44}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                      labelFormatter={(label: any) => formatDate(String(label ?? ''))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="#E31C23" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Payment Breakdown */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
                {paymentBreakdown.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ method, percent }: { method?: string; percent?: number }) => {
                            const label = PAY_LABELS[method ?? ''] ?? method ?? '';
                            return `${label} ${((percent ?? 0) * 100).toFixed(0)}%`;
                          }}
                          labelLine={false}
                        >
                          {paymentBreakdown.map(entry => (
                            <Cell key={entry.method} fill={PAY_COLORS[entry.method] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value ?? 0))}
                          contentStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 min-w-[140px]">
                      {paymentBreakdown.map(p => (
                        <div key={p.method} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PAY_COLORS[p.method] || '#9ca3af' }}
                          />
                          <span className="text-gray-700">{PAY_LABELS[p.method] || p.method}</span>
                          <span className="ml-auto font-medium text-gray-900">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Services */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Top Services</h2>
                {topServices.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="space-y-3">
                    {topServices.slice(0, 6).map((svc, i) => (
                      <div key={svc.service_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-800 truncate max-w-[55%]">
                            <span className="text-gray-400 mr-1.5">#{i + 1}</span>
                            {svc.name}
                          </span>
                          <div className="text-right shrink-0">
                            <span className="font-medium text-gray-900">{formatCurrency(svc.revenue)}</span>
                            <span className="text-gray-400 ml-2 text-xs">×{svc.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded-full"
                            style={{ width: `${(svc.revenue / topServices[0].revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Clients */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Top Clients by Spend</h2>
              {topClients.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Visits</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Avg/Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topClients.map((c, i) => (
                        <tr key={c.client_id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-400">{i + 1}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 text-right">{c.visits}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(c.total_spent)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatCurrency(c.total_spent / c.visits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
