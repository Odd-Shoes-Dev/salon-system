'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { StatCard, useHiddenCards, SearchableSelect, NumberInput } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { formatCurrency } from '@/lib/utils';

const UNITS   = ['pcs', 'ml', 'litres', 'kg', 'g', 'box', 'bottle', 'sachet', 'roll', 'pair'];
const REASONS = [
  { value: 'purchase',   label: 'Purchase / Restock' },
  { value: 'use',        label: 'Used in Service' },
  { value: 'damage',     label: 'Damaged / Expired' },
  { value: 'return',     label: 'Returned to Supplier' },
  { value: 'adjustment', label: 'Stock Adjustment' },
];

type TabKey = 'restocks' | 'allocations' | 'movements';

interface ItemData {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_qty: number;
  reorder_level: number;
  cost_per_unit: number;
  description: string | null;
  group:    { id: string | null; name: string | null; color: string | null; parent_id: string | null } | null;
  supplier: { id: string | null; name: string | null } | null;
}

interface Movement {
  id: string;
  qty_change: number;
  qty_after: number;
  reason: string;
  notes: string | null;
  created_at: string;
  staff_name: string | null;
  worker_name: string | null;
}

interface Allocation {
  id: string;
  qty_allocated: number;
  qty_returned: number;
  status: string;
  closed_reason: string | null;
  notes: string | null;
  allocated_at: string;
  returned_at: string | null;
  worker_name: string | null;
  job_title: string | null;
  allocated_by_name: string | null;
}

interface ItemProfile {
  item: ItemData;
  summary: {
    totalSpent: number;
    currentValue: number;
    timesRestocked: number;
    lastRestockedAt: string | null;
  };
  movements: Movement[];
  allocations: Allocation[];
}

const REASON_LABEL: Record<string, string> = {
  purchase: 'Purchase', use: 'Used in Service', damage: 'Damaged',
  return: 'Returned', adjustment: 'Adjustment',
  staff_loan: 'Staff Loan', staff_return: 'Staff Return',
};

const REASON_COLOR: Record<string, string> = {
  purchase:     'bg-green-50 text-green-700',
  use:          'bg-blue-50 text-blue-700',
  damage:       'bg-red-50 text-red-700',
  staff_loan:   'bg-purple-50 text-purple-700',
  staff_return: 'bg-teal-50 text-teal-700',
  return:       'bg-orange-50 text-orange-700',
  adjustment:   'bg-gray-100 text-gray-600',
};

export default function ItemProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const { isHidden, toggle: toggleCard } = useHiddenCards(`inv_item_${id}`, ['spent', 'value'] as const);
  const canEdit  = ['owner', 'admin', 'manager'].includes(user?.role || '');

  // Profile data
  const [profile, setProfile]   = useState<ItemProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab]           = useState<TabKey>('restocks');

  // Supporting data for modals
  const [workers,   setWorkers]   = useState<{ id: string; name: string; job_title: string }[]>([]);
  const [groups,    setGroups]    = useState<{ id: string; name: string; color: string; parent_id: string | null; is_active: boolean }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; is_active: boolean }[]>([]);

  // Edit modal
  const [showEdit,   setShowEdit]   = useState(false);
  const [editForm,   setEditForm]   = useState({ name: '', description: '', unit: 'pcs', group_id: '', supplier_id: '', sku: '', reorder_level: '', cost_per_unit: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Adjust stock modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjQty,     setAdjQty]     = useState('');
  const [adjDir,     setAdjDir]     = useState<'add' | 'remove'>('add');
  const [adjReason,  setAdjReason]  = useState('purchase');
  const [adjNotes,   setAdjNotes]   = useState('');
  const [adjusting,  setAdjusting]  = useState(false);

  // Allocate staff modal
  const [showAlloc,   setShowAlloc]   = useState(false);
  const [allocWorker, setAllocWorker] = useState('');
  const [allocQty,    setAllocQty]    = useState('');
  const [allocNotes,  setAllocNotes]  = useState('');
  const [savingAlloc, setSavingAlloc] = useState(false);

  const reload = useCallback(() => {
    fetch(`/api/inventory/items/${id}`)
      .then(async r => { if (r.ok) setProfile(await r.json()); })
      .catch(() => {});
  }, [id]);

  const loadExtras = useCallback(async () => {
    const [wRes, gRes, sRes] = await Promise.all([
      fetch('/api/workers'),
      fetch('/api/inventory/groups'),
      fetch('/api/inventory/suppliers'),
    ]);
    if (wRes.ok) setWorkers(await wRes.json());
    if (gRes.ok) setGroups(await gRes.json());
    if (sRes.ok) setSuppliers(await sRes.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/inventory/items/${id}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return; }
        setProfile(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    loadExtras();
  }, [id, loadExtras]);

  const openEdit = () => {
    if (!profile) return;
    const i = profile.item;
    setEditForm({
      name: i.name, description: i.description || '', unit: i.unit,
      group_id: i.group?.id || '', supplier_id: i.supplier?.id || '',
      sku: i.sku || '', reorder_level: String(i.reorder_level), cost_per_unit: String(i.cost_per_unit),
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return toast.error('Name is required');
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, group_id: editForm.group_id || null, supplier_id: editForm.supplier_id || null, sku: editForm.sku || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Item updated');
      setShowEdit(false);
      reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingEdit(false); }
  };

  const submitAdjust = async () => {
    if (!adjQty || Number(adjQty) <= 0) return toast.error('Enter a valid quantity');
    setAdjusting(true);
    try {
      const qty_change = adjDir === 'add' ? Number(adjQty) : -Number(adjQty);
      const res = await fetch('/api/inventory/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: id, qty_change, reason: adjReason, notes: adjNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Stock ${adjDir === 'add' ? 'added' : 'reduced'} — new qty: ${data.new_qty} ${profile?.item.unit}`);
      setShowAdjust(false); setAdjQty(''); setAdjNotes('');
      reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setAdjusting(false); }
  };

  const saveAlloc = async () => {
    if (!allocWorker) return toast.error('Select a staff member');
    if (!allocQty || Number(allocQty) <= 0) return toast.error('Enter a valid quantity');
    setSavingAlloc(true);
    try {
      const res = await fetch('/api/inventory/allocations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: allocWorker, item_id: id, qty_allocated: Number(allocQty), notes: allocNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Stock allocated to staff');
      setShowAlloc(false); setAllocWorker(''); setAllocQty(''); setAllocNotes('');
      reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAlloc(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SalonHeader title="Loading…" />
        <div className="container mx-auto p-6 space-y-4">
          <div className="card animate-pulse h-32" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(n => <div key={n} className="card animate-pulse h-24" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SalonHeader title="Not Found" />
        <div className="container mx-auto p-6 text-center py-20">
          <p className="text-gray-400 text-lg mb-4">Item not found or you don't have access to it.</p>
          <Link href="/inventory" className="btn-primary">← Back to Inventory</Link>
        </div>
      </div>
    );
  }

  const { item, summary, movements, allocations } = profile;
  const restocks = movements.filter(m => m.reason === 'purchase' && m.qty_change > 0);
  const lowStock = Number(item.reorder_level) > 0 && Number(item.current_qty) <= Number(item.reorder_level);
  const groupColor = item.group?.color || brandColor;
  const hasGroup   = !!item.group?.id;

  const rootGroups    = groups.filter(g => !g.parent_id);
  const childGroups   = (pid: string) => groups.filter(g => g.parent_id === pid);
  const workerOptions = workers.map(w => ({ value: w.id, label: `${w.name} — ${w.job_title}` }));
  const supplierOpts  = [{ value: '', label: 'No supplier' }, ...suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name }))];

  const statusColor = (s: string) =>
    s === 'active'         ? 'bg-blue-50 text-blue-700'  :
    s === 'partial_return' ? 'bg-amber-50 text-amber-700' :
    'bg-gray-100 text-gray-500';

  const closedReasonColor = (r: string) =>
    r === 'consumed' ? 'bg-green-50 text-green-700' :
    r === 'damage'   ? 'bg-red-50 text-red-700'     :
    'bg-gray-100 text-gray-500';

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title={item.name} />

      <div className="container mx-auto p-6 space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/inventory" className="hover:text-brand-primary transition-colors">Inventory</Link>
          <span>›</span>
          <span className="text-gray-400">Stock Items</span>
          <span>›</span>
          <span className="text-gray-900 font-medium truncate">{item.name}</span>
        </nav>

        {/* Item Header */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl shrink-0"
              style={{ backgroundColor: groupColor }}
            >
              {item.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{item.name}</h1>
                {lowStock && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 uppercase tracking-wide">
                    Low Stock
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm mt-1">
                {item.sku && <span className="font-mono text-gray-400">SKU: {item.sku}</span>}
                <span className="text-gray-500">Unit: <strong className="text-gray-700">{item.unit}</strong></span>
                {hasGroup && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: item.group!.color! }}>
                    {item.group!.name}
                  </span>
                )}
                {item.supplier?.id && (
                  <span className="text-gray-500">Supplier: <strong className="text-gray-700">{item.supplier.name}</strong></span>
                )}
              </div>
              {item.description && <p className="text-sm text-gray-400 mt-2">{item.description}</p>}
            </div>

            <div className="text-right shrink-0 pt-1">
              <div className={`text-3xl font-bold ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                {item.current_qty}
                <span className="text-base font-normal text-gray-400 ml-1">{item.unit}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Current stock</div>
              {Number(item.reorder_level) > 0 && (
                <div className="text-xs text-gray-400 mt-1">Reorder at {item.reorder_level} {item.unit}</div>
              )}
              {Number(item.cost_per_unit) > 0 && (
                <div className="text-sm font-semibold text-gray-700 mt-1">
                  {formatCurrency(item.cost_per_unit)}
                  <span className="font-normal text-gray-400"> / {item.unit}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {canEdit && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              <button onClick={openEdit}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Item
              </button>
              <button onClick={() => { setAdjQty(''); setAdjDir('add'); setAdjReason('purchase'); setAdjNotes(''); setShowAdjust(true); }}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                Adjust Stock
              </button>
              <button onClick={() => { setAllocWorker(''); setAllocQty(''); setAllocNotes(''); setShowAlloc(true); }}
                className="btn-secondary text-sm flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Allocate to Staff
              </button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Spent"
            value={formatCurrency(summary.totalSpent)}
            accent="border-l-4 border-purple-500"
            valueColor="text-gray-900 text-lg sm:text-xl"
            hidden={isHidden('spent')}
            onToggle={() => toggleCard('spent')}
          />
          <StatCard
            label="Current Stock Value"
            value={formatCurrency(summary.currentValue)}
            accent="border-l-4 border-indigo-500"
            valueColor="text-gray-900 text-lg sm:text-xl"
            hidden={isHidden('value')}
            onToggle={() => toggleCard('value')}
          />
          <StatCard
            label="Times Restocked"
            value={summary.timesRestocked}
            accent="border-l-4 border-green-500"
          />
          <StatCard
            label="Last Restocked"
            value={summary.lastRestockedAt
              ? new Date(summary.lastRestockedAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Never'}
            accent="border-l-4 border-amber-500"
          />
        </div>

        {/* Tabs */}
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
          {([
            { key: 'restocks',    label: `Restock History (${restocks.length})` },
            { key: 'allocations', label: `Staff Allocations (${allocations.length})` },
            { key: 'movements',   label: `All Movements (${movements.length})` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={tab === t.key ? { backgroundColor: brandColor, color: '#fff' } : {}}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                tab === t.key ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Restock History ── */}
        {tab === 'restocks' && (
          <div className="card p-0 overflow-hidden">
            {restocks.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No restocks recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Qty Added</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Cost / Unit</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Stock After</th>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Notes</th>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {restocks.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">+{m.qty_change} {item.unit}</td>
                        <td className="py-3 px-4 text-right text-gray-500">{formatCurrency(item.cost_per_unit)}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {formatCurrency(Number(m.qty_change) * Number(item.cost_per_unit))}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">{m.qty_after} {item.unit}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                        <td className="py-3 px-4 text-gray-500">{m.staff_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-gray-700 text-sm" colSpan={3}>Total</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(summary.totalSpent)}</td>
                      <td colSpan={3} className="py-3 px-4 text-xs text-gray-400 italic">Based on current unit cost</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Staff Allocations ── */}
        {tab === 'allocations' && (
          <div className="card p-0 overflow-hidden">
            {allocations.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No staff allocations recorded for this item.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Allocated</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Returned</th>
                      <th className="py-3 px-4 text-right  text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-left   text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allocations.map(a => {
                      const outstanding = Number(a.qty_allocated) - Number(a.qty_returned);
                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900">{a.worker_name || '—'}</p>
                            {a.job_title && <p className="text-xs text-gray-400">{a.job_title}</p>}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">{a.qty_allocated} {item.unit}</td>
                          <td className="py-3 px-4 text-right text-gray-500">{a.qty_returned} {item.unit}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                              {outstanding} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusColor(a.status)}`}>
                                {a.status === 'active' ? 'Active' : a.status === 'partial_return' ? 'Partial Return' : 'Closed'}
                              </span>
                              {a.closed_reason && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${closedReasonColor(a.closed_reason)}`}>
                                  {a.closed_reason === 'consumed' ? 'Consumed' :
                                   a.closed_reason === 'damage'   ? 'Damaged / Lost' : 'Returned'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(a.allocated_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate">{a.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── All Movements ── */}
        {tab === 'movements' && (
          <div className="card p-0 overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No movements recorded for this item.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left  text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-left  text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Stock After</th>
                      <th className="py-3 px-4 text-left  text-xs font-medium text-gray-500 uppercase">Notes</th>
                      <th className="py-3 px-4 text-left  text-xs font-medium text-gray-500 uppercase">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(m.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REASON_COLOR[m.reason] || 'bg-gray-100 text-gray-600'}`}>
                            {REASON_LABEL[m.reason] || m.reason}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${
                          m.qty_change > 0 ? 'text-green-600' : m.qty_change < 0 ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {m.qty_change > 0 ? '+' : ''}{m.qty_change} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">{m.qty_after} {item.unit}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                        <td className="py-3 px-4 text-gray-500">
                          <div>{m.staff_name || '—'}</div>
                          {m.worker_name && <div className="text-xs text-purple-600">→ {m.worker_name}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Edit Item Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Edit Item</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input w-full" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={editForm.group_id} onChange={e => setEditForm(f => ({ ...f, group_id: e.target.value }))} className="input w-full">
                    <option value="">No group</option>
                    {rootGroups.filter(g => g.is_active).map(g => (
                      <optgroup key={g.id} label={g.name}>
                        <option value={g.id}>{g.name}</option>
                        {childGroups(g.id).filter(c => c.is_active).map(c => (
                          <option key={c.id} value={c.id}>↳ {c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} className="input w-full">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-gray-400 font-normal">(optional)</span></label>
                <SearchableSelect options={supplierOpts} value={editForm.supplier_id} onChange={v => setEditForm(f => ({ ...f, supplier_id: v }))} placeholder="Search supplier…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={editForm.sku} onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))} className="input w-full font-mono" placeholder="e.g. OPI-GEL-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <NumberInput min={0} value={editForm.reorder_level} onChange={e => setEditForm(f => ({ ...f, reorder_level: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost / Unit (UGX)</label>
                  <NumberInput min={0} value={editForm.cost_per_unit} onChange={e => setEditForm(f => ({ ...f, cost_per_unit: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input w-full" placeholder="Brief description" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowEdit(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1">{savingEdit ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust Stock Modal ── */}
      {showAdjust && profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Adjust Stock</h2>
                <p className="text-sm text-gray-500 mt-0.5">Current: <strong>{profile.item.current_qty} {profile.item.unit}</strong></p>
              </div>
              <button onClick={() => setShowAdjust(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAdjDir('add')} style={adjDir === 'add' ? { backgroundColor: '#16a34a', color: '#fff' } : {}}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${adjDir === 'add' ? '' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  + Add Stock
                </button>
                <button onClick={() => setAdjDir('remove')} style={adjDir === 'remove' ? { backgroundColor: '#dc2626', color: '#fff' } : {}}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${adjDir === 'remove' ? '' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  − Remove Stock
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({profile.item.unit})</label>
                <NumberInput min={1} value={adjQty} onChange={e => setAdjQty(e.target.value)} className="input w-full" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select value={adjReason} onChange={e => setAdjReason(e.target.value)} className="input w-full">
                  {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)} className="input w-full" placeholder="Any extra details…" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowAdjust(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitAdjust} disabled={adjusting} className="btn-primary flex-1">{adjusting ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocate to Staff Modal ── */}
      {showAlloc && profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Allocate to Staff</h2>
                <p className="text-sm text-gray-500 mt-0.5">{profile.item.name} — {profile.item.current_qty} {profile.item.unit} available</p>
              </div>
              <button onClick={() => setShowAlloc(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <SearchableSelect options={workerOptions} value={allocWorker} onChange={setAllocWorker} placeholder="Search staff…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({profile.item.unit})</label>
                <NumberInput min={1} value={allocQty} onChange={e => setAllocQty(e.target.value)} className="input w-full" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={allocNotes} onChange={e => setAllocNotes(e.target.value)} className="input w-full" placeholder="Purpose, expected return date, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowAlloc(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveAlloc} disabled={savingAlloc} className="btn-primary flex-1">{savingAlloc ? 'Saving…' : 'Allocate'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
