'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency } from '@/lib/utils';

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
}

interface WorkerLedger {
  id: string;
  name: string;
  phone: string;
  job_title: string;
  services_count: number;
  total_revenue: number;
  ratings_count: number;
  avg_rating: number | null;
  recent_ratings: { rating: number; comment: string; created_at: string }[];
}

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

const JOB_TITLES = ['Stylist', 'Barber', 'Nail Technician', 'Colorist', 'Braider',
  'Massage Therapist', 'Esthetician', 'Makeup Artist', 'Receptionist', 'Manager', 'Other'];

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-gray-400 text-sm">No ratings yet</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
      <span className="text-sm text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkersPage() {
  const { user } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'team' | 'performance'>('team');

  // Team state
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('all');

  // Performance state
  const [ledger, setLedger] = useState<WorkerLedger[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [perfSearch, setPerfSearch] = useState('');

  useEffect(() => {
    if (user && user.role !== 'owner' && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user]);

  useEffect(() => { loadWorkers(); }, [showInactive]);
  useEffect(() => { if (activeTab === 'performance') loadLedger(); }, [activeTab, period, fromDate, toDate]);

  const loadWorkers = async () => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/workers?active=${!showInactive}`);
      if (res.ok) setWorkers(await res.json());
    } catch {}
    setTeamLoading(false);
  };

  const loadLedger = async () => {
    setPerfLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === 'custom') {
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
      } else {
        params.set('period', period);
      }
      const res = await fetch(`/api/workers/ledger?${params.toString()}`);
      if (res.ok) { const data = await res.json(); setLedger(data.ledger || []); }
    } catch {}
    setPerfLoading(false);
  };

  const handleDeactivate = async (worker: Worker) => {
    const action = worker.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${worker.name}?`)) return;
    await fetch('/api/workers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: worker.id, is_active: !worker.is_active }),
    });
    loadWorkers();
  };

  const totalRevenue = ledger.reduce((s, w) => s + w.total_revenue, 0);
  const totalServices = ledger.reduce((s, w) => s + w.services_count, 0);
  const topPerformer = [...ledger].sort((a, b) => b.total_revenue - a.total_revenue)[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Staff">
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-4 md:p-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {(['team', 'performance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'team' ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Team
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Performance
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TEAM TAB ── */}
        {activeTab === 'team' && (
          <>
            {/* Search + filters row */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={jobTitleFilter}
                onChange={(e) => setJobTitleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Job Titles</option>
                {[...new Set(workers.map(w => w.job_title))].sort().map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded"
                />
                Show inactive
              </label>
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <button
                  onClick={() => { setEditingWorker(null); setShowModal(true); }}
                  className="btn-primary text-sm px-4 py-2 whitespace-nowrap"
                >
                  + Add Worker
                </button>
              )}
            </div>

            {/* Result count */}
            {!teamLoading && workers.length > 0 && (
              <p className="text-sm text-gray-500 mb-3">
                {(() => {
                  const filtered = workers.filter(w =>
                    (workerSearch.trim() === '' ||
                      w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                      (w.phone || '').includes(workerSearch)) &&
                    (jobTitleFilter === 'all' || w.job_title === jobTitleFilter)
                  );
                  return `${filtered.length} of ${workers.length} workers`;
                })()}
              </p>
            )}

            {teamLoading ? (
              <div className="card py-16 text-center text-gray-400">Loading...</div>
            ) : workers.length === 0 ? (
              <div className="card py-16 text-center">
                <p className="text-gray-400 text-lg mb-2">No workers added yet</p>
                <p className="text-sm text-gray-400">Add your salon staff to track their performance</p>
                <button
                  onClick={() => { setEditingWorker(null); setShowModal(true); }}
                  className="btn-primary text-sm px-4 py-2 mt-4"
                >
                  + Add First Worker
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workers.filter(w =>
                  (workerSearch.trim() === '' ||
                    w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                    (w.phone || '').includes(workerSearch)) &&
                  (jobTitleFilter === 'all' || w.job_title === jobTitleFilter)
                ).length === 0 ? (
                  <div className="col-span-full card py-12 text-center text-gray-400">
                    No workers match your search
                  </div>
                ) : null}
                {workers.filter(w =>
                  (workerSearch.trim() === '' ||
                    w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                    (w.phone || '').includes(workerSearch)) &&
                  (jobTitleFilter === 'all' || w.job_title === jobTitleFilter)
                ).map((worker) => (
                  <div
                    key={worker.id}
                    className={`card flex flex-col gap-3 ${!worker.is_active ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-lg">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{worker.name}</p>
                          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                            {worker.job_title}
                          </span>
                        </div>
                      </div>
                      {!worker.is_active && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {worker.phone && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {worker.phone}
                        </p>
                      )}
                      {worker.email && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {worker.email}
                        </p>
                      )}
                      {worker.hire_date && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Since {new Date(worker.hire_date).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      {worker.notes && (
                        <p className="text-xs text-gray-400 italic mt-1">{worker.notes}</p>
                      )}
                    </div>

                    {(user?.role === 'owner' || user?.role === 'admin') && (
                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => { setEditingWorker(worker); setShowModal(true); }}
                          className="flex-1 text-sm text-blue-600 hover:text-blue-800 font-medium py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(worker)}
                          className={`flex-1 text-sm font-medium py-1 ${
                            worker.is_active
                              ? 'text-red-500 hover:text-red-700'
                              : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          {worker.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {activeTab === 'performance' && (
          <>
            {/* Period Filter + Search */}
            <div className="card mb-6">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
                  <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input">
                    {PERIOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {period === 'custom' && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 whitespace-nowrap">From</label>
                      <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="input" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 whitespace-nowrap">To</label>
                      <input type="date" value={toDate} min={fromDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => setToDate(e.target.value)} className="input" />
                    </div>
                  </>
                )}
                <div className="relative ml-auto">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter by name..."
                    value={perfSearch}
                    onChange={(e) => setPerfSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="card border-l-4 border-brand-primary">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="card border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1">Total Services</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalServices}</p>
              </div>
              <div className="card border-l-4 border-yellow-400">
                <p className="text-sm text-gray-600 mb-1">Top Performer</p>
                <p className="text-xl font-bold text-gray-900">{topPerformer?.name || '—'}</p>
                {topPerformer && <p className="text-sm text-gray-500">{formatCurrency(topPerformer.total_revenue)}</p>}
              </div>
            </div>

            {/* Performance Table */}
            <div className="card overflow-hidden">
              {perfLoading ? (
                <div className="py-16 text-center text-gray-400">Loading...</div>
              ) : ledger.length === 0 ? (
                <div className="py-16 text-center text-gray-400">No performance data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Worker</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Job Title</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Services</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Revenue</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rating</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Reviews</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ledger.filter(w =>
                        perfSearch.trim() === '' ||
                        w.name.toLowerCase().includes(perfSearch.toLowerCase()) ||
                        (w.phone || '').includes(perfSearch)
                      ).length === 0 && (
                        <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">No workers match "{perfSearch}"</td></tr>
                      )}
                      {ledger.filter(w =>
                        perfSearch.trim() === '' ||
                        w.name.toLowerCase().includes(perfSearch.toLowerCase()) ||
                        (w.phone || '').includes(perfSearch)
                      ).map((worker) => (
                        <Fragment key={worker.id}>
                          <tr className="hover:bg-gray-50">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-semibold text-sm">
                                  {worker.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{worker.name}</p>
                                  {worker.phone && <p className="text-xs text-gray-400">{worker.phone}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{worker.job_title}</span>
                            </td>
                            <td className="py-4 px-4 text-right font-bold text-gray-900">{worker.services_count}</td>
                            <td className="py-4 px-4 text-right font-bold text-gray-900">{formatCurrency(worker.total_revenue)}</td>
                            <td className="py-4 px-4"><StarDisplay rating={worker.avg_rating} /></td>
                            <td className="py-4 px-4 text-right text-gray-600">{worker.ratings_count}</td>
                            <td className="py-4 px-4 text-right">
                              {worker.recent_ratings.length > 0 && (
                                <button
                                  onClick={() => setExpandedId(expandedId === worker.id ? null : worker.id)}
                                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {expandedId === worker.id ? 'Hide' : 'Reviews'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedId === worker.id && (
                            <tr>
                              <td colSpan={7} className="bg-yellow-50 px-8 py-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Recent Reviews for {worker.name}</p>
                                <div className="space-y-2">
                                  {worker.recent_ratings.map((r, i) => (
                                    <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                                      <div className="flex gap-0.5 shrink-0">
                                        {[1,2,3,4,5].map((s) => (
                                          <span key={s} className={s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                                        ))}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-700">{r.comment || <span className="italic text-gray-400">No comment left</span>}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Worker Modal */}
      {showModal && (
        <WorkerModal
          worker={editingWorker}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadWorkers(); }}
        />
      )}
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
            {isEdit ? 'Edit Worker' : 'Add Worker'}
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
                max={new Date().toISOString().split('T')[0]}
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
              placeholder="Optional notes about this worker..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn-primary disabled:opacity-50">
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
