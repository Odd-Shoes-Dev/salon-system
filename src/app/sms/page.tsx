'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import type { SmsMessage, SmsBalance, SmsStats, SmsTransaction } from '@/lib/sms';

type SegmentType = 'last_7_days' | 'last_30_days' | 'not_30_60' | 'not_60_plus' | 'never_visited' | 'custom';

interface Campaign {
  id: string;
  name: string | null;
  segment_type: SegmentType;
  segment_params: { last_visit_after?: string; last_visit_before?: string } | null;
  message_template: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: 'sending' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  created_by_name: string | null;
}

interface CampaignMessage {
  id: string;
  client_name: string | null;
  phone: string;
  message_text: string;
  status: 'sent' | 'failed';
  error: string | null;
  sent_at: string | null;
}

interface PreviewClient {
  id: string;
  name: string;
  phone: string;
  last_visit: string | null;
}

const SEGMENT_LABELS: Record<SegmentType, string> = {
  last_7_days:   'Visited in last 7 days',
  last_30_days:  'Visited in last 30 days',
  not_30_60:     'Not visited in 30–60 days',
  not_60_plus:   'Not visited in 60+ days',
  never_visited: 'Never visited',
  custom:        'Custom date range',
};

const MESSAGE_TEMPLATES = [
  { label: 'Follow-up',     text: 'Hi {clientName}! We hope you\'re loving the results from your recent visit. Let us know if there\'s anything we can do for you at {salonName}!' },
  { label: 'We miss you',   text: 'Hi {clientName}! We\'ve been missing you at {salonName}. Come back in and treat yourself — we\'d love to see you again!' },
  { label: 'Check-in',      text: 'Hi {clientName}! Just checking in from {salonName}. How are things going? We\'d love to have you visit us soon!' },
  { label: 'Special offer', text: 'Hi {clientName}! We have something special waiting for you at {salonName}. Come in soon and ask about our latest offers!' },
];

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  delivered: { badge: 'bg-green-50 text-green-700',   label: 'Delivered' },
  failed:    { badge: 'bg-red-50 text-red-700',       label: 'Failed'    },
  submitted: { badge: 'bg-blue-50 text-blue-700',     label: 'Submitted' },
  queued:    { badge: 'bg-amber-50 text-amber-700',   label: 'Queued'    },
  scheduled: { badge: 'bg-purple-50 text-purple-700', label: 'Scheduled' },
  sending:   { badge: 'bg-indigo-50 text-indigo-700', label: 'Sending'   },
};

const TX_TYPE_LABELS: Record<string, string> = {
  credit:        'Top-up',
  sms_charge:    'SMS charge',
  manual_credit: 'Manual credit',
  manual_debit:  'Manual debit',
  refund:        'Refund',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const MSG_LIMIT = 25;
const TX_LIMIT  = 20;

export default function SmsPage() {
  const { user } = useUser();
  const isAdmin = user && ['owner', 'admin'].includes(user.role);
  const canView = user && ['owner', 'admin', 'manager'].includes(user.role);

  // Balance
  const [balance, setBalance]               = useState<SmsBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [toppingUp, setToppingUp]           = useState(false);

  // Stats
  const [stats, setStats] = useState<SmsStats | null>(null);

  // Messages tab
  const [messages, setMessages]     = useState<SmsMessage[]>([]);
  const [msgTotal, setMsgTotal]     = useState(0);
  const [msgPage, setMsgPage]       = useState(0);
  const [msgStatus, setMsgStatus]   = useState('');
  const [msgLoading, setMsgLoading] = useState(false);

  // Transactions tab
  const [activeTab, setActiveTab]             = useState<'messages' | 'transactions' | 'campaigns'>('messages');
  const [transactions, setTransactions]       = useState<SmsTransaction[]>([]);
  const [txTotal, setTxTotal]                 = useState(0);
  const [txPage, setTxPage]                   = useState(0);
  const [txLoading, setTxLoading]             = useState(false);

  // Campaigns tab
  const [campaigns, setCampaigns]             = useState<Campaign[]>([]);
  const [campTotal, setCampTotal]             = useState(0);
  const [campLoading, setCampLoading]         = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail]   = useState<Record<string, CampaignMessage[]>>({});
  const [detailLoading, setDetailLoading]     = useState<string | null>(null);

  // New campaign modal
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campStep, setCampStep]               = useState<1 | 2 | 3 | 4>(1);
  const [campSegment, setCampSegment]         = useState<SegmentType>('last_7_days');
  const [campCustomAfter, setCampCustomAfter] = useState('');
  const [campCustomBefore, setCampCustomBefore] = useState('');
  const [campName, setCampName]               = useState('');
  const [campTemplate, setCampTemplate]       = useState(MESSAGE_TEMPLATES[0].text);
  const [previewClients, setPreviewClients]   = useState<PreviewClient[]>([]);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [sending, setSending]                 = useState(false);

  const loadBalance = useCallback(async () => {
    if (!isAdmin) return;
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/sms/balance');
      if (res.ok) setBalance(await res.json());
      else toast.error('Could not load balance');
    } finally {
      setBalanceLoading(false);
    }
  }, [isAdmin]);

  const loadStats = useCallback(async () => {
    if (!canView) return;
    const res = await fetch('/api/sms/stats');
    if (res.ok) setStats(await res.json());
  }, [canView]);

  const loadMessages = useCallback(async () => {
    if (!canView) return;
    setMsgLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(msgPage), limit: String(MSG_LIMIT) });
      if (msgStatus) qs.set('status', msgStatus);
      const res = await fetch(`/api/sms/messages?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        setMsgTotal(data.total ?? 0);
      }
    } finally {
      setMsgLoading(false);
    }
  }, [canView, msgPage, msgStatus]);

  const loadTransactions = useCallback(async () => {
    if (!isAdmin) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/sms/transactions?page=${txPage}&limit=${TX_LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions ?? []);
        setTxTotal(data.total ?? 0);
      }
    } finally {
      setTxLoading(false);
    }
  }, [isAdmin, txPage]);

  const loadCampaigns = useCallback(async () => {
    if (!canView) return;
    setCampLoading(true);
    try {
      const res = await fetch('/api/sms/campaigns?limit=20');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
        setCampTotal(data.total ?? 0);
      }
    } finally {
      setCampLoading(false);
    }
  }, [canView]);

  const loadCampaignDetail = async (id: string) => {
    if (campaignDetail[id]) { setExpandedCampaign(id); return; }
    setDetailLoading(id);
    try {
      const res = await fetch(`/api/sms/campaigns/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaignDetail(prev => ({ ...prev, [id]: data.messages ?? [] }));
        setExpandedCampaign(id);
      }
    } finally {
      setDetailLoading(null);
    }
  };

  const loadPreview = async (seg: SegmentType, after?: string, before?: string) => {
    setPreviewLoading(true);
    try {
      const qs = new URLSearchParams({ segment_type: seg });
      if (after)  qs.set('last_visit_after',  after);
      if (before) qs.set('last_visit_before', before);
      const res = await fetch(`/api/sms/campaigns/preview?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewClients(data.clients ?? []);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendCampaign = async () => {
    setSending(true);
    try {
      const body: any = {
        name: campName.trim() || null,
        segment_type: campSegment,
        message_template: campTemplate.trim(),
      };
      if (campSegment === 'custom') {
        body.segment_params = { last_visit_after: campCustomAfter || undefined, last_visit_before: campCustomBefore || undefined };
      }
      const res = await fetch('/api/sms/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Campaign sent to ${data.sent_count} client${data.sent_count !== 1 ? 's' : ''}${data.failed_count > 0 ? ` (${data.failed_count} failed)` : ''}`);
      setShowNewCampaign(false);
      resetCampaignForm();
      loadCampaigns();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const resetCampaignForm = () => {
    setCampStep(1);
    setCampSegment('last_7_days');
    setCampCustomAfter('');
    setCampCustomBefore('');
    setCampName('');
    setCampTemplate(MESSAGE_TEMPLATES[0].text);
    setPreviewClients([]);
  };

  useEffect(() => { loadBalance(); loadStats(); }, [loadBalance, loadStats]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { if (activeTab === 'transactions') loadTransactions(); }, [activeTab, loadTransactions]);
  useEffect(() => { if (activeTab === 'campaigns') loadCampaigns(); }, [activeTab, loadCampaigns]);

  const handleTopUp = async () => {
    setToppingUp(true);
    try {
      const res  = await fetch('/api/sms/topup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.checkout_url, '_blank');
    } catch (e: any) {
      toast.error(e.message || 'Failed to initiate top-up');
    } finally {
      setToppingUp(false);
    }
  };

  const msgTotalPages = Math.ceil(msgTotal / MSG_LIMIT);
  const txTotalPages  = Math.ceil(txTotal  / TX_LIMIT);

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SalonHeader />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">
          You don't have access to this page.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <PageHeader
          title="SMS"
          subtitle="Monitor delivery, track your balance, and review message history"
        />

        {/* ── Balance + Stats ── */}
        <div className={`grid gap-4 ${isAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {isAdmin && (
            <div className="card p-5 flex flex-col gap-3 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Wallet Balance</p>
                <button
                  onClick={loadBalance}
                  disabled={balanceLoading}
                  className="text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                  title="Refresh"
                >
                  <svg className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <p className="text-3xl font-bold text-indigo-900">
                {balance ? `$${Number(balance.balance).toFixed(2)}` : balanceLoading ? '…' : '—'}
                {balance && <span className="text-sm font-normal text-indigo-400 ml-1">{balance.currency}</span>}
              </p>
              {balance && balance.balance < 5 && (
                <p className="text-xs text-red-600 font-medium">⚠ Low balance — top up soon</p>
              )}
              <button
                onClick={handleTopUp}
                disabled={toppingUp}
                className="mt-auto text-sm font-medium py-2 px-4 rounded-lg text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#6366f1' }}
              >
                {toppingUp ? 'Redirecting…' : '+ Top Up'}
              </button>
            </div>
          )}

          <div className="card p-5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Delivery Rate</p>
            <p className="text-3xl font-bold text-gray-900">
              {stats ? `${Number(stats.delivery_rate).toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400">All time</p>
          </div>

          <div className="card p-5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Sent</p>
            <p className="text-3xl font-bold text-gray-900">
              {stats ? Number(stats.total_sent).toLocaleString() : '—'}
            </p>
            <p className="text-xs text-gray-400">Messages</p>
          </div>

          <div className="card p-5 flex flex-col gap-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Failed</p>
            <p className={`text-3xl font-bold ${stats && stats.total_failed > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {stats ? Number(stats.total_failed).toLocaleString() : '—'}
            </p>
            <p className="text-xs text-gray-400">Messages</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          {(['messages', 'campaigns', ...(isAdmin ? ['transactions'] : [])] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'messages' ? 'Message Log' : tab === 'campaigns' ? 'Campaigns' : 'Transactions'}
            </button>
          ))}
          {activeTab === 'campaigns' && (
            <button
              onClick={() => { setShowNewCampaign(true); setCampStep(1); }}
              className="ml-auto btn-primary text-sm"
            >
              + New Campaign
            </button>
          )}
        </div>

        {/* ── Message Log ── */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={msgStatus}
                onChange={e => { setMsgStatus(e.target.value); setMsgPage(0); }}
                className="input text-sm"
              >
                <option value="">All statuses</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="submitted">Submitted</option>
                <option value="queued">Queued</option>
                <option value="scheduled">Scheduled</option>
              </select>
              <p className="text-sm text-gray-400 ml-auto">
                {msgTotal.toLocaleString()} message{msgTotal !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="card p-0 overflow-hidden">
              {msgLoading ? (
                <div className="p-10 text-center text-gray-400">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No messages found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Delivered</th>
                        {isAdmin && <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {messages.map(m => {
                        const s = STATUS_STYLES[m.status] ?? { badge: 'bg-gray-100 text-gray-500', label: m.status };
                        return (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono text-sm text-gray-800 whitespace-nowrap">{m.phone}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                              <p className="line-clamp-2">{m.text}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>{s.label}</span>
                              {m.error_code && <p className="text-xs text-red-500 mt-0.5">{m.error_code}</p>}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(m.sent_at)}</td>
                            <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                              {m.delivered_at ? fmtDate(m.delivered_at) : <span className="text-gray-300">—</span>}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                                ${Number(m.cost).toFixed(4)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {msgTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setMsgPage(p => Math.max(0, p - 1))} disabled={msgPage === 0} className="btn-secondary text-sm disabled:opacity-40">← Previous</button>
                <span className="text-sm text-gray-500">Page {msgPage + 1} of {msgTotalPages}</span>
                <button onClick={() => setMsgPage(p => Math.min(msgTotalPages - 1, p + 1))} disabled={msgPage >= msgTotalPages - 1} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ── Transactions ── */}
        {activeTab === 'transactions' && isAdmin && (
          <div className="space-y-4">
            <div className="card p-0 overflow-hidden">
              {txLoading ? (
                <div className="p-10 text-center text-gray-400">Loading…</div>
              ) : transactions.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No transactions found.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            ['credit', 'manual_credit', 'refund'].includes(tx.type)
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {TX_TYPE_LABELS[tx.type] ?? tx.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{tx.description}</td>
                        <td className={`py-3 px-4 text-sm font-medium text-right whitespace-nowrap ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-700'}`}>
                          {tx.amount >= 0 ? '+' : ''}${Number(tx.amount).toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 text-right whitespace-nowrap">
                          ${Number(tx.balance_after).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {txTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0} className="btn-secondary text-sm disabled:opacity-40">← Previous</button>
                <span className="text-sm text-gray-500">Page {txPage + 1} of {txTotalPages}</span>
                <button onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={txPage >= txTotalPages - 1} className="btn-secondary text-sm disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>
        )}

        {/* ── Campaigns tab ── */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            {campLoading ? (
              <div className="card p-10 text-center text-gray-400">Loading…</div>
            ) : campaigns.length === 0 ? (
              <div className="card p-10 text-center text-gray-400">
                <p>No campaigns yet.</p>
                <button onClick={() => setShowNewCampaign(true)} className="mt-3 btn-primary text-sm">Send First Campaign</button>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Segment</th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">Recipients</th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">Failed</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {campaigns.map(c => (
                      <>
                        <tr
                          key={c.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            if (expandedCampaign === c.id) setExpandedCampaign(null);
                            else loadCampaignDetail(c.id);
                          }}
                        >
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-gray-900">{c.name || 'Untitled'}</p>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.message_template}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{SEGMENT_LABELS[c.segment_type] ?? c.segment_type}</td>
                          <td className="py-3 px-4 text-sm text-gray-700 text-center">{c.recipient_count}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-sm font-medium text-green-600">{c.sent_count}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-sm font-medium ${c.failed_count > 0 ? 'text-red-600' : 'text-gray-300'}`}>{c.failed_count}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">{c.created_by_name ?? '—'}</td>
                        </tr>
                        {expandedCampaign === c.id && (
                          <tr key={`${c.id}-detail`}>
                            <td colSpan={7} className="bg-gray-50 px-6 py-4">
                              {detailLoading === c.id ? (
                                <p className="text-xs text-gray-400">Loading…</p>
                              ) : (campaignDetail[c.id] ?? []).length === 0 ? (
                                <p className="text-xs text-gray-400">No message records.</p>
                              ) : (
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                  {(campaignDetail[c.id] ?? []).map(m => (
                                    <div key={m.id} className="flex items-center gap-3 text-xs py-1">
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${m.status === 'sent' ? 'bg-green-500' : 'bg-red-400'}`} />
                                      <span className="font-medium text-gray-700 w-36 truncate">{m.client_name ?? m.phone}</span>
                                      <span className="text-gray-400 font-mono">{m.phone}</span>
                                      {m.error && <span className="text-red-500 ml-2">{m.error}</span>}
                                      {m.sent_at && <span className="text-gray-400 ml-auto">{fmtDate(m.sent_at)}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New Campaign Modal ── */}
      {showNewCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowNewCampaign(false); resetCampaignForm(); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">New Campaign</h3>
                <p className="text-xs text-gray-400 mt-0.5">Step {campStep} of 4</p>
              </div>
              <button onClick={() => { setShowNewCampaign(false); resetCampaignForm(); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {/* Step indicators */}
            <div className="flex gap-1">
              {[1,2,3,4].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${campStep >= s ? 'bg-indigo-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            {/* Step 1 — Segment */}
            {campStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={campName} onChange={e => setCampName(e.target.value)} className="input w-full" placeholder="e.g. July re-engagement" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Who to message</label>
                  <div className="space-y-2">
                    {(Object.entries(SEGMENT_LABELS) as [SegmentType, string][]).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-gray-50 transition-colors">
                        <input type="radio" name="segment" value={val} checked={campSegment === val} onChange={() => setCampSegment(val)} className="accent-indigo-500" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {campSegment === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Last visit after</label>
                      <input type="date" value={campCustomAfter} onChange={e => setCampCustomAfter(e.target.value)} className="input w-full text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Last visit before</label>
                      <input type="date" value={campCustomBefore} onChange={e => setCampCustomBefore(e.target.value)} className="input w-full text-sm" />
                    </div>
                  </div>
                )}
                <button
                  onClick={async () => {
                    await loadPreview(campSegment, campCustomAfter || undefined, campCustomBefore || undefined);
                    setCampStep(2);
                  }}
                  className="w-full btn-primary text-sm"
                >
                  Preview Recipients →
                </button>
              </div>
            )}

            {/* Step 2 — Preview clients */}
            {campStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    {previewLoading ? 'Loading…' : `${previewClients.length} client${previewClients.length !== 1 ? 's' : ''} will receive this message`}
                  </p>
                  <span className="text-xs text-gray-400">{SEGMENT_LABELS[campSegment]}</span>
                </div>
                {previewClients.length === 0 && !previewLoading ? (
                  <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">No clients match this segment. Try a different filter.</p>
                ) : (
                  <div className="border border-gray-100 rounded-xl max-h-56 overflow-y-auto divide-y divide-gray-50">
                    {previewClients.map(cl => (
                      <div key={cl.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="font-medium text-gray-800">{cl.name}</span>
                        <span className="text-gray-400 font-mono text-xs">{cl.phone}</span>
                        <span className="text-gray-400 text-xs">{cl.last_visit ? new Date(cl.last_visit).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setCampStep(1)} className="flex-1 btn-secondary text-sm">← Back</button>
                  <button onClick={() => setCampStep(3)} disabled={previewClients.length === 0} className="flex-1 btn-primary text-sm disabled:opacity-50">Compose Message →</button>
                </div>
              </div>
            )}

            {/* Step 3 — Compose */}
            {campStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick templates</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MESSAGE_TEMPLATES.map(t => (
                      <button
                        key={t.label}
                        onClick={() => setCampTemplate(t.text)}
                        className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${campTemplate === t.text ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-gray-400 font-normal text-xs">— use {'{clientName}'} and {'{salonName}'}</span>
                  </label>
                  <textarea
                    value={campTemplate}
                    onChange={e => setCampTemplate(e.target.value)}
                    rows={5}
                    className="input w-full resize-none"
                    placeholder="Hi {clientName}! ..."
                  />
                  <p className="text-xs text-gray-400 mt-1">{campTemplate.length} characters</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCampStep(2)} className="flex-1 btn-secondary text-sm">← Back</button>
                  <button onClick={() => setCampStep(4)} disabled={!campTemplate.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">Review & Send →</button>
                </div>
              </div>
            )}

            {/* Step 4 — Confirm */}
            {campStep === 4 && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Segment</span>
                    <span className="font-medium text-gray-800">{SEGMENT_LABELS[campSegment]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Recipients</span>
                    <span className="font-medium text-gray-800">{previewClients.length} clients</span>
                  </div>
                  {campName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Name</span>
                      <span className="font-medium text-gray-800">{campName}</span>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Message preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {campTemplate.replaceAll('{clientName}', previewClients[0]?.name ?? 'Client').replaceAll('{salonName}', 'Your Salon')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCampStep(3)} className="flex-1 btn-secondary text-sm">← Back</button>
                  <button
                    onClick={sendCampaign}
                    disabled={sending}
                    className="flex-1 text-sm font-medium py-2 px-4 rounded-lg text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: '#6366f1' }}
                  >
                    {sending ? `Sending to ${previewClients.length} clients…` : `Send to ${previewClients.length} clients`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
