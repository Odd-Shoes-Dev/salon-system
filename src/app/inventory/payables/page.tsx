'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { StatCard, NumberInput, SearchableSelect } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { formatCurrency } from '@/lib/utils';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

interface Payable {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  equipment_id: string | null;
  equipment_name: string | null;
  description: string;
  amount: number;
  amount_paid: number;
  due_date: string | null;
  status: 'outstanding' | 'partial' | 'paid';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Supplier      { id: string; name: string; is_active: boolean }
interface EquipmentItem { id: string; name: string }
interface Summary       { totalOutstanding: number; overdueCount: number }

type FilterStatus = 'outstanding' | 'paid' | 'all';

const BLANK = { supplier_id: '', equipment_id: '', description: '', amount: '', due_date: '', notes: '' };

export default function PayablesPage() {
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit  = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin = ['owner', 'admin'].includes(user?.role || '');
  const { run } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const [payables, setPayables]     = useState<Payable[]>([]);
  const [summary, setSummary]       = useState<Summary>({ totalOutstanding: 0, overdueCount: 0 });
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [equipment, setEquipment]   = useState<EquipmentItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterStatus>('outstanding');

  // Add / edit modal
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Payable | null>(null);
  const [form, setForm]             = useState(BLANK);
  const [saving, setSaving]         = useState(false);

  // Record payment modal
  const [payTarget, setPayTarget]   = useState<Payable | null>(null);
  const [payAmount, setPayAmount]   = useState('');
  const [paying, setPaying]         = useState(false);

  // Row menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState<{ top: number; right: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 'outstanding' filter fetches both outstanding + partial from API
      const apiStatus = filter === 'outstanding' ? 'partial' : filter;
      const res = await fetch(`/api/inventory/payables?status=${apiStatus}`);
      if (res.ok) {
        const data = await res.json();
        setPayables(data.items);
        setSummary(data.summary);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory/suppliers').then(r => r.ok ? r.json() : []),
      fetch('/api/inventory/equipment').then(r => r.ok ? r.json() : { items: [] }),
    ]).then(([sups, eqData]) => {
      setSuppliers(sups);
      setEquipment(eqData.items ?? []);
    });
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (p: Payable) => {
    setEditing(p);
    setForm({
      supplier_id:  p.supplier_id  || '',
      equipment_id: p.equipment_id || '',
      description:  p.description,
      amount:       String(p.amount),
      due_date:     p.due_date ? p.due_date.slice(0, 10) : '',
      notes:        p.notes || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount is required');
    setSaving(true);
    try {
      const url    = editing ? `/api/inventory/payables/${editing.id}` : '/api/inventory/payables';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id:  form.supplier_id  || null,
          equipment_id: form.equipment_id || null,
          description:  form.description.trim(),
          amount:       Number(form.amount),
          due_date:     form.due_date || null,
          notes:        form.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Payable updated' : 'Payable recorded');
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return toast.error('Enter a valid amount');
    const remaining = Number(payTarget!.amount) - Number(payTarget!.amount_paid);
    if (Number(payAmount) > remaining) return toast.error(`Amount exceeds remaining balance (${formatCurrency(remaining)})`);
    setPaying(true);
    try {
      const res = await fetch(`/api/inventory/payables/${payTarget!.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_payment', payment: Number(payAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.status === 'paid' ? 'Fully paid — marked as paid' : 'Payment recorded');
      setPayTarget(null); setPayAmount(''); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setPaying(false); }
  };

  const remove = (p: Payable) => {
    run(`del:${p.id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/inventory/payables/${p.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Record deleted'); load();
    }));
  };

  const isOverdue = (p: Payable) =>
    p.status !== 'paid' && !!p.due_date && new Date(p.due_date) < new Date();

  const supplierOptions = [
    { value: '', label: 'No supplier / unknown' },
    ...suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name })),
  ];

  const equipmentOptions = [
    { value: '', label: 'Not linked to equipment' },
    ...equipment.map(e => ({ value: e.id, label: e.name })),
  ];

  const statusBadge = (p: Payable) => {
    if (p.status === 'paid')        return 'bg-green-50 text-green-700';
    if (p.status === 'partial')     return 'bg-blue-50 text-blue-700';
    return 'bg-amber-50 text-amber-700';
  };

  const statusLabel = (p: Payable) => {
    if (p.status === 'paid')    return 'Paid';
    if (p.status === 'partial') return 'Partial';
    return 'Outstanding';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Supplier Payables" />

      <div className="container mx-auto p-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/inventory" className="hover:text-gray-600 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Inventory
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 font-medium">Payables</span>
        </div>

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier Payables</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track amounts owed to suppliers for stock and equipment received on credit</p>
          </div>
          {canEdit && <button onClick={openAdd} className="btn-primary shrink-0">+ Record Payable</button>}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Total Outstanding"
            value={formatCurrency(summary.totalOutstanding)}
            accent={`border-l-4 ${summary.totalOutstanding > 0 ? 'border-amber-500' : 'border-green-500'}`}
            valueColor="text-gray-900 text-lg sm:text-xl"
          />
          <StatCard
            label="Overdue Payables"
            value={summary.overdueCount}
            accent={`border-l-4 ${summary.overdueCount > 0 ? 'border-red-500' : 'border-green-500'}`}
            valueColor={summary.overdueCount > 0 ? 'text-red-600 text-xl sm:text-2xl' : 'text-green-600 text-xl sm:text-2xl'}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { value: 'outstanding', label: 'Outstanding & Partial' },
            { value: 'paid',        label: 'Paid'                  },
            { value: 'all',         label: 'All'                   },
          ] as { value: FilterStatus; label: string }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={filter === f.value ? { backgroundColor: brandColor, color: '#fff' } : {}}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all border ${
                filter === f.value ? 'border-transparent shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : payables.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {filter === 'outstanding' ? (
                <>
                  <p className="text-lg font-medium mb-1 text-green-600">All clear</p>
                  <p className="text-sm">No outstanding payables.</p>
                </>
              ) : (
                <p>No {filter === 'paid' ? 'paid' : ''} payables found.</p>
              )}
              {filter === 'outstanding' && canEdit && (
                <button onClick={openAdd} className="mt-4 btn-primary text-sm">Record a Payable</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Remaining</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {canEdit && <th className="py-3 px-4" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payables.map(p => {
                    const overdue    = isOverdue(p);
                    const remaining  = Number(p.amount) - Number(p.amount_paid);
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-700">{p.supplier_name || <span className="text-gray-400 font-normal">Unknown</span>}</p>
                          {p.equipment_name && (
                            <p className="text-xs text-indigo-600 mt-0.5">⚙ {p.equipment_name}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-900">{p.description}</p>
                          {p.notes && <p className="text-xs text-gray-400 truncate max-w-[180px]">{p.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(p.amount)}</td>
                        <td className="py-3 px-4 text-right text-green-700 font-medium">
                          {Number(p.amount_paid) > 0 ? formatCurrency(p.amount_paid) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-green-600'}`}>
                            {remaining > 0 ? formatCurrency(remaining) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {p.due_date ? (
                            <div>
                              <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                                {new Date(p.due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {overdue && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 uppercase">Overdue</span>
                              )}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(p)}`}>
                            {statusLabel(p)}
                          </span>
                          {p.status === 'paid' && p.paid_at && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(p.paid_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </td>
                        {canEdit && (
                          <td className="py-3 px-4">
                            <div className="flex justify-end">
                              <button
                                onClick={ev => {
                                  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                                  setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                                  setOpenMenuId(openMenuId === p.id ? null : p.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {filter === 'outstanding' && payables.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 text-sm font-semibold text-gray-700">Total Remaining</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-500">
                        {formatCurrency(payables.reduce((s, p) => s + Number(p.amount), 0))}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-green-700 font-medium">
                        {formatCurrency(payables.reduce((s, p) => s + Number(p.amount_paid), 0))}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-bold text-amber-700">
                        {formatCurrency(payables.reduce((s, p) => s + (Number(p.amount) - Number(p.amount_paid)), 0))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Payable' : 'Record Payable'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-gray-400 font-normal">(optional)</span></label>
                <SearchableSelect options={supplierOptions} value={form.supplier_id} onChange={v => setForm(f => ({ ...f, supplier_id: v }))} placeholder="Search supplier…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Equipment <span className="text-gray-400 font-normal">(optional)</span></label>
                <SearchableSelect options={equipmentOptions} value={form.equipment_id} onChange={v => setForm(f => ({ ...f, equipment_id: v }))} placeholder="Link to equipment purchase…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input w-full" placeholder="e.g. OPI nail products batch — invoice #1042" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (UGX) <span className="text-red-500">*</span></label>
                  <NumberInput min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input w-full resize-none" rows={2} placeholder="Invoice number, payment terms, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {payTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Record Payment</h2>
                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[260px]">{payTarget.description}</p>
              </div>
              <button onClick={() => { setPayTarget(null); setPayAmount(''); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Total</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(payTarget.amount)}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Paid</p>
                  <p className="text-sm font-semibold text-green-700">{formatCurrency(payTarget.amount_paid)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Remaining</p>
                  <p className="text-sm font-semibold text-amber-700">{formatCurrency(Number(payTarget.amount) - Number(payTarget.amount_paid))}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay Now (UGX)</label>
                <NumberInput
                  min={1}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="input w-full"
                  placeholder="0"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Max: {formatCurrency(Number(payTarget.amount) - Number(payTarget.amount_paid))}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => { setPayTarget(null); setPayAmount(''); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={recordPayment} disabled={paying} className="btn-primary flex-1">{paying ? 'Saving…' : 'Confirm Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row action menu ── */}
      {openMenuId && menuPos && (() => {
        const p = payables.find(x => x.id === openMenuId);
        if (!p) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div className="fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, right: menuPos.right }}>
              {p.status !== 'paid' && (
                <button onClick={() => { setPayTarget(p); setPayAmount(''); setOpenMenuId(null); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Record Payment
                </button>
              )}
              {p.status !== 'paid' && canEdit && (
                <button onClick={() => { openEdit(p); setOpenMenuId(null); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { remove(p); setOpenMenuId(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        );
      })()}

      {SecurityModal}
    </div>
  );
}
