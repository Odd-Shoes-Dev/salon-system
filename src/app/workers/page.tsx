'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SalonHeader } from '@/components/SalonBranding';
import { PeriodSelector, DateRangePicker, SearchInput, StatCard, useHiddenCards } from '@/components/ui';
import { PageGroupTabs, TEAM_TABS } from '@/components/PageGroupTabs';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency, localDateStr } from '@/lib/utils';
import { useModalEsc } from '@/contexts/EscContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Worker {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  job_title: string;
  hire_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  branch_name?: string | null;
}

interface WorkerLedger {
  id: string;
  services_count: number;
  total_revenue: number;
  ratings_count: number;
  avg_rating: number | null;
}

interface MergedWorker extends Worker {
  services_count: number;
  total_revenue: number;
  ratings_count: number;
  avg_rating: number | null;
}

const PERIOD_OPTIONS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom Range' },
];

const JOB_TITLES = ['Stylist', 'Barber', 'Nail Technician', 'Colorist', 'Braider',
  'Massage Therapist', 'Esthetician', 'Makeup Artist', 'Receptionist', 'Manager', 'Other'];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkersPage() {
  const { user } = useUser();
  const router = useRouter();

  const { isHidden, toggle: toggleCard } = useHiddenCards('workers_hidden_cards', ['totalRevenue', 'topRevenue'] as const);
  const [workers, setWorkers]         = useState<Worker[]>([]);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [ledger, setLedger]           = useState<WorkerLedger[]>([]);
  const [loading, setLoading]         = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [showModal, setShowModal]       = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  useModalEsc(showModal, () => setShowModal(false));

  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch]             = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('all');

  const [period, setPeriod]     = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });

  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const canAccess = ['owner', 'admin', 'manager'].includes(user?.role || '');

  useEffect(() => {
    if (user && !canAccess) router.push('/dashboard');
  }, [user, canAccess, router]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers?active=${!showInactive}`);
      if (res.ok) setWorkers(await res.json());
    } finally { setLoading(false); }
  }, [showInactive]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const qs = new URLSearchParams();
      if (period === 'custom') {
        if (fromDate) qs.set('from_date', fromDate);
        if (toDate)   qs.set('to_date', toDate);
      } else {
        qs.set('period', period);
      }
      const res = await fetch(`/api/workers/ledger?${qs}`);
      if (res.ok) { const d = await res.json(); setLedger(d.ledger || []); }
    } finally { setLedgerLoading(false); }
  }, [period, fromDate, toDate]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);
  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) loadLedger();
  }, [loadLedger, period, fromDate, toDate]);

  const handleDeactivate = (worker: Worker) => {
    const action = worker.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${worker.name}?`)) return;
    run(`toggle:${worker.id}`, () => guardAction('sensitive', async () => {
      await fetch('/api/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: worker.id, is_active: !worker.is_active }),
      });
      loadWorkers();
      loadLedger();
    }));
  };

  // Merge workers + ledger
  const ledgerMap = Object.fromEntries(ledger.map(l => [l.id, l]));
  const merged: MergedWorker[] = workers.map(w => ({
    ...w,
    services_count: ledgerMap[w.id]?.services_count ?? 0,
    total_revenue:  ledgerMap[w.id]?.total_revenue  ?? 0,
    ratings_count:  ledgerMap[w.id]?.ratings_count  ?? 0,
    avg_rating:     ledgerMap[w.id]?.avg_rating     ?? null,
  }));

  const filtered = merged.filter(w =>
    (search.trim() === '' ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.phone || '').includes(search)) &&
    (jobTitleFilter === 'all' || w.job_title === jobTitleFilter)
  );

  const totalRevenue  = ledger.reduce((s, w) => s + w.total_revenue, 0);
  const totalServices = ledger.reduce((s, w) => s + w.services_count, 0);
  const topPerformer  = [...ledger].sort((a, b) => b.total_revenue - a.total_revenue)[0];
  const topWorkerName = workers.find(w => w.id === topPerformer?.id)?.name;

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Staff" />
      <PageGroupTabs tabs={TEAM_TABS} />

      <div className="container mx-auto p-4 md:p-6 space-y-6">

        {/* ── Toolbar ── */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone…" className="flex-1" />
          <select
            value={jobTitleFilter}
            onChange={e => setJobTitleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Job Titles</option>
            {[...new Set(workers.map(w => w.job_title))].sort().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
          {canManage && (
            <button onClick={() => { setEditingWorker(null); setShowModal(true); }} className="btn-primary text-sm px-4 py-2 whitespace-nowrap">
              + Add Staff Member
            </button>
          )}
        </div>

        {/* ── Period Selector ── */}
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end">
            <PeriodSelector periods={PERIOD_OPTIONS} value={period} onChange={setPeriod} label="Stats Period" />
            {period === 'custom' && (
              <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            )}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} accent="border-l-4 border-brand-primary" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('totalRevenue')} onToggle={() => toggleCard('totalRevenue')} />
          <StatCard label="Total Services" value={totalServices} accent="border-l-4 border-green-500" />
          <StatCard
            label="Top Performer"
            accent="border-l-4 border-yellow-400"
            valueColor="text-gray-900 text-base sm:text-lg"
            hidden={isHidden('topRevenue')}
            onToggle={() => toggleCard('topRevenue')}
            value={
              <>
                {topWorkerName || '—'}
                {topPerformer && topWorkerName && (
                  <span className="block text-sm text-gray-500 font-normal mt-0.5">{formatCurrency(topPerformer.total_revenue)}</span>
                )}
              </>
            }
          />
        </div>

        {/* ── Staff Table ── */}
        {loading ? (
          <div className="card py-16 text-center text-gray-400">Loading…</div>
        ) : workers.length === 0 ? (
          <div className="card py-16 text-center">
            <p className="text-gray-400 text-lg mb-2">No staff added yet</p>
            <button onClick={() => { setEditingWorker(null); setShowModal(true); }} className="btn-primary text-sm px-4 py-2 mt-4">
              + Add First Staff Member
            </button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            {!loading && (
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">{filtered.length} of {workers.length} staff members</p>
                {ledgerLoading && <span className="text-xs text-gray-400">Updating stats…</span>}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No staff match your search</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Staff Member</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Job Title</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Branch</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Services</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Rating</th>
                      {canManage && (
                        <th className="py-3 px-4" />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(worker => (
                      <tr
                        key={worker.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${!worker.is_active ? 'opacity-50' : ''}`}
                        onClick={() => router.push(`/workers/${worker.id}`)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-sm shrink-0">
                              {worker.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{worker.name}</p>
                              {worker.phone && <p className="text-xs text-gray-400">{worker.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">{worker.job_title}</span>
                          {!worker.is_active && (
                            <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">Inactive</span>
                          )}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          {worker.branch_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {worker.branch_name}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-700">{worker.services_count}</td>
                        <td className="py-3 px-4 text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(worker.total_revenue)}</p>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          {worker.avg_rating != null ? (
                            <span className="flex items-center gap-1 text-yellow-500 font-medium">
                              ⭐ {worker.avg_rating.toFixed(1)}
                              <span className="text-xs text-gray-400 ml-0.5">({worker.ratings_count})</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No ratings</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={e => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenMenuId(openMenuId === worker.id ? null : worker.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dropdown Menu ── */}
      {openMenuId && (() => {
        const worker = workers.find(w => w.id === openMenuId);
        if (!worker) return null;
        return (
          <div
            className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44"
            style={{ top: menuPos.top, right: menuPos.right }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setEditingWorker(worker); setShowModal(true); setOpenMenuId(null); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </button>
            <button
              onClick={() => { handleDeactivate(worker); setOpenMenuId(null); }}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${worker.is_active ? 'text-red-600' : 'text-green-600'}`}
            >
              {worker.is_active ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  Deactivate
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Reactivate
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <WorkerModal
          worker={editingWorker}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadWorkers(); loadLedger(); }}
        />
      )}
      {SecurityModal}
    </div>
  );
}

// ─── Worker Modal ──────────────────────────────────────────────────────────────

function WorkerModal({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!worker;
  const [name, setName] = useState(worker?.name || '');
  const [phone, setPhone] = useState(worker?.phone || '');
  const [email, setEmail] = useState(worker?.email || '');
  const [jobTitle, setJobTitle] = useState(worker?.job_title || 'Stylist');
  const [hireDate, setHireDate] = useState(worker?.hire_date?.split('T')[0] || '');
  const [notes, setNotes] = useState(worker?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...(isEdit ? { id: worker!.id } : {}),
        name, phone, email,
        job_title: jobTitle,
        hire_date: hireDate || null,
        notes,
      };
      const res = await fetch('/api/workers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }
      onSaved();
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sarah Nakato"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <select
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
              <input
                type="date"
                value={hireDate}
                max={localDateStr()}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this staff member..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn-primary disabled:opacity-50">
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
