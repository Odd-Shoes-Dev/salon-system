'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader, SearchInput, StatCard, useHiddenCards } from '@/components/ui';
import { PageGroupTabs, CLIENT_TABS } from '@/components/PageGroupTabs';
import { ClientModal } from '@/components/ClientModal';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useModalEsc } from '@/contexts/EscContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';
import { getClientMissingFields } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  location?: string;
  loyalty_points: number;
  total_spent: number;
  total_visits: number;
  last_visit?: string;
  last_visit_branch_name?: string;
  registered_at_branch_name?: string;
  created_at: string;
}

const getMissingFields = getClientMissingFields;

interface ClientFilters {
  gender: string;
  location: string;
  minPoints: string;
  maxPoints: string;
  minSpend: string;
  maxSpend: string;
  minVisits: string;
  maxVisits: string;
  lastVisitAfter: string;
  lastVisitBefore: string;
  neverVisited: boolean;
  birthdayMonth: string;
  registeredAfter: string;
  registeredBefore: string;
  hasPhone: string;
}

const EMPTY_FILTERS: ClientFilters = {
  gender: '', location: '', minPoints: '', maxPoints: '',
  minSpend: '', maxSpend: '', minVisits: '', maxVisits: '',
  lastVisitAfter: '', lastVisitBefore: '', neverVisited: false,
  birthdayMonth: '', registeredAfter: '', registeredBefore: '',
  hasPhone: '',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const { isHidden, toggle: toggleCard } = useHiddenCards('clients_hidden_cards', ['totalSpent'] as const);
  const [clients, setClients] = useState<Client[]>([]);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [incompleteFilter, setIncompleteFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalClients: 0,
    totalSpent: 0,
    totalVisits: 0,
    totalPoints: 0,
    incompleteCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  useModalEsc(showModal, () => setShowModal(false));
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ClientFilters>(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState<ClientFilters>(EMPTY_FILTERS);

  const activeFilterCount = Object.entries(activeFilters).filter(([, v]) => v !== '' && v !== false).length;

  const applyFilters = () => {
    setActiveFilters({ ...draftFilters });
    setPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const setDraft = <K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) =>
    setDraftFilters(f => ({ ...f, [key]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setEditingClient(null);
      setShowModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(page, searchQuery, sort, incompleteFilter);
    }, 250);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, sort, incompleteFilter, activeFilters]);

  const loadClients = async (currentPage = page, query = searchQuery, sortBy = sort, incomplete = incompleteFilter) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        paginated: 'true',
        page: String(currentPage),
        pageSize: String(pageSize),
        sort: sortBy,
      });

      if (query.trim()) params.set('search', query.trim());
      if (incomplete)   params.set('incompleteOnly', 'true');

      if (activeFilters.gender)           params.set('gender',          activeFilters.gender);
      if (activeFilters.location)         params.set('location',        activeFilters.location);
      if (activeFilters.minPoints)        params.set('minPoints',       activeFilters.minPoints);
      if (activeFilters.maxPoints)        params.set('maxPoints',       activeFilters.maxPoints);
      if (activeFilters.minSpend)         params.set('minSpend',        activeFilters.minSpend);
      if (activeFilters.maxSpend)         params.set('maxSpend',        activeFilters.maxSpend);
      if (activeFilters.minVisits)        params.set('minVisits',       activeFilters.minVisits);
      if (activeFilters.maxVisits)        params.set('maxVisits',       activeFilters.maxVisits);
      if (activeFilters.lastVisitAfter)   params.set('lastVisitAfter',  activeFilters.lastVisitAfter);
      if (activeFilters.lastVisitBefore)  params.set('lastVisitBefore', activeFilters.lastVisitBefore);
      if (activeFilters.neverVisited)     params.set('neverVisited',    'true');
      if (activeFilters.birthdayMonth)    params.set('birthdayMonth',   activeFilters.birthdayMonth);
      if (activeFilters.registeredAfter)  params.set('registeredAfter', activeFilters.registeredAfter);
      if (activeFilters.registeredBefore) params.set('registeredBefore',activeFilters.registeredBefore);
      if (activeFilters.hasPhone)         params.set('hasPhone',        activeFilters.hasPhone);

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        setClients(payload.data || []);
        setPagination(payload.pagination || {
          page: currentPage,
          pageSize,
          total: 0,
          totalPages: 1,
        });
        setSummary(payload.summary || {
          totalClients: 0,
          totalSpent: 0,
          totalVisits: 0,
          totalPoints: 0,
          incompleteCount: 0,
        });
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load clients');
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteClient = (client: Client) => {
    const confirmed = window.confirm(`Delete client ${client.name}? This will archive the client and hide them from normal views.`);
    if (!confirmed) return;
    run(`delete:${client.id}`, () => guardAction('sensitive', async () => {
      const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete client');
      }
      toast.success('Client deleted successfully');
      loadClients(page, searchQuery, sort, incompleteFilter);
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const getVisiblePages = () => {
    const pages: number[] = [];
    const total = pagination.totalPages;
    const current = pagination.page;

    if (total <= 7) {
      for (let i = 1; i <= total; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i += 1) pages.push(i);
    pages.push(total);

    return Array.from(new Set(pages));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Clients" />
      <PageGroupTabs tabs={CLIENT_TABS} />

      <div className="container mx-auto p-6">
        <PageHeader
          title="Clients"
          subtitle="Manage your client database"
          action={
            <button onClick={() => { setEditingClient(null); setShowModal(true); }} className="btn-primary">
              + Add New Client
            </button>
          }
        />

        {/* Incomplete profiles banner */}
        {!incompleteFilter && summary.incompleteCount > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-amber-800 flex-1">
              <span className="font-semibold">{summary.incompleteCount} client{summary.incompleteCount !== 1 ? 's' : ''}</span> {summary.incompleteCount !== 1 ? 'have' : 'has'} incomplete profiles — missing phone, email, birthday, gender, or location.
            </p>
            <button
              onClick={() => { setIncompleteFilter(true); setPage(1); }}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors shrink-0"
            >
              View incomplete
            </button>
          </div>
        )}

        {/* Search + Sort + Filters */}
        <div className="card mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={searchQuery}
              onChange={v => { setSearchQuery(v); setPage(1); }}
              placeholder="Search by name or phone number..."
              className="flex-1 min-w-0"
            />
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              style={{ flexShrink: 0, width: '13rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid rgb(209 213 219)', backgroundColor: '#fff', fontSize: '0.875rem' }}
            >
              <option value="name">Sort: A → Z</option>
              <option value="total_spent_desc">Sort: Top Spenders</option>
              <option value="total_visits_desc">Sort: Most Visits</option>
              <option value="loyalty_points_desc">Sort: Most Points</option>
              <option value="last_visit_desc">Sort: Recently Active</option>
              <option value="recent">Sort: Newest First</option>
            </select>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors shrink-0 ${showFilters ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${showFilters ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

                {/* Last Visit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Visit</label>
                  <div className="flex gap-2">
                    <input type="date" value={draftFilters.lastVisitAfter} onChange={e => setDraft('lastVisitAfter', e.target.value)} className="input flex-1 text-sm" />
                    <input type="date" value={draftFilters.lastVisitBefore} onChange={e => setDraft('lastVisitBefore', e.target.value)} className="input flex-1 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={draftFilters.neverVisited}
                      onChange={e => setDraftFilters(f => ({ ...f, neverVisited: e.target.checked, lastVisitAfter: '', lastVisitBefore: '' }))}
                      className="rounded border-gray-300"
                    />
                    Never visited
                  </label>
                </div>

                {/* Points */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loyalty Points</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" min="0" value={draftFilters.minPoints} onChange={e => setDraft('minPoints', e.target.value)} className="input flex-1 text-sm" placeholder="Min" />
                    <span className="text-gray-400">–</span>
                    <input type="number" min="0" value={draftFilters.maxPoints} onChange={e => setDraft('maxPoints', e.target.value)} className="input flex-1 text-sm" placeholder="Max" />
                  </div>
                </div>

                {/* Spend */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Spend (UGX)</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" min="0" value={draftFilters.minSpend} onChange={e => setDraft('minSpend', e.target.value)} className="input flex-1 text-sm" placeholder="Min" />
                    <span className="text-gray-400">–</span>
                    <input type="number" min="0" value={draftFilters.maxSpend} onChange={e => setDraft('maxSpend', e.target.value)} className="input flex-1 text-sm" placeholder="Max" />
                  </div>
                </div>

                {/* Visits */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit Count</label>
                  <div className="flex gap-2 items-center">
                    <input type="number" min="0" value={draftFilters.minVisits} onChange={e => setDraft('minVisits', e.target.value)} className="input flex-1 text-sm" placeholder="Min" />
                    <span className="text-gray-400">–</span>
                    <input type="number" min="0" value={draftFilters.maxVisits} onChange={e => setDraft('maxVisits', e.target.value)} className="input flex-1 text-sm" placeholder="Max" />
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                  <select value={draftFilters.gender} onChange={e => setDraft('gender', e.target.value)} className="input w-full text-sm">
                    <option value="">Any</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</label>
                  <input type="text" value={draftFilters.location} onChange={e => setDraft('location', e.target.value)} className="input w-full text-sm" placeholder="e.g. Ntinda" />
                </div>

                {/* Birthday Month */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Birthday Month</label>
                  <select value={draftFilters.birthdayMonth} onChange={e => setDraft('birthdayMonth', e.target.value)} className="input w-full text-sm">
                    <option value="">Any month</option>
                    {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                  </select>
                </div>

                {/* Date Joined */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Joined</label>
                  <div className="flex gap-2">
                    <input type="date" value={draftFilters.registeredAfter} onChange={e => setDraft('registeredAfter', e.target.value)} className="input flex-1 text-sm" />
                    <input type="date" value={draftFilters.registeredBefore} onChange={e => setDraft('registeredBefore', e.target.value)} className="input flex-1 text-sm" />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Number</label>
                  <select value={draftFilters.hasPhone} onChange={e => setDraft('hasPhone', e.target.value)} className="input w-full text-sm">
                    <option value="">Any</option>
                    <option value="yes">Has phone</option>
                    <option value="no">No phone</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <button onClick={applyFilters} className="btn-primary text-sm px-5">Apply Filters</button>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
                    Clear all ({activeFilterCount})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active filter / incomplete chips */}
          {(incompleteFilter || activeFilterCount > 0) && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
              {incompleteFilter && (
                <>
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                    Incomplete profiles only
                  </span>
                  <button onClick={() => { setIncompleteFilter(false); setPage(1); }} className="text-xs text-gray-500 hover:text-gray-700 underline">
                    Clear
                  </button>
                </>
              )}
              {activeFilterCount > 0 && (
                <>
                  <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-full px-3 py-1">
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                  </span>
                  <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">
                    Clear filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
          <StatCard
            label="Total Clients"
            value={summary.totalClients}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatCard
            label="Total Lifetime Value"
            value={formatCurrency(summary.totalSpent)}
            valueColor="text-gray-900 text-lg sm:text-xl"
            hidden={isHidden('totalSpent')}
            onToggle={() => toggleCard('totalSpent')}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Total Visits"
            value={summary.totalVisits}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            label="Total Loyalty Points"
            value={summary.totalPoints.toLocaleString()}
            valueColor="text-amber-600 text-xl sm:text-2xl"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
          />
        </div>

        {/* Clients Table */}
        <div className="card">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No clients found</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add your first client
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Visits</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Last Visit</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Last Branch</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Joined</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/clients/${client.id}`)}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center shrink-0 relative">
                            <span className="text-brand-primary font-semibold">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                            {getMissingFields(client).length > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                                <span className="text-white text-[9px] font-bold leading-none">!</span>
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-brand-primary transition-colors">
                                {client.name}
                              </Link>
                              {getMissingFields(client).length > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); e.preventDefault(); setEditingClient(client); setShowModal(true); }}
                                  className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 leading-none hover:bg-amber-100 transition-colors"
                                  title={`Missing: ${getMissingFields(client).join(', ')}`}
                                >
                                  {getMissingFields(client).length} missing
                                </button>
                              )}
                            </div>
                            {client.birthday && (
                              <p className="text-xs text-gray-500">🎂 {formatDate(client.birthday)}</p>
                            )}
                            {client.registered_at_branch_name && (
                              <p className="text-xs text-gray-400 mt-0.5">Registered · {client.registered_at_branch_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {client.phone
                          ? <p className="text-sm text-gray-900">{client.phone}</p>
                          : <p className="text-sm text-amber-500 italic">No phone</p>
                        }
                        {client.email
                          ? <p className="text-xs text-gray-500">{client.email}</p>
                          : <p className="text-xs text-amber-400 italic">No email</p>
                        }
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-primary/10 text-brand-primary">
                          {client.loyalty_points || 0} pts
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(client.total_spent || 0)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                          {client.total_visits || 0}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-sm text-gray-600">
                        {client.last_visit ? formatDate(client.last_visit) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {client.last_visit_branch_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {client.last_visit_branch_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right text-sm text-gray-600">
                        {formatDate(client.created_at)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(openMenuId === client.id ? null : client.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {rangeStart}-{rangeEnd} of {pagination.total} clients
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                {getVisiblePages().map((pageNumber, index, arr) => {
                  const previous = index > 0 ? arr[index - 1] : null;
                  const shouldShowEllipsis = previous !== null && pageNumber - previous > 1;

                  return (
                    <span key={`page-wrap-${pageNumber}`} className="flex items-center gap-2">
                      {shouldShowEllipsis && <span className="text-gray-400">...</span>}
                      <button
                        onClick={() => setPage(pageNumber)}
                        className={`w-9 h-9 text-sm rounded-lg border ${
                          pagination.page === pageNumber
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}

                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed-position row action dropdown ── */}
      {openMenuId && menuPos && (() => {
        const c = clients.find(cl => cl.id === openMenuId);
        if (!c) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div
              className="fixed z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <Link
                href={`/clients/${c.id}`}
                onClick={() => setOpenMenuId(null)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Profile
              </Link>
              {getMissingFields(c).length > 0 && (
                <button
                  onClick={() => { setEditingClient(c); setShowModal(true); setOpenMenuId(null); }}
                  className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Complete Profile
                </button>
              )}
              <button
                onClick={() => { setEditingClient(c); setShowModal(true); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { handleDeleteClient(c); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </>
        );
      })()}

      {SecurityModal}

      {/* Add/Edit Modal */}
      {showModal && (
        <ClientModal
          client={editingClient}
          salon={salon}
          onClose={() => {
            setShowModal(false);
            setEditingClient(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingClient(null);
            loadClients(page, searchQuery);
          }}
        />
      )}
    </div>
  );
}
