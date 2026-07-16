'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import type { SmsMessage, SmsBalance, SmsStats, SmsTransaction } from '@/lib/sms';

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
  const [activeTab, setActiveTab]             = useState<'messages' | 'transactions'>('messages');
  const [transactions, setTransactions]       = useState<SmsTransaction[]>([]);
  const [txTotal, setTxTotal]                 = useState(0);
  const [txPage, setTxPage]                   = useState(0);
  const [txLoading, setTxLoading]             = useState(false);

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

  useEffect(() => { loadBalance(); loadStats(); }, [loadBalance, loadStats]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { if (activeTab === 'transactions') loadTransactions(); }, [activeTab, loadTransactions]);

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
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'messages' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Message Log
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'transactions' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Transactions
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
      </div>
    </div>
  );
}
