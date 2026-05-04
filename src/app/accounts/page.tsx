'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';

// ─── Types ────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'mtn_mobile_money' | 'airtel_money' | 'expense';
  is_system: boolean;
  balance: number;
  sort_order: number;
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
};

const ACCOUNT_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN Mobile Money',
  airtel_money:     'Airtel Money',
};

type Tab = 'revenue' | 'expenses' | 'advances';

export default function AccountsPage() {
  const router        = useRouter();
  const { user }      = useUser();
  const canWrite      = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin      = ['owner', 'admin'].includes(user?.role || '');

  const [tab, setTab] = useState<Tab>('revenue');

  // Accounts
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [acctLoading, setAcctLoading] = useState(true);

  // Recent revenue transactions (across all revenue accounts, last 50)
  const [revTxns,    setRevTxns]    = useState<(Transaction & { account_name: string })[]>([]);
  const [revLoading, setRevLoading] = useState(false);

  // Expense transactions per selected account
  const [selExpAcct,    setSelExpAcct]    = useState<Account | null>(null);
  const [expTxns,       setExpTxns]       = useState<Transaction[]>([]);
  const [expTxnLoading, setExpTxnLoading] = useState(false);

  // Staff advances
  const [advances,     setAdvances]     = useState<StaffAdvance[]>([]);
  const [advLoading,   setAdvLoading]   = useState(false);
  const [staffList,    setStaffList]    = useState<StaffMember[]>([]);

  // Modals
  const [addAcctModal,   setAddAcctModal]   = useState(false);
  const [expenseModal,   setExpenseModal]   = useState(false);
  const [advanceModal,   setAdvanceModal]   = useState(false);

  // Forms
  const [newAcctName,  setNewAcctName]  = useState('');
  const [savingAcct,   setSavingAcct]   = useState(false);
  const [expForm, setExpForm] = useState({ account_id: '', amount: '', direction: 'out' as 'in'|'out', description: '', date: new Date().toISOString().split('T')[0] });
  const [savingExp,  setSavingExp]  = useState(false);
  const [advForm, setAdvForm] = useState({ staff_id: '', amount: '', reason: '' });
  const [savingAdv,  setSavingAdv]  = useState(false);

  // ─── Load accounts ────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    setAcctLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error('Failed to load accounts'); return; }
      setAccounts(await res.json());
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

  // ─── Load expense transactions for selected account ────────────
  const loadExpTxns = useCallback(async (acctId: string) => {
    setExpTxnLoading(true);
    try {
      const res = await fetch(`/api/accounts/${acctId}/transactions?limit=50`);
      if (res.ok) setExpTxns(await res.json());
    } finally {
      setExpTxnLoading(false);
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
      const res = await fetch('/api/staff');
      if (res.ok) setStaffList(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    if (tab === 'advances' && advances.length === 0) { loadAdvances(); loadStaff(); }
  }, [tab, advances.length, loadAdvances, loadStaff]);

  useEffect(() => {
    const rev = accounts.filter(a => a.type !== 'expense');
    if (tab === 'revenue' && rev.length > 0 && revTxns.length === 0) {
      loadRevTxns(rev);
    }
  }, [tab, accounts, revTxns.length, loadRevTxns]);

  // ─── Derived data ─────────────────────────────────────────────
  const revenueAccounts = accounts.filter(a => a.type !== 'expense');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');
  const totalRevenue    = revenueAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const totalExpenses   = expenseAccounts.reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
  const totalPendingAdv = advances.filter(a => a.status === 'pending').reduce((s, a) => s + Number(a.amount), 0);

  // ─── Handlers ─────────────────────────────────────────────────
  const createAccount = async () => {
    if (!newAcctName.trim()) return;
    setSavingAcct(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAcctName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Account created');
      setNewAcctName('');
      setAddAcctModal(false);
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAcct(false);
    }
  };

  const recordExpense = async () => {
    const amt = parseFloat(expForm.amount);
    if (!expForm.account_id) { toast.error('Select an account'); return; }
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSavingExp(true);
    try {
      const res = await fetch(`/api/accounts/${expForm.account_id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, direction: expForm.direction, description: expForm.description, transaction_date: expForm.date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Transaction recorded');
      setExpenseModal(false);
      setExpForm({ account_id: '', amount: '', direction: 'out', description: '', date: new Date().toISOString().split('T')[0] });
      loadAccounts();
      if (selExpAcct?.id === expForm.account_id) loadExpTxns(expForm.account_id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingExp(false);
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

  const updateAdvanceStatus = async (id: string, status: 'deducted' | 'cancelled') => {
    try {
      const res = await fetch(`/api/staff-advances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(status === 'deducted' ? 'Marked as deducted from salary' : 'Advance cancelled');
      loadAdvances();
    } catch {
      toast.error('Failed to update advance');
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader />
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track money in, expenses and staff advances</p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card border-t-4 border-green-400 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalRevenue)}</p>
          </div>
          <div className="card border-t-4 border-red-400 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalExpenses)}</p>
          </div>
          <div className="card border-t-4 border-orange-400 text-center">
            <p className="text-xs text-gray-500 mb-1">Advances Outstanding</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totalPendingAdv)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['revenue', 'expenses', 'advances'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'advances' ? 'Staff Advances' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── REVENUE TAB ───────────────────────────────────────── */}
        {tab === 'revenue' && (
          <div className="space-y-6">
            {acctLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {revenueAccounts.map(acct => (
                  <div key={acct.id} className="card border-t-4 border-brand-primary">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{ACCOUNT_ICONS[acct.type]}</span>
                      <p className="font-semibold text-gray-800 text-sm">{acct.name}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmt(Number(acct.balance))}</p>
                    <p className="text-xs text-gray-400 mt-1">Running balance</p>
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
                  {revTxns.slice(0, 40).map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${t.direction === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.direction === 'in' ? '+' : '−'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.description || 'Transaction'}</p>
                          <p className="text-xs text-gray-400">{t.account_name} · {t.transaction_date}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${t.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.direction === 'in' ? '+' : '−'}{fmt(Number(t.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXPENSES TAB ─────────────────────────────────────── */}
        {tab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{expenseAccounts.length} expense account{expenseAccounts.length !== 1 ? 's' : ''}</p>
              {canWrite && (
                <div className="flex gap-2">
                  <button onClick={() => setExpenseModal(true)} className="btn-primary text-sm">Record Expense</button>
                  <button onClick={() => setAddAcctModal(true)} className="btn-secondary text-sm">+ New Account</button>
                </div>
              )}
            </div>

            {acctLoading ? (
              <div className="card text-center text-gray-400 py-10">Loading…</div>
            ) : expenseAccounts.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-3xl mb-3">📋</p>
                <p className="font-medium text-gray-600">No expense accounts yet</p>
                <p className="text-sm text-gray-400 mt-1">Create accounts like Rent, Salaries, Supplies to track expenses</p>
                {canWrite && (
                  <button onClick={() => setAddAcctModal(true)} className="btn-primary text-sm mt-4">Create First Account</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {expenseAccounts.map(acct => (
                  <button
                    key={acct.id}
                    onClick={() => {
                      setSelExpAcct(acct);
                      loadExpTxns(acct.id);
                    }}
                    className={`card text-left border-2 transition-colors hover:border-brand-primary ${selExpAcct?.id === acct.id ? 'border-brand-primary' : 'border-transparent'}`}
                  >
                    <p className="font-semibold text-gray-800 text-sm mb-2">{acct.name}</p>
                    <p className="text-xl font-bold text-red-600">{fmt(Math.abs(Number(acct.balance)))}</p>
                    <p className="text-xs text-gray-400 mt-1">Total spent</p>
                  </button>
                ))}
              </div>
            )}

            {/* Transactions for selected expense account */}
            {selExpAcct && (
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{selExpAcct.name} — Transactions</h2>
                  {canWrite && (
                    <button
                      onClick={() => { setExpForm(p => ({ ...p, account_id: selExpAcct.id })); setExpenseModal(true); }}
                      className="text-sm text-brand-primary font-medium hover:underline"
                    >
                      + Record
                    </button>
                  )}
                </div>
                {expTxnLoading ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
                ) : expTxns.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No transactions yet for this account.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {expTxns.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{t.description || 'Expense'}</p>
                          <p className="text-xs text-gray-400">{t.transaction_date}</p>
                        </div>
                        <p className={`text-sm font-semibold ${t.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.direction === 'in' ? '+' : '−'}{fmt(Number(t.amount))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                            onClick={() => updateAdvanceStatus(adv.id, 'deducted')}
                            className="text-xs px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100"
                          >
                            Deducted
                          </button>
                          <button
                            onClick={() => updateAdvanceStatus(adv.id, 'cancelled')}
                            className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100"
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

      {/* ── Modal: Add Expense Account ── */}
      {addAcctModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setAddAcctModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">New Expense Account</h3>
            <input
              value={newAcctName}
              onChange={e => setNewAcctName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createAccount()}
              placeholder="e.g. Rent, Salaries, Supplies…"
              className="input w-full"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setAddAcctModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={createAccount} disabled={savingAcct || !newAcctName.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingAcct ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Record Expense ── */}
      {expenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setExpenseModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Record Transaction</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
              <select value={expForm.account_id} onChange={e => setExpForm(p => ({ ...p, account_id: e.target.value }))} className="input w-full">
                <option value="">Select account…</option>
                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                <select value={expForm.direction} onChange={e => setExpForm(p => ({ ...p, direction: e.target.value as 'in'|'out' }))} className="input w-full">
                  <option value="out">Expense (out)</option>
                  <option value="in">Refund (in)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input type="number" min="0" value={expForm.amount} onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))} className="input w-full" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} className="input w-full" placeholder="e.g. June rent payment" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={expForm.date} onChange={e => setExpForm(p => ({ ...p, date: e.target.value }))} className="input w-full" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExpenseModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={recordExpense} disabled={savingExp} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingExp ? 'Saving…' : 'Save'}
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
              <input type="number" min="0" value={advForm.amount} onChange={e => setAdvForm(p => ({ ...p, amount: e.target.value }))} className="input w-full" placeholder="0" />
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
    </div>
  );
}
