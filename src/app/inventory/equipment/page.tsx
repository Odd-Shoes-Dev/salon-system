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

interface Equipment {
  id: string;
  name: string;
  category: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  condition: 'good' | 'fair' | 'poor' | 'needs_repair' | 'retired';
  notes: string | null;
  is_active: boolean;
  supplier_id: string | null;
  supplier_name: string | null;
}

interface Repair {
  id: string;
  description: string;
  repair_date: string | null;
  cost: number | null;
  repaired_by: string | null;
  status: 'pending' | 'in_progress' | 'done';
  notes: string | null;
  created_at: string;
}

interface Supplier { id: string; name: string; is_active: boolean }
interface Summary  { total: number; totalValue: number; needsAttention: number }

const CONDITIONS = [
  { value: 'good',         label: 'Good',        color: 'bg-green-50 text-green-700'   },
  { value: 'fair',         label: 'Fair',         color: 'bg-yellow-50 text-yellow-700' },
  { value: 'poor',         label: 'Poor',         color: 'bg-orange-50 text-orange-700' },
  { value: 'needs_repair', label: 'Needs Repair', color: 'bg-red-50 text-red-700'       },
  { value: 'retired',      label: 'Retired',      color: 'bg-gray-100 text-gray-500'    },
] as const;

const REPAIR_STATUSES = [
  { value: 'pending',     label: 'Pending',     color: 'bg-amber-50 text-amber-700'  },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-50 text-blue-700'    },
  { value: 'done',        label: 'Done',        color: 'bg-green-50 text-green-700'  },
] as const;

const conditionMeta  = (c: string) => CONDITIONS.find(x => x.value === c)     ?? CONDITIONS[0];
const repairStatusMeta = (s: string) => REPAIR_STATUSES.find(x => x.value === s) ?? REPAIR_STATUSES[0];

type EquipmentForm = {
  name: string; category: string; serial_number: string;
  purchase_date: string; purchase_cost: string;
  condition: 'good' | 'fair' | 'poor' | 'needs_repair' | 'retired';
  notes: string; supplier_id: string;
};

const BLANK: EquipmentForm = {
  name: '', category: '', serial_number: '', purchase_date: '',
  purchase_cost: '', condition: 'good', notes: '', supplier_id: '',
};

type RepairForm = { description: string; repair_date: string; cost: string; repaired_by: string; status: 'pending' | 'in_progress' | 'done'; notes: string };
const BLANK_REPAIR: RepairForm = { description: '', repair_date: '', cost: '', repaired_by: '', status: 'pending', notes: '' };

export default function EquipmentPage() {
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit  = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin = ['owner', 'admin'].includes(user?.role || '');
  const { run } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const [items, setItems]           = useState<Equipment[]>([]);
  const [summary, setSummary]       = useState<Summary>({ total: 0, totalValue: 0, needsAttention: 0 });
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterCond, setFilterCond] = useState('');

  // Add / edit modal
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Equipment | null>(null);
  const [form, setForm]             = useState<EquipmentForm>(BLANK);
  const [saving, setSaving]         = useState(false);

  // Repairs modal
  const [repairsTarget, setRepairsTarget]     = useState<Equipment | null>(null);
  const [repairs, setRepairs]                 = useState<Repair[]>([]);
  const [loadingRepairs, setLoadingRepairs]   = useState(false);
  const [showRepairForm, setShowRepairForm]   = useState(false);
  const [repairForm, setRepairForm]           = useState(BLANK_REPAIR);
  const [savingRepair, setSavingRepair]       = useState(false);
  const [editingRepair, setEditingRepair]     = useState<Repair | null>(null);

  // Row menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState<{ top: number; right: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/equipment');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setSummary(data.summary);
      }
    } finally { setLoading(false); }
  }, []);

  const loadSuppliers = useCallback(async () => {
    const res = await fetch('/api/inventory/suppliers');
    if (res.ok) setSuppliers(await res.json());
  }, []);

  useEffect(() => { load(); loadSuppliers(); }, [load, loadSuppliers]);

  // ── Equipment CRUD ────────────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (e: Equipment) => {
    setEditing(e);
    setForm({
      name: e.name, category: e.category || '', serial_number: e.serial_number || '',
      purchase_date: e.purchase_date ? e.purchase_date.slice(0, 10) : '',
      purchase_cost: e.purchase_cost != null ? String(e.purchase_cost) : '',
      condition: e.condition, notes: e.notes || '', supplier_id: e.supplier_id || '',
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const url    = editing ? `/api/inventory/equipment/${editing.id}` : '/api/inventory/equipment';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          supplier_id:   form.supplier_id || null,
          purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
          purchase_date: form.purchase_date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Equipment updated' : 'Equipment added');
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = (e: Equipment) => {
    run(`del:${e.id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/inventory/equipment/${e.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Equipment removed'); load();
    }));
  };

  // ── Repairs ───────────────────────────────────────────────────────────────
  const openRepairs = async (e: Equipment) => {
    setRepairsTarget(e); setRepairs([]); setShowRepairForm(false); setEditingRepair(null);
    setLoadingRepairs(true);
    try {
      const res = await fetch(`/api/inventory/equipment/${e.id}/repairs`);
      if (res.ok) setRepairs(await res.json());
    } finally { setLoadingRepairs(false); }
  };

  const startEditRepair = (r: Repair) => {
    setEditingRepair(r);
    setRepairForm({
      description: r.description, repair_date: r.repair_date ? r.repair_date.slice(0, 10) : '',
      cost: r.cost != null ? String(r.cost) : '', repaired_by: r.repaired_by || '',
      status: r.status, notes: r.notes || '',
    });
    setShowRepairForm(true);
  };

  const saveRepair = async () => {
    if (!repairForm.description.trim()) return toast.error('Description is required');
    setSavingRepair(true);
    try {
      const url    = editingRepair
        ? `/api/inventory/equipment/${repairsTarget!.id}/repairs/${editingRepair.id}`
        : `/api/inventory/equipment/${repairsTarget!.id}/repairs`;
      const method = editingRepair ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...repairForm,
          cost: repairForm.cost ? Number(repairForm.cost) : null,
          repair_date: repairForm.repair_date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingRepair ? 'Repair updated' : 'Repair logged');
      setShowRepairForm(false); setEditingRepair(null); setRepairForm(BLANK_REPAIR);
      const r2 = await fetch(`/api/inventory/equipment/${repairsTarget!.id}/repairs`);
      if (r2.ok) setRepairs(await r2.json());
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingRepair(false); }
  };

  const deleteRepair = async (r: Repair) => {
    if (!confirm('Delete this repair record?')) return;
    const res = await fetch(`/api/inventory/equipment/${repairsTarget!.id}/repairs/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Repair record deleted');
    setRepairs(prev => prev.filter(x => x.id !== r.id));
  };

  const filtered = filterCond ? items.filter(e => e.condition === filterCond) : items;

  const supplierOptions = [
    { value: '', label: 'No supplier' },
    ...suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Equipment" />

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
          <span className="text-gray-700 font-medium">Equipment</span>
        </div>

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track salon assets, tools, and machinery</p>
          </div>
          {canEdit && <button onClick={openAdd} className="btn-primary shrink-0">+ Add Equipment</button>}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Equipment" value={summary.total} accent="border-l-4 border-indigo-500" />
          <StatCard label="Total Purchase Value" value={formatCurrency(summary.totalValue)} accent="border-l-4 border-purple-500" valueColor="text-gray-900 text-lg sm:text-xl" />
          <StatCard
            label="Needs Attention"
            value={summary.needsAttention}
            accent={`border-l-4 ${summary.needsAttention > 0 ? 'border-red-500' : 'border-green-500'}`}
            valueColor={summary.needsAttention > 0 ? 'text-red-600 text-xl sm:text-2xl' : 'text-green-600 text-xl sm:text-2xl'}
          />
        </div>

        {/* Condition filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {[{ value: '', label: 'All' }, ...CONDITIONS].map(c => (
            <button
              key={c.value}
              onClick={() => setFilterCond(c.value)}
              style={filterCond === c.value ? { backgroundColor: brandColor, color: '#fff' } : {}}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                filterCond === c.value ? 'border-transparent shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {items.length === 0 ? (
                <>
                  <p className="text-lg font-medium mb-1">No equipment yet</p>
                  <p className="text-sm mb-4">Start tracking the salon's tools, chairs, dryers, and other assets.</p>
                  {canEdit && <button onClick={openAdd} className="btn-primary text-sm">Add First Equipment</button>}
                </>
              ) : <p>No equipment with condition "{conditionMeta(filterCond).label}"</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Serial No.</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Purchased</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    {canEdit && <th className="py-3 px-4" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(e => {
                    const meta = conditionMeta(e.condition);
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{e.name}</p>
                          {e.notes && <p className="text-xs text-gray-400 truncate max-w-[200px]">{e.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{e.supplier_name || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-gray-600">{e.category || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-xs">{e.serial_number || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-500">
                          {e.purchase_date
                            ? new Date(e.purchase_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700 font-medium">
                          {e.purchase_cost != null ? formatCurrency(e.purchase_cost) : <span className="text-gray-300">—</span>}
                        </td>
                        {canEdit && (
                          <td className="py-3 px-4">
                            <div className="flex justify-end">
                              <button
                                onClick={ev => {
                                  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                                  setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                                  setOpenMenuId(openMenuId === e.id ? null : e.id);
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
              <h2 className="text-lg font-semibold">{editing ? 'Edit Equipment' : 'Add Equipment'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. Wahl Clippers Pro" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input w-full" placeholder="e.g. Hair Tools" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value as EquipmentForm['condition'] }))} className="input w-full">
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-gray-400 font-normal">(optional)</span></label>
                <SearchableSelect options={supplierOptions} value={form.supplier_id} onChange={v => setForm(f => ({ ...f, supplier_id: v }))} placeholder="Search supplier…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} className="input w-full font-mono" placeholder="SN-XXXXXXXX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Cost (UGX)</label>
                  <NumberInput min={0} value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input w-full resize-none" rows={2} placeholder="Location, maintenance notes, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Repairs Modal ── */}
      {repairsTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Repair Log</h2>
                <p className="text-sm text-gray-500 mt-0.5">{repairsTarget.name}</p>
              </div>
              <button onClick={() => { setRepairsTarget(null); setShowRepairForm(false); setEditingRepair(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {loadingRepairs ? (
                <p className="text-center text-gray-400 py-4">Loading…</p>
              ) : repairs.length === 0 && !showRepairForm ? (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">No repairs logged yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {repairs.map(r => {
                    const sm = repairStatusMeta(r.status);
                    return (
                      <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 text-sm">{r.description}</p>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sm.color}`}>{sm.label}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                              {r.repair_date && <span>{new Date(r.repair_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                              {r.repaired_by && <span>By: {r.repaired_by}</span>}
                              {r.cost != null && <span className="font-medium text-gray-600">{formatCurrency(r.cost)}</span>}
                            </div>
                            {r.notes && <p className="text-xs text-gray-400 mt-1">{r.notes}</p>}
                          </div>
                          {canEdit && (
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => startEditRepair(r)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                              {canAdmin && <button onClick={() => deleteRepair(r)} className="text-xs text-red-500 hover:text-red-700">Delete</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add / Edit repair form */}
              {showRepairForm && (
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50/30">
                  <p className="text-sm font-medium text-gray-700">{editingRepair ? 'Edit Repair' : 'Log New Repair'}</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                    <input value={repairForm.description} onChange={e => setRepairForm(f => ({ ...f, description: e.target.value }))} className="input w-full text-sm" placeholder="What needs to be repaired?" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select value={repairForm.status} onChange={e => setRepairForm(f => ({ ...f, status: e.target.value as typeof repairForm.status }))} className="input w-full text-sm">
                        {REPAIR_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Repair Date</label>
                      <input type="date" value={repairForm.repair_date} onChange={e => setRepairForm(f => ({ ...f, repair_date: e.target.value }))} className="input w-full text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cost (UGX)</label>
                      <NumberInput min={0} value={repairForm.cost} onChange={e => setRepairForm(f => ({ ...f, cost: e.target.value }))} className="input w-full text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Repaired By</label>
                      <input value={repairForm.repaired_by} onChange={e => setRepairForm(f => ({ ...f, repaired_by: e.target.value }))} className="input w-full text-sm" placeholder="Name or workshop" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <input value={repairForm.notes} onChange={e => setRepairForm(f => ({ ...f, notes: e.target.value }))} className="input w-full text-sm" placeholder="Extra details…" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShowRepairForm(false); setEditingRepair(null); setRepairForm(BLANK_REPAIR); }} className="btn-secondary text-sm flex-1">Cancel</button>
                    <button onClick={saveRepair} disabled={savingRepair} className="btn-primary text-sm flex-1">{savingRepair ? 'Saving…' : 'Save Repair'}</button>
                  </div>
                </div>
              )}
            </div>

            {canEdit && !showRepairForm && (
              <div className="p-4 border-t border-gray-100 shrink-0">
                <button onClick={() => { setEditingRepair(null); setRepairForm(BLANK_REPAIR); setShowRepairForm(true); }} className="btn-primary w-full text-sm">
                  + Log Repair
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row action menu ── */}
      {openMenuId && menuPos && (() => {
        const item = filtered.find(x => x.id === openMenuId);
        if (!item) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div className="fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, right: menuPos.right }}>
              <button onClick={() => { openRepairs(item); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
                Repairs
              </button>
              <button onClick={() => { openEdit(item); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              {canAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { remove(item); setOpenMenuId(null); }}
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
