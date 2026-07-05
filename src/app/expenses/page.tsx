'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PeriodSelector, DateRangePicker, StatCard, useHiddenCards } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { formatCurrency } from '@/lib/utils';
import { useModalEsc } from '@/contexts/EscContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

const PERIODS = [
  { value: 'today',      label: 'Today' },
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

const PAYMENT_METHODS = [
  { value: 'cash',             label: 'Cash',             icon: '💵' },
  { value: 'mtn_mobile_money', label: 'MTN Mobile Money', icon: '📱' },
  { value: 'airtel_money',     label: 'Airtel Money',     icon: '📲' },
  { value: 'other',            label: 'Other',            icon: '💳' },
];

const pmLabel = (v: string) => PAYMENT_METHODS.find(p => p.value === v)?.label ?? v;
const pmIcon  = (v: string) => PAYMENT_METHODS.find(p => p.value === v)?.icon  ?? '💳';

interface Category { id: string; name: string; sort_order: number; }

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  payment_method: string;
  created_at: string;
  created_by_staff?: { name: string } | null;
  branch_name?: string | null;
}

interface Summary {
  total:           number;
  count:           number;
  revenue:         number;
  netProfit:       number;
  byCategory:      { category: string; amount: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}

const BLANK = { category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash' };

export default function ExpensesPage() {
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit    = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canDelete  = ['owner', 'admin'].includes(user?.role || '');
  const canManage  = ['owner', 'admin'].includes(user?.role || '');
  const { isHidden, allHidden, toggle: toggleCard, toggleAll } = useHiddenCards(
    'expenses_hidden_cards', ['revenue', 'totalExp', 'netProfit'] as const
  );

  // ── Categories ──────────────────────────────────────────
  const [categories, setCategories]         = useState<Category[]>([]);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [showManage, setShowManage]         = useState(false);
  const [newCatName, setNewCatName]         = useState('');
  const [addingCat, setAddingCat]           = useState(false);
  const [editingCatId, setEditingCatId]     = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/expense-categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Category added');
      setNewCatName('');
      loadCategories();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add category');
    } finally {
      setAddingCat(false);
    }
  };

  const renameCategory = (id: string) => {
    if (!editingCatName.trim()) return;
    run(`rename:${id}`, async () => {
      const res = await fetch(`/api/expense-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Category renamed');
      setEditingCatId(null);
      loadCategories();
    });
  };

  const deleteCategory = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Existing expenses using this category will not be affected.`)) return;
    run(`delcat:${id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Category deleted');
      loadCategories();
    }));
  };

  // ── Expenses ─────────────────────────────────────────────
  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [pmFilter, setPmFilter]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef                     = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Expense | null>(null);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [customCat, setCustomCat] = useState(false);

  useModalEsc(showModal || showManage, () => { setShowModal(false); setShowManage(false); });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (period === 'custom' && fromDate && toDate) { qs.set('from_date', fromDate); qs.set('to_date', toDate); }
      if (catFilter) qs.set('category', catFilter);
      if (pmFilter)  qs.set('payment_method', pmFilter);
      const res  = await fetch(`/api/expenses?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExpenses(data.expenses);
      setSummary(data.summary);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate, catFilter, pmFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setEditing(null); setForm(BLANK); setShowModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const openAdd = () => {
    setEditing(null); setForm(BLANK); setCustomCat(false); setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const isManaged = categories.some(c => c.name === e.category);
    setCustomCat(!isManaged);
    setForm({ category: e.category, amount: String(e.amount), description: e.description || '', expense_date: e.expense_date, payment_method: e.payment_method || 'cash' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.category.trim()) return toast.error('Category is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const url    = editing ? `/api/expenses/${editing.id}` : '/api/expenses';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, payment_method: form.payment_method || 'cash' }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Expense updated' : 'Expense added');
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    if (!confirm('Delete this expense?')) return;
    run(`delete:${id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Expense deleted');
      load();
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Expenses" />

      <div className="container mx-auto p-6 space-y-6">

        {/* ── Filters ── */}
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end">
            <PeriodSelector periods={PERIODS} value={period} onChange={setPeriod} label="Period" />
            {period === 'custom' && (
              <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input">
                <option value="">All categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Paid from</label>
              <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} className="input">
                <option value="">All accounts</option>
                {PAYMENT_METHODS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
              </select>
            </div>
            {canManage && (
              <button
                onClick={() => setShowManage(true)}
                className="btn-secondary text-sm flex items-center gap-1.5 self-end"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Manage Categories
              </button>
            )}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {summary && (
          <>
            <div className="flex items-center justify-end -mb-2">
              <button onClick={toggleAll} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title={allHidden ? 'Show all values' : 'Hide all values'}>
                {allHidden ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Revenue" value={formatCurrency(summary.revenue)} accent="border-l-4 border-green-500" valueColor="text-green-600 text-lg sm:text-xl" hidden={isHidden('revenue')} onToggle={() => toggleCard('revenue')} />
              <StatCard
                label="Total Expenses"
                accent="border-l-4 border-red-500"
                hidden={isHidden('totalExp')}
                onToggle={() => toggleCard('totalExp')}
                value={
                  <>
                    {formatCurrency(summary.total)}
                    <span className="block text-xs text-gray-400 font-normal mt-0.5">{summary.count} transaction{summary.count !== 1 ? 's' : ''}</span>
                  </>
                }
              />
              <StatCard
                label="Net Profit"
                accent={`border-l-4 ${summary.netProfit >= 0 ? 'border-blue-500' : 'border-orange-500'}`}
                className="col-span-2 lg:col-span-2"
                valueColor={summary.netProfit >= 0 ? 'text-blue-600 text-lg sm:text-xl' : 'text-orange-600 text-lg sm:text-xl'}
                hidden={isHidden('netProfit')}
                onToggle={() => toggleCard('netProfit')}
                value={
                  <>
                    {formatCurrency(summary.netProfit)}
                    <span className="block text-xs text-gray-400 font-normal mt-0.5">Revenue minus expenses</span>
                  </>
                }
              />
            </div>
          </>
        )}

        {/* ── Breakdowns ── */}
        {summary && (summary.byCategory.length > 0 || summary.byPaymentMethod.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary.byCategory.length > 0 && (
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
                <div className="space-y-2">
                  {[...summary.byCategory].sort((a, b) => b.amount - a.amount).map(b => (
                    <div key={b.category}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm text-gray-600 w-28 truncate">{b.category}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round((b.amount / summary.total) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-28 text-right">{formatCurrency(b.amount)}</span>
                        <Link
                          href={`/expenses/${encodeURIComponent(b.category)}`}
                          className="text-xs text-brand-primary hover:underline whitespace-nowrap w-24 text-right"
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.byPaymentMethod.length > 0 && (
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Paid From</h2>
                <div className="space-y-2">
                  {[...summary.byPaymentMethod].sort((a, b) => b.amount - a.amount).map(b => (
                    <div key={b.method} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 truncate">{pmIcon(b.method)} {pmLabel(b.method)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round((b.amount / summary.total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-28 text-right">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Expenses Table ── */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Expense Entries</h2>
            {canEdit && (
              <button onClick={openAdd} className="btn-primary text-sm">+ Add Expense</button>
            )}
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No expenses found for this period.
              {canEdit && <button onClick={openAdd} className="block mx-auto mt-3 btn-primary text-sm">Add First Expense</button>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Paid From</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Added by</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  {(canEdit || canDelete) && <th className="py-3 px-4" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium">{e.category}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs">{pmIcon(e.payment_method)} {pmLabel(e.payment_method)}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{e.description || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{e.created_by_staff?.name || '—'}</td>
                    <td className="py-3 px-4">
                      {e.branch_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {e.branch_name}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatCurrency(e.amount)}</td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={ev => {
                              ev.stopPropagation();
                              setOpenMenuId(openMenuId === e.id ? null : e.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                          {openMenuId === e.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
                              onClick={ev => ev.stopPropagation()}
                            >
                              {canEdit && (
                                <button
                                  onClick={() => { setOpenMenuId(null); openEdit(e); }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => { setOpenMenuId(null); remove(e.id); }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={6} className="py-3 px-4 text-sm font-semibold text-gray-700">Total</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(summary?.total || 0)}</td>
                  {(canEdit || canDelete) && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Manage Categories Modal ── */}
      {showManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Manage Categories</h2>
              <button onClick={() => setShowManage(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-2">
              {categories.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No categories yet</p>
              )}
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 group">
                  {editingCatId === cat.id ? (
                    <>
                      <input
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null); }}
                        className="input flex-1 py-1.5 text-sm"
                        autoFocus
                      />
                      <button onClick={() => renameCategory(cat.id)} className="text-xs text-green-600 hover:text-green-700 font-medium px-2">Save</button>
                      <button onClick={() => setEditingCatId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700 py-1.5 px-3 rounded-lg bg-gray-50">{cat.name}</span>
                      <button
                        onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id, cat.name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-100 shrink-0">
              <p className="text-xs font-medium text-gray-500 mb-2">Add new category</p>
              <div className="flex gap-2">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                  className="input flex-1 text-sm"
                  placeholder="e.g. Insurance, Training…"
                />
                <button
                  onClick={addCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="btn-primary text-sm px-4"
                >
                  {addingCat ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Expense Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                {!customCat ? (
                  <div className="flex gap-2">
                    <select
                      value={categories.some(c => c.name === form.category) ? form.category : ''}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="input flex-1"
                    >
                      <option value="">Select category…</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => { setCustomCat(true); setForm(f => ({ ...f, category: '' })); }}
                      className="btn-secondary text-sm whitespace-nowrap">Custom</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="input flex-1"
                      placeholder="e.g. Training, Insurance…"
                      autoFocus
                    />
                    <button type="button" onClick={() => { setCustomCat(false); setForm(f => ({ ...f, category: '' })); }}
                      className="btn-secondary text-sm">List</button>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input
                  type="number" min={1}
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  onWheel={e => e.currentTarget.blur()}
                  className="input w-full"
                  placeholder="e.g. 50000"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="input w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input w-full"
                  placeholder="e.g. Monthly rent for salon space"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid From</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: p.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        form.payment_method === p.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>{p.icon}</span> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
      {SecurityModal}
    </div>
  );
}
