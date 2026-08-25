'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Client, Visit, LoyaltyTier } from '@/types';
import { SalonHeader } from '@/components/SalonBranding';
import { DateRangePicker } from '@/components/ui';
import { ClientModal } from '@/components/ClientModal';
import { formatCurrency, localDateStr, getClientMissingFields } from '@/lib/utils';
import { useSalon } from '@/contexts/SalonContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

interface ClientAnalytics {
  monthlySpend: { month: string; revenue: number; visits: number }[];
  servicePreferences: { service_name: string; category: string; count: number; revenue: number }[];
  visitFrequency: { avgDaysBetween: number | null; daysSinceLast: number | null; isAtRisk: boolean; totalVisits: number };
}

const PERIODS = [
  { value: 'all',        label: 'All Time' },
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

function getPeriodRange(period: string): { from: string; to: string } | null {
  const now = new Date();
  const today = localDateStr();
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      return { from: localDateStr(d), to: today };
    }
    case 'month':
      return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
      return { from: localDateStr(d), to: localDateStr(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: today };
    default: return null;
  }
}

export default function ClientProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const clientId = String(params.id);

  const [client, setClient]           = useState<Client | null>(null);
  const [visits, setVisits]           = useState<Visit[]>([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [period, setPeriod]           = useState('all');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [fromDate, setFromDate]        = useState('');
  const [toDate, setToDate]            = useState('');

  const [referralSourceName, setReferralSourceName] = useState<string | null>(null);
  const [referredByClient, setReferredByClient]     = useState<{ id: string; name: string; phone: string } | null>(null);
  const [referredClients, setReferredClients]       = useState<{ id: string; name: string; phone: string; created_at: string }[]>([]);
  const [showAllReferrals, setShowAllReferrals]     = useState(false);
  const [analytics, setAnalytics]                  = useState<ClientAnalytics | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const REFERRALS_PAGE_SIZE = 8;

  // Load static client info
  const loadClient = useCallback(async () => {
    try {
      const [clientRes, tiersRes, sourcesRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch('/api/loyalty/tiers'),
        fetch('/api/referral-sources'),
      ]);
      if (clientRes.status === 401) { router.push('/login'); return; }
      if (clientRes.status === 404) { setClient(null); setLoading(false); return; }
      const [clientData, tiersData, sourcesData] = await Promise.all([clientRes.json(), tiersRes.json(), sourcesRes.json()]);
      setClient(clientData || null);
      setLoyaltyTiers(tiersData || []);

      if (clientData?.referral_source_id && Array.isArray(sourcesData)) {
        const src = sourcesData.find((s: any) => s.id === clientData.referral_source_id);
        if (src) setReferralSourceName(src.name);
      }

      if (clientData?.referred_by_client_id) {
        const refRes = await fetch(`/api/clients/${clientData.referred_by_client_id}`);
        if (refRes.ok) setReferredByClient(await refRes.json());
      }

      const refListRes = await fetch(`/api/clients?referred_by_client_id=${clientId}`);
      if (refListRes.ok) setReferredClients(await refListRes.json());
    } catch { alert('Failed to load client'); }
    finally { setLoading(false); }
  }, [clientId, router]);

  useEffect(() => { loadClient(); }, [loadClient]);

  const handleDeleteClient = () => {
    if (!client) return;
    const confirmed = window.confirm(`Delete client ${client.name}? This will archive the client and hide them from normal views.`);
    if (!confirmed) return;
    run(`delete:${client.id}`, () => guardAction('sensitive', async () => {
      const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete client');
      }
      toast.success('Client deleted successfully');
      router.push('/clients');
    }));
  };

  // Load analytics once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/clients/analytics?client_id=${clientId}`);
        if (res.ok) setAnalytics(await res.json());
      } catch { /* silent */ }
    })();
  }, [clientId]);

  // Load visits whenever period changes
  const loadVisits = useCallback(async () => {
    setVisitsLoading(true);
    try {
      const qs = new URLSearchParams({ client_id: clientId, limit: '200' });
      if (period === 'custom') {
        if (fromDate) qs.set('from_date', fromDate);
        if (toDate)   qs.set('to_date', toDate);
      } else {
        const range = getPeriodRange(period);
        if (range) { qs.set('from_date', range.from); qs.set('to_date', range.to); }
      }
      const res = await fetch(`/api/visits?${qs}`);
      if (res.ok) setVisits(await res.json());
    } finally { setVisitsLoading(false); }
  }, [clientId, period, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) loadVisits();
  }, [loadVisits, period, fromDate, toDate]);

  const nextTier      = loyaltyTiers.find(t => t.points_required > (client?.loyalty_points || 0)) ?? null;
  const achievedTiers = loyaltyTiers.filter(t => t.points_required <= (client?.loyalty_points || 0));
  const pointsToNext  = nextTier ? nextTier.points_required - (client?.loyalty_points || 0) : 0;

  // Derived period stats
  const periodTotal   = visits.reduce((s, v) => s + Number(v.total_amount), 0);
  const periodAvg     = visits.length > 0 ? periodTotal / visits.length : 0;

  const serviceCounts: Record<string, { name: string; count: number }> = {};
  const staffCounts:   Record<string, { name: string; count: number }> = {};
  visits.forEach(v => {
    (v.visit_services || []).forEach((vs: any) => {
      const sname = vs.service?.name || 'Unknown';
      serviceCounts[sname] = serviceCounts[sname] || { name: sname, count: 0 };
      serviceCounts[sname].count += vs.quantity || 1;
    });
    if ((v as any).staff?.name) {
      const sn = (v as any).staff.name;
      staffCounts[sn] = staffCounts[sn] || { name: sn, count: 0 };
      staffCounts[sn].count++;
    }
  });
  const topService = Object.values(serviceCounts).sort((a, b) => b.count - a.count)[0] ?? null;
  const topStaff   = Object.values(staffCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
    </div>
  );

  if (!client) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Client not found</p>
        <Link href="/clients" className="btn-primary">Back to Clients</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Client Profile">
        <Link href="/clients" className="btn-secondary text-sm">← All Clients</Link>
      </SalonHeader>
      {SecurityModal}
      {showEditModal && (
        <ClientModal
          client={client}
          salon={salon}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => { setShowEditModal(false); loadClient(); }}
        />
      )}

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Client Identity Card ── */}
        <div className="card relative">
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                  {getClientMissingFields(client).length > 0 && (
                    <button
                      onClick={() => { setShowEditModal(true); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Complete Profile
                    </button>
                  )}
                  <button
                    onClick={() => { setShowEditModal(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    disabled={isPending(`delete:${client.id}`)}
                    onClick={() => { handleDeleteClient(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-2xl font-bold shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{client.name}</h2>
                <p className="text-gray-500">{client.phone}</p>
                {client.email && <p className="text-gray-400 text-sm">{client.email}</p>}
                {client.birthday && <p className="text-gray-400 text-sm">🎂 {new Date(client.birthday.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {referralSourceName && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      {referralSourceName}
                    </span>
                  )}
                  {referredByClient && (
                    <Link href={`/clients/${referredByClient.id}`} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full hover:bg-green-100">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Referred by {referredByClient.name}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="md:ml-auto md:pr-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{client.total_visits}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Visits</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(client.total_spent)}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time Spend</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-amber-600">{client.loyalty_points}</p>
                <p className="text-xs text-gray-500 mt-0.5">Loyalty Points</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-semibold text-gray-900">{client.last_visit ? new Date(client.last_visit).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">Last Visit</p>
                {(client as any).last_visit_branch_name && (
                  <p className="text-xs text-brand-primary mt-0.5 font-medium">{(client as any).last_visit_branch_name}</p>
                )}
              </div>
              {(client as any).registered_at_branch_name && (
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900">{(client as any).registered_at_branch_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Registered At</p>
                </div>
              )}
            </div>
          </div>

          {/* Loyalty progress */}
          {nextTier && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{achievedTiers.length > 0 ? achievedTiers[achievedTiers.length - 1].name : 'Starter'}</span>
                <span>{pointsToNext} pts to {nextTier.name}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min((client.loyalty_points / nextTier.points_required) * 100, 100)}%` }}
                />
              </div>
              {achievedTiers.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">{achievedTiers.map(t => t.name).join(', ')} reward{achievedTiers.length > 1 ? 's' : ''} available</p>
              )}
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
            <p className="text-sm text-gray-500">Visits</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : visits.length}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : formatCurrency(periodTotal)}</p>
          </div>
          <div className="card border-l-4 border-blue-400">
            <p className="text-sm text-gray-500">Avg per Visit</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{visitsLoading ? '…' : formatCurrency(periodAvg)}</p>
          </div>
          <div className="card border-l-4 border-purple-400">
            <p className="text-sm text-gray-500">Top Service</p>
            <p className="text-sm font-bold text-gray-900 mt-1 truncate">{visitsLoading ? '…' : topService?.name || '—'}</p>
            {topService && <p className="text-xs text-gray-400">{topService.count}× booked</p>}
          </div>
        </div>

        {/* ── Visit Frequency & Last Seen ── */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`card border-l-4 ${analytics.visitFrequency.isAtRisk ? 'border-red-400' : 'border-green-400'}`}>
              <p className="text-xs text-gray-500 uppercase font-medium">Last Seen</p>
              <p className={`text-2xl font-bold mt-1 ${analytics.visitFrequency.isAtRisk ? 'text-red-600' : 'text-gray-900'}`}>
                {analytics.visitFrequency.daysSinceLast !== null ? `${analytics.visitFrequency.daysSinceLast}d ago` : '—'}
              </p>
              {analytics.visitFrequency.isAtRisk && (
                <span className="inline-block mt-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">At Risk</span>
              )}
            </div>
            <div className="card border-l-4 border-blue-400">
              <p className="text-xs text-gray-500 uppercase font-medium">Avg Visit Gap</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {analytics.visitFrequency.avgDaysBetween !== null ? `${analytics.visitFrequency.avgDaysBetween}d` : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">between visits</p>
            </div>
            <div className="card border-l-4 border-purple-400">
              <p className="text-xs text-gray-500 uppercase font-medium">Top Service</p>
              <p className="text-sm font-bold text-gray-900 mt-1 truncate">
                {analytics.servicePreferences[0]?.service_name || '—'}
              </p>
              {analytics.servicePreferences[0] && (
                <p className="text-xs text-gray-400 mt-0.5">{analytics.servicePreferences[0].count}× all-time</p>
              )}
            </div>
          </div>
        )}

        {/* ── Monthly Spend Trend ── */}
        {analytics && analytics.monthlySpend.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold text-gray-900 mb-4">Monthly Spend (last 12 months)</p>
            <div className="flex items-end gap-1 h-24">
              {(() => {
                const maxRev = Math.max(...analytics.monthlySpend.map(m => m.revenue), 1);
                return analytics.monthlySpend.map(m => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full rounded-t bg-brand-primary/80 min-h-[2px] transition-all hover:bg-brand-primary"
                      style={{ height: `${(m.revenue / maxRev) * 88}px` }}
                    />
                    <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 hidden sm:block">
                      {m.month.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                      {m.month}: {formatCurrency(m.revenue)} · {m.visits} visit{m.visits !== 1 ? 's' : ''}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── Service Preferences ── */}
        {analytics && analytics.servicePreferences.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold text-gray-900 mb-4">All-time Service Preferences</p>
            <div className="space-y-2">
              {analytics.servicePreferences.slice(0, 6).map((s, i) => {
                const maxCount = analytics.servicePreferences[0]?.count || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate max-w-[60%]">{s.service_name}</span>
                      <span className="text-gray-500 shrink-0">{s.count}× · {formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-primary/70 transition-all"
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Referral Activity ── */}
        {referredClients.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Clients Referred</h3>
                <p className="text-xs text-gray-400 mt-0.5">People {client.name.split(' ')[0]} has brought to the salon</p>
              </div>
              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">{referredClients.length}{referredClients.length === 50 ? '+' : ''} referral{referredClients.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {(showAllReferrals ? referredClients : referredClients.slice(0, REFERRALS_PAGE_SIZE)).map(rc => (
                <Link key={rc.id} href={`/clients/${rc.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary text-sm font-bold shrink-0">
                      {rc.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rc.name}</p>
                      <p className="text-xs text-gray-400">{rc.phone}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(rc.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </Link>
              ))}
            </div>
            {referredClients.length > REFERRALS_PAGE_SIZE && (
              <button
                onClick={() => setShowAllReferrals(prev => !prev)}
                className="w-full py-3 text-sm text-brand-primary font-medium hover:bg-gray-50 border-t border-gray-100 transition-colors"
              >
                {showAllReferrals ? 'Show less' : `Show all ${referredClients.length} referrals`}
              </button>
            )}
          </div>
        )}

        {/* ── Favourite Staff ── */}
        {topStaff && !visitsLoading && (
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              {topStaff.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{topStaff.name}</p>
              <p className="text-xs text-gray-500">Favourite stylist · served {topStaff.count} time{topStaff.count !== 1 ? 's' : ''} in this period</p>
            </div>
          </div>
        )}

        {/* ── Visit History ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Visit History</h3>
            <span className="text-sm text-gray-400">{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
          </div>

          {visitsLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : visits.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No visits in this period.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visits.map(visit => {
                const expanded = expandedId === visit.id;
                const staffName = (visit as any).staff?.name;
                return (
                  <div key={visit.id}>
                    <button
                      className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(expanded ? null : visit.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(visit.created_at).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-gray-500">
                              #{visit.receipt_number}{staffName ? ` · ${staffName}` : ''}
                            </p>
                            {(visit as any).branch_name && (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {(visit as any).branch_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="font-bold text-gray-900">{formatCurrency(visit.total_amount)}</p>
                            <p className="text-xs text-amber-600">+{visit.points_earned} pts</p>
                          </div>
                          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                        <div className="pt-3 space-y-1">
                          {(visit.visit_services || []).map((vs: any) => (
                            <div key={vs.id} className="flex justify-between text-sm">
                              <span className="text-gray-700">{vs.quantity}× {vs.service?.name || 'Unknown service'}</span>
                              <span className="font-medium text-gray-900">{formatCurrency((vs.unit_price || vs.price || 0) * (vs.quantity || 1))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                            <span>{visit.payment_method.replace('_', ' ').toUpperCase()}</span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              visit.payment_status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{visit.payment_status}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
