'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SalonHeader } from '@/components/SalonBranding';
import { DateRangePicker } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useSalon } from '@/contexts/SalonContext';
import { useUser } from '@/contexts/UserContext';

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  job_title: string;
  hire_date: string | null;
  notes: string | null;
  is_active: boolean;
  branch_name: string | null;
}

interface WorkerStats {
  allTimeRevenue: number;
  allTimeServices: number;
  topServices: { service_name: string; category: string; count: number; revenue: number }[];
  recentRatings: { rating: number; comment: string | null; created_at: string }[];
  ratingDistribution: { star: number; count: number }[];
}

const PERIODS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

function getPeriodRange(period: string): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0);
      return { from: d.toISOString().split('T')[0], to: today };
    }
    case 'month':
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return { from: d.toISOString().split('T')[0], to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0] };
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: today };
    default:
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
  }
}

export default function WorkerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { salon } = useSalon();
  const { user } = useUser();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const workerId = String(params.id);
  const canAccess = ['owner', 'admin', 'manager'].includes(user?.role || '');

  useEffect(() => {
    if (user && !canAccess) router.push('/dashboard');
  }, [user, canAccess, router]);

  const [worker, setWorker]   = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod]   = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [stats, setStats]     = useState<WorkerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [commissionRate, setCommissionRate] = useState('');

  // Load basic worker info
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/workers/${workerId}`);
        if (res.status === 401) { router.push('/login'); return; }
        if (res.status === 404) { setWorker(null); setLoading(false); return; }
        if (res.ok) setWorker(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [workerId, router]);

  // Load period stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStats(null);
    try {
      const qs = new URLSearchParams({ worker_id: workerId });
      if (period === 'custom') {
        if (fromDate) qs.set('from_date', fromDate);
        if (toDate)   qs.set('to_date', toDate);
      } else {
        const { from, to } = getPeriodRange(period);
        qs.set('from_date', from);
        qs.set('to_date', to);
      }
      const res = await fetch(`/api/workers/stats?${qs}`);
      if (res.ok) setStats(await res.json());
    } finally { setStatsLoading(false); }
  }, [workerId, period, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) loadStats();
  }, [loadStats, period, fromDate, toDate]);


  const avgPerService = stats && stats.allTimeServices > 0
    ? stats.allTimeRevenue / stats.allTimeServices
    : 0;

  const periodRevenue  = stats?.topServices.reduce((s, sv) => s + sv.revenue, 0) ?? 0;
  const periodServices = stats?.topServices.reduce((s, sv) => s + sv.count, 0)  ?? 0;
  const periodAvg      = periodServices > 0 ? periodRevenue / periodServices : 0;

  const totalRatings   = stats?.ratingDistribution.reduce((s, r) => s + r.count, 0) ?? 0;
  const avgRating      = totalRatings > 0
    ? stats!.ratingDistribution.reduce((s, r) => s + r.star * r.count, 0) / totalRatings
    : null;

  const commissionOwed = commissionRate && Number(commissionRate) > 0
    ? (periodRevenue * Number(commissionRate)) / 100
    : null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
    </div>
  );

  if (!worker) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Staff member not found</p>
        <Link href="/workers" className="btn-primary">← Back to Staff</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Staff Profile">
        <Link href="/workers" className="btn-secondary text-sm">← All Staff</Link>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Identity Card ── */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-2xl font-bold shrink-0">
                {worker.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{worker.name}</h2>
                  {!worker.is_active && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Inactive</span>
                  )}
                </div>
                <span className="inline-block mt-1 px-2 py-0.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">
                  {worker.job_title}
                </span>
                {worker.branch_name && (
                  <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {worker.branch_name}
                  </span>
                )}
              </div>
            </div>

            <div className="md:ml-auto grid grid-cols-2 md:grid-cols-4 gap-4">
              {worker.phone && (
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900">{worker.phone}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Phone</p>
                </div>
              )}
              {worker.email && (
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900 truncate">{worker.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Email</p>
                </div>
              )}
              {worker.hire_date && (
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(worker.hire_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Hire Date</p>
                </div>
              )}
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(stats?.allTimeRevenue ?? 0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Revenue</p>
              </div>
            </div>
          </div>

          {worker.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 italic">"{worker.notes}"</p>
            </div>
          )}
        </div>

        {/* ── Period Selector ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {PERIODS.map(p => {
              const active = period === p.value;
              return (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                    active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
          {period === 'custom' && (
            <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
          )}
        </div>

        {/* ── Period Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-500">Period Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? '…' : formatCurrency(periodRevenue)}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Services</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? '…' : periodServices}</p>
          </div>
          <div className="card border-l-4 border-blue-400">
            <p className="text-sm text-gray-500">Avg / Service</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{statsLoading ? '…' : formatCurrency(periodAvg)}</p>
          </div>
          <div className="card border-l-4 border-yellow-400">
            <p className="text-sm text-gray-500">Avg Rating</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {statsLoading ? '…' : avgRating !== null ? `⭐ ${avgRating.toFixed(1)}` : '—'}
            </p>
            {!statsLoading && totalRatings > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{totalRatings} review{totalRatings !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* ── Services Breakdown ── */}
        {!statsLoading && stats && stats.topServices.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold text-gray-900 mb-4">Services This Period</p>
            <div className="space-y-3">
              {stats.topServices.map((s, i) => {
                const maxCount = stats.topServices[0]?.count || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate max-w-[60%]">{s.service_name}</span>
                      <span className="text-gray-500 shrink-0 ml-2">{s.count}× · {formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-primary transition-all"
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Commission Calculator ── */}
        <div className="card">
          <p className="text-sm font-semibold text-gray-900 mb-3">Commission Calculator</p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder="Enter %"
                  className="input w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
              </div>
              <div className="bg-brand-primary/10 rounded-xl px-5 py-3 text-center">
                <p className="text-xs text-brand-primary font-medium mb-0.5">Commission Owed</p>
                <p className="text-xl font-bold text-gray-900">
                  {commissionOwed !== null ? formatCurrency(commissionOwed) : '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Based on {formatCurrency(periodRevenue)} period revenue</p>
        </div>

        {/* ── Ratings ── */}
        {!statsLoading && stats && totalRatings > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Ratings</p>
              {avgRating !== null && (
                <span className="text-yellow-500 font-bold text-lg">⭐ {avgRating.toFixed(1)}</span>
              )}
            </div>

            {/* Distribution bars */}
            <div className="space-y-1.5 mb-5">
              {[...stats.ratingDistribution].reverse().map(({ star, count }) => {
                const pct = Math.round((count / Math.max(totalRatings, 1)) * 100);
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-3">{star}</span>
                    <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Recent reviews */}
            {stats.recentRatings.length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Recent Reviews</p>
                <div className="space-y-2">
                  {stats.recentRatings.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <svg key={s} className={`w-3.5 h-3.5 ${s < r.rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <span className="text-xs text-gray-400 ml-1">
                          {new Date(r.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {r.comment
                        ? <p className="text-sm text-gray-600 italic">"{r.comment}"</p>
                        : <p className="text-xs text-gray-400 italic">No comment left</p>
                      }
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
