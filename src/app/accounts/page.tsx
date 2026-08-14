'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader, StatCard, NumberInput } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useModalEsc } from '@/contexts/EscContext';
import { localDateStr } from '@/lib/utils';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

// ─── Types ────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'mtn_mobile_money' | 'airtel_money' | 'expense' | 'bank';
  is_system: boolean;
  is_active: boolean;
  balance: number;
  sort_order: number;
  bank_name?: string | null;
  account_number?: string | null;
  branch_name?: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  direction: 'in' | 'out';
  description: string | null;
  reference_type: string | null;
  transaction_date: string;
  created_at: string;
}

interface StaffAdvance {
  id: string;
  staff_id: string;
  staff_name: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'deducted' | 'cancelled';
  created_at: string;
  deducted_at: string | null;
  branch_name?: string | null;
}

interface StaffMember { id: string; name: string; }

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) =>
  'UGX ' + Math.abs(n).toLocaleString('en-UG');

const ACCOUNT_ICONS: Record<string, string> = {
  cash:             '💵',
  mtn_mobile_money: '📱',
  airtel_money:     '📲',
  expense:          '📋',
  bank:             '🏦',
};

type Tab = 'revenue' | 'advances';

const BLANK_ACCT_FORM = { name: '', type: 'bank' as 'bank' | 'expense', bank_name: '', account_number: '', branch_name: '' };

export default function AccountsPage() {
  const router        = useRouter();
  const { user }      = useUser();
  const { salon }     = useSalon();
  const brandColor    = salon?.theme_primary_color || '#6366f1';
  const canAccess     = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin      = ['owner', 'admin'].includes(user?.role || '');
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const [tab, setTab] = useState<Tab>('revenue');
  const [showInactive, setShowInactive] = useState(false);

  // Accounts
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const accounts = allAccounts.filter(a => showInactive || a.is_active);
  const [acctLoading, setAcctLoading] = useState(true);

  // Recent revenue transactions (across all revenue accounts, last 50)
  const [revTxns,    setRevTxns]    = useState<(Transaction & { account_name: string })[]>([]);
  const [revLoading, setRevLoading] = useState(false);

  // Staff advances
  const [advances,     setAdvances]     = useState<StaffAdvance[]>([]);
  const [advLoading,   setAdvLoading]   = useState(false);
  const [staffList,    setStaffList]    = useState<StaffMember[]>([]);

  // Modals
  const [addAcctModal,   setAddAcctModal]   = useState(false);
  const [editAcctModal,  setEditAcctModal]  = useState(false);
  const [transferModal,  setTransferModal]  = useState(false);
  const [advanceModal,   setAdvanceModal]   = useState(false);

  useModalEsc(addAcctModal,  () => setAddAcctModal(false));
  useModalEsc(editAcctModal, () => setEditAcctModal(false));
  useModalEsc(transferModal, () => setTransferModal(false));
  useModalEsc(advanceModal,  () => setAdvanceModal(false));

  // Forms
  const [acctForm,     setAcctForm]     = useState(BLANK_ACCT_FORM);
  const [editingAcct,  setEditingAcct]  = useState<Account | null>(null);
  const [savingAcct,   setSavingAcct]   = useState(false);

  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', amount: '', description: '', transfer_date: localDateStr() });
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [advForm, setAdvForm] = useState({ staff_id: '', amount: '', reason: '' });
  const [savingAdv,  setSavingAdv]  = useState(false);

  // ─── Load accounts ────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAcctLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error('Failed to load accounts'); return; }
      setAllAccounts(await res.json());
    } finally {
      setAcctLoading(false);
    }
  }, [router]);

  // ─── Load recent revenue transactions ─────────────────────────
  const loadRevTxns = useCallback(async (revAccounts: Account[]) => {
    if (revAccounts.length === 0) return;
    setRevLoading(true);
    try {
      const all: (Transaction & { account_name: string })[] = [];
      await Promise.all(
        revAccounts.map(async acct => {
          const res = await fetch(`/api/accounts/${acct.id}/transactions?limit=50`);
          if (res.ok) {
            const txns: Transaction[] = await res.json();
            txns.forEach(t => all.push({ ...t, account_name: acct.name }));
          }
        })
      );
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRevTxns(all.slice(0, 60));
    } finally {
      setRevLoading(false);
    }
  }, []);

  // ─── Load advances ─────────────────────────────────────────────
  const loadAdvances = useCallback(async () => {
    setAdvLoading(true);
    try {
      const res = await fetch('/api/staff-advances');
      if (res.ok) setAdvances(await res.json());
    } finally {
      setAdvLoading(false);
    }
  }, []);

  // ─── Load staff list ───────────────────────────────────────────
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/workers?active=true');
      if (res.ok) setStaffList(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user && !canAccess) { router.replace('/dashboard'); }
  }, [user, canAccess, router]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    if (tab === 'advances' && advances.length === 0) { loadAdvances(); loadStaff(); }
  }, [tab, advances.length, loadAdvances, loadStaff]);

  useEffect(() => {
    if (tab === 'revenue' && accounts.length > 0 && revTxns.length === 0) {
      loadRevTxns(accounts);
    }
  }, [tab, accounts, revTxns.length, loadRevTxns]);

  // ─── Derived data ─────────────────────────────────────────────
  const totalRevenue    = allAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalPendingAdv = advances.filter(a => a.status === 'pending').reduce((s, a) => s + Number(a.amount), 0);

  // ─── Handlers ─────────────────────────────────────────────────
  const createAccount = async () => {
    if (!acctForm.name.trim()) return;
    setSavingAcct(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: acctForm.name.trim(),
          type: acctForm.type,
          bank_name: acctForm.bank_name || undefined,
          account_number: acctForm.account_number || undefined,
          branch_name: acctForm.branch_name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Account created');
      setAcctForm(BLANK_ACCT_FORM);
      setAddAcctModal(false);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAcct(false);
    }
  };

  const openEditAccount = (acct: Account) => {
    setEditingAcct(acct);
    setAcctForm({
      name: acct.name,
      type: acct.type as 'bank' | 'expense',
      bank_name: acct.bank_name || '',
      account_number: acct.account_number || '',
      branch_name: acct.branch_name || '',
    });
    setEditAcctModal(true);
  };

  const updateAccount = async () => {
    if (!editingAcct || !acctForm.name.trim()) return;
    setSavingAcct(true);
    try {
      const res = await fetch(`/api/accounts/${editingAcct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: acctForm.name.trim(),
          bank_name: acctForm.bank_name || null,
          account_number: acctForm.account_number || null,
          branch_name: acctForm.branch_name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Account updated');
      setEditAcctModal(false);
      setEditingAcct(null);
      setAcctForm(BLANK_ACCT_FORM);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAcct(false);
    }
  };

  const deactivateAccount = (acct: Account) => {
    if (Number(acct.balance) !== 0) {
      toast.error(`Transfer the remaining balance (${fmt(Number(acct.balance))}) before deactivating this account.`);
      return;
    }
    if (!confirm(`Deactivate "${acct.name}"? It will be hidden from the accounts list.`)) return;
    run(`deactivate:${acct.id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/accounts/${acct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to deactivate'); return; }
      toast.success('Account deactivated');
      loadAccounts();
    }));
  };

  const reactivateAccount = (acct: Account) => run(`reactivate:${acct.id}`, () => guardAction('sensitive', async () => {
    const res = await fetch(`/api/accounts/${acct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to reactivate'); return; }
    toast.success('Account reactivated');
    loadAccounts();
  }));

  const submitTransfer = async () => {
    if (!transferForm.from_account_id || !transferForm.to_account_id) { toast.error('Select both accounts'); return; }
    const amt = parseFloat(transferForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSavingTransfer(true);
    try {
      const res = await fetch('/api/accounts/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: transferForm.from_account_id,
          to_account_id: transferForm.to_account_id,
          amount: amt,
          description: transferForm.description || undefined,
          transaction_date: transferForm.transfer_date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');
      toast.success('Transfer completed');
      setTransferModal(false);
      setTransferForm({ from_account_id: '', to_account_id: '', amount: '', description: '', transfer_date: localDateStr() });
      loadAccounts();
      setRevTxns([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingTransfer(false);
    }
  };

  const giveAdvance = async () => {
    const amt = parseFloat(advForm.amount);
    if (!advForm.staff_id) { toast.error('Select a staff member'); return; }
    if (!amt || amt <= 0)   { toast.error('Enter a valid amount'); return; }
    setSavingAdv(true);
    try {
      const res = await fetch('/api/staff-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: advForm.staff_id, amount: amt, reason: advForm.reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Advance recorded');
      setAdvanceModal(false);
      setAdvForm({ staff_id: '', amount: '', reason: '' });
      loadAdvances();
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAdv(false);
    }
  };

  const updateAdvanceStatus = (id: string, status: 'deducted' | 'cancelled') => run(`advance:${id}`, async () => {
    const res = await fetch(`/api/staff-advances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed');
    toast.success(status === 'deducted' ? 'Marked as deducted from salary' : 'Advance cancelled');
    loadAdvances();
  });

  // ─── Account form fields (shared between add & edit) ──────────
  const accountFormFields = (isBank: boolean) => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
        <input value={acctForm.name} onChange={e => setAcctForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Stanbic Business" className="input w-full" autoFocus />
      </div>
      {isBank && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input value={acctForm.bank_name} onChange={e => setAcctForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. Stanbic Bank" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input value={acctForm.account_number} onChange={e => setAcctForm(p => ({ ...p, account_number: e.target.value }))} placeholder="e.g. 9030012345678" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch (optional)</label>
            <input value={acctForm.branch_name} onChange={e => setAcctForm(p => ({ ...p, branch_name: e.target.value }))} placeholder="e.g. Kampala Main" className="input w-full" />
          </div>
        </>
      )}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Accounts" />
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        <PageHeader title="Accounts" subtitle="Track revenue accounts, bank accounts, and staff advances" />

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total Balance" value={fmt(totalRevenue)} center accent="border-t-4 border-green-400" valueColor="text-green-600 text-lg" />
          <StatCard label="Advances Outstanding" value={fmt(totalPendingAdv)} center accent="border-t-4 border-orange-400" valueColor="text-orange-600 text-lg" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['revenue', 'advances'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'advances' ? 'Staff Advances' : 'Accounts'}
            </button>
          ))}
        </div>

        {/* ── ACCOUNTS TAB ───────────────────────────────────────── */}
        {tab === 'revenue' && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canAdmin && (
                <button onClick={() => { setAcctForm(BLANK_ACCT_FORM); setAddAcctModal(true); }} className="btn-primary text-sm">+ Add Account</button>
              )}
              <button onClick={() => setTransferModal(true)} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">Transfer Money</button>
              {canAdmin && allAccounts.some(a => !a.is_active) && (
                <label className="ml-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded border-gray-300" />
                  Show inactive
                </label>
              )}
            </div>

            {acctLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(acct => (
                  <div key={acct.id} className={`card border-t-4 ${!acct.is_active ? 'opacity-50' : ''}`} style={{ borderTopColor: !acct.is_active ? '#9ca3af' : acct.type === 'bank' ? '#2563eb' : brandColor }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{ACCOUNT_ICONS[acct.type] || '📋'}</span>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {acct.name}
                            {!acct.is_active && <span className="ml-1.5 text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Inactive</span>}
                          </p>
                          {acct.type === 'bank' && acct.bank_name && (
                            <p className="text-xs text-gray-400">{acct.bank_name}{acct.account_number ? ` · ${acct.account_number}` : ''}</p>
                          )}
                        </div>
                      </div>
                      {canAdmin && !acct.is_system && (
                        <div className="flex gap-1">
                          {acct.is_active ? (
                            <>
                              <button onClick={() => openEditAccount(acct)} className="p-1 text-gray-400 hover:text-gray-600 rounded" title="Edit">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button disabled={isPending(`deactivate:${acct.id}`)} onClick={() => deactivateAccount(acct)} className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50" title="Deactivate">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          ) : (
                            <button disabled={isPending(`reactivate:${acct.id}`)} onClick={() => reactivateAccount(acct)} className="text-xs px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50">
                              {isPending(`reactivate:${acct.id}`) ? 'Activating…' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmt(Number(acct.balance))}</p>
                    <p className="text-xs text-gray-400 mt-1">{acct.type === 'bank' ? 'Bank balance' : 'Running balance'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent transactions */}
            <div className="card p-0 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
                <span className="text-xs text-gray-400">{revTxns.length} records</span>
              </div>
              {revLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
              ) : revTxns.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No transactions yet. Complete a sale to see data here.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {revTxns.slice(0, 40).map(t => {
                    const isTransfer = t.reference_type === 'transfer';
                    const isIn = t.direction === 'in';
                    const badge = (() => {
                      switch (t.reference_type) {
                        case 'visit':    return { label: 'Sale',     cls: 'bg-green-50 text-green-700 border-green-200' };
                        case 'expense':  return { label: 'Expense',  cls: 'bg-red-50 text-red-700 border-red-200' };
                        case 'advance':  return { label: 'Advance',  cls: 'bg-orange-50 text-orange-700 border-orange-200' };
                        case 'transfer': return { label: isIn ? 'Transfer In' : 'Transfer Out', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
                        default:         return { label: 'Manual',   cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                      }
                    })();
                    return (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isTransfer ? 'bg-blue-100 text-blue-700' :
                            isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isTransfer ? '⇄' : isIn ? '+' : '−'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.description || 'Transaction'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                              <span className="text-xs text-gray-400">{t.account_name} · {new Date(t.transaction_date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </div>
                        <p className={`text-sm font-semibold shrink-0 ${
                          isTransfer ? 'text-blue-600' : isIn ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isIn ? '+' : '−'}{fmt(Number(t.amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STAFF ADVANCES TAB ───────────────────────────────── */}
        {tab === 'advances' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Total pending: <span className="font-semibold text-orange-600">{fmt(totalPendingAdv)}</span>
                </p>
              </div>
              {canAdmin && (
                <button onClick={() => { loadStaff(); setAdvanceModal(true); }} className="btn-primary text-sm">Give Advance</button>
              )}
            </div>

            {advLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : advances.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-3">💸</p>
                <p className="font-medium text-gray-600">No advances recorded</p>
                <p className="text-sm text-gray-400 mt-1">Advances given to staff will appear here</p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {advances.map(adv => (
                    <div key={adv.id} className="flex items-center gap-4 px-4 py-4">
                      <div className="w-9 h-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold shrink-0">
                        {adv.staff_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{adv.staff_name}</p>
                        {adv.reason && <p className="text-xs text-gray-500">{adv.reason}</p>}
                        <p className="text-xs text-gray-400">{new Date(adv.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        {adv.branch_name && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {adv.branch_name}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(Number(adv.amount))}</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                          adv.status === 'pending'  ? 'bg-orange-100 text-orange-700' :
                          adv.status === 'deducted' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {adv.status.charAt(0).toUpperCase() + adv.status.slice(1)}
                        </span>
                      </div>
                      {canAdmin && adv.status === 'pending' && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            disabled={isPending(`advance:${adv.id}`)}
                            onClick={() => updateAdvanceStatus(adv.id, 'deducted')}
                            className="text-xs px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                          >
                            {isPending(`advance:${adv.id}`) ? 'Updating…' : 'Deducted'}
                          </button>
                          <button
                            disabled={isPending(`advance:${adv.id}`)}
                            onClick={() => updateAdvanceStatus(adv.id, 'cancelled')}
                            className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Add Account ── */}
      {addAcctModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setAddAcctModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Add Account</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <div className="flex gap-2">
                {(['bank', 'expense'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setAcctForm(p => ({ ...p, type: t }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${acctForm.type === t ? 'border-brand-primary bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/30' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {t === 'bank' ? '🏦 Bank' : '📋 Other'}
                  </button>
                ))}
              </div>
            </div>
            {accountFormFields(acctForm.type === 'bank')}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAddAcctModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={createAccount} disabled={savingAcct || !acctForm.name.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAcct ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Account ── */}
      {editAcctModal && editingAcct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setEditAcctModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Edit Account</h3>
            {accountFormFields(editingAcct.type === 'bank')}
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditAcctModal(false); setEditingAcct(null); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={updateAccount} disabled={savingAcct || !acctForm.name.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAcct ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Transfer Money ── */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setTransferModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Transfer Money</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
              <select value={transferForm.from_account_id} onChange={e => setTransferForm(p => ({ ...p, from_account_id: e.target.value }))} className="input w-full">
                <option value="">Select source…</option>
                {allAccounts.filter(a => a.is_active && a.id !== transferForm.to_account_id).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt(Number(a.balance))})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
              <select value={transferForm.to_account_id} onChange={e => setTransferForm(p => ({ ...p, to_account_id: e.target.value }))} className="input w-full">
                <option value="">Select destination…</option>
                {allAccounts.filter(a => a.is_active && a.id !== transferForm.from_account_id).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt(Number(a.balance))})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
              <NumberInput min="0" value={transferForm.amount} onChange={e => setTransferForm(p => ({ ...p, amount: e.target.value }))} className="input w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" max={localDateStr()} value={transferForm.transfer_date} onChange={e => setTransferForm(p => ({ ...p, transfer_date: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <input value={transferForm.description} onChange={e => setTransferForm(p => ({ ...p, description: e.target.value }))} className="input w-full" placeholder="e.g. End of day deposit" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setTransferModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={submitTransfer} disabled={savingTransfer || !transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingTransfer ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Give Advance ── */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setAdvanceModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Give Staff Advance</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
              <select value={advForm.staff_id} onChange={e => setAdvForm(p => ({ ...p, staff_id: e.target.value }))} className="input w-full">
                <option value="">Select staff…</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
              <NumberInput min="0" value={advForm.amount} onChange={e => setAdvForm(p => ({ ...p, amount: e.target.value }))} className="input w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <input value={advForm.reason} onChange={e => setAdvForm(p => ({ ...p, reason: e.target.value }))} className="input w-full" placeholder="e.g. Medical emergency" />
            </div>
            <p className="text-xs text-gray-400">This will be deducted from the Cash account balance.</p>
            <div className="flex gap-3">
              <button onClick={() => setAdvanceModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={giveAdvance} disabled={savingAdv} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAdv ? 'Saving…' : 'Give Advance'}
              </button>
            </div>
          </div>
        </div>
      )}
      {SecurityModal}
    </div>
  );
}
