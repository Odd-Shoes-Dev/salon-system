'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SalonHeader } from '@/components/SalonBranding';
import { DateRangePicker } from '@/components/ui';
import { formatCurrency, localDateStr } from '@/lib/utils';
import { useSalon } from '@/contexts/SalonContext';

interface CategoryData {
  category: string;
  allTime: {
    total: number;
    count: number;
    largest: number;
    lastDate: string | null;
    daysSinceLast: number | null;
  };
  monthlyTrend: { month: string; total: number; count: number }[];
  period: { total: number; count: number; avg: number; largest: number };
  expenses: { id: string; amount: number; description: string | null; expense_date: string; payment_method: string }[];
}

const PERIODS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'all',        label: 'All Time' },
  { value: 'custom',     label: 'Custom' },
];

const PAY_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN MoMo',
  airtel_money:     'Airtel Money',
  other:            'Other',
};

function getPeriodRange(period: string): { from: string; to: string } | null {
  const now = new Date();
  const today = localDateStr();
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0);
      return { from: localDateStr(d), to: today };
    }
    case 'month':
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return { from: localDateStr(d), to: localDateStr(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default:     return null; // all / custom — no date filter
  }
}

export default function ExpenseCategoryPage() {
  const params   = useParams();
  const router   = useRouter();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';

  const categoryName = decodeURIComponent(String(params.category));

  const [data, setData]       = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod]     = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ name: categoryName });
      if (period === 'custom') {
        if (fromDate) qs.set('from_date', fromDate);
        if (toDate)   qs.set('to_date', toDate);
      } else {
        const range = getPeriodRange(period);
        if (range) { qs.set('from_date', range.from); qs.set('to_date', range.to); }
      }
      const res = await fetch(`/api/expenses/category?${qs}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [categoryName, period, fromDate, toDate, router]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Expense Category">
        <Link href="/reports" className="btn-secondary text-sm">← Reports</Link>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Identity Card ── */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{categoryName}</h2>
                <p className="text-sm text-gray-400 mt-0.5">Expense Category</p>
              </div>
            </div>

            <div className="md:ml-auto grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-red-600">{formatCurrency(data?.allTime.total ?? 0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Total</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{data?.allTime.count ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Entries</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(data?.allTime.largest ?? 0)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Largest Entry</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-bold text-gray-900">
                  {data?.allTime.daysSinceLast !== null && data?.allTime.daysSinceLast !== undefined
                    ? `${data.allTime.daysSinceLast}d ago`
                    : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Last Spent</p>
                {data?.allTime.lastDate && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(data.allTime.lastDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
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

        {loading ? (
          <div className="card py-16 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto" />
          </div>
        ) : (
          <>
            {/* ── Period Stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card border-l-4 border-red-400">
                <p className="text-sm text-gray-500">Period Total</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(data?.period.total ?? 0)}</p>
              </div>
              <div className="card border-l-4 border-gray-400">
                <p className="text-sm text-gray-500">Entries</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data?.period.count ?? 0}</p>
              </div>
              <div className="card border-l-4 border-blue-400">
                <p className="text-sm text-gray-500">Avg per Entry</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data?.period.avg ?? 0)}</p>
              </div>
              <div className="card border-l-4 border-orange-400">
                <p className="text-sm text-gray-500">Largest Entry</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data?.period.largest ?? 0)}</p>
              </div>
            </div>

            {/* ── Monthly Trend ── */}
            {data && data.monthlyTrend.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-gray-900 mb-4">Monthly Spend (last 12 months)</p>
                <div className="flex items-end gap-1 h-24">
                  {(() => {
                    const maxTotal = Math.max(...data.monthlyTrend.map(m => m.total), 1);
                    return data.monthlyTrend.map(m => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full rounded-t bg-red-300 hover:bg-red-400 min-h-[2px] transition-all"
                          style={{ height: `${(m.total / maxTotal) * 88}px` }}
                        />
                        <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 hidden sm:block">
                          {m.month.slice(5)}
                        </span>
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                          {m.month}: {formatCurrency(m.total)} · {m.count} entr{m.count !== 1 ? 'ies' : 'y'}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* ── Expense Log ── */}
            <div className="card p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Expense Log</h3>
                <span className="text-sm text-gray-400">{data?.expenses.length ?? 0} entr{(data?.expenses.length ?? 0) !== 1 ? 'ies' : 'y'}</span>
              </div>

              {!data || data.expenses.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No expenses in this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Description</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Payment</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.expenses.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(e.expense_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {e.description || <span className="text-gray-400 italic">No description</span>}
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {PAY_LABELS[e.payment_method] || e.payment_method}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">
                            {formatCurrency(e.amount)}
                          </td>
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
