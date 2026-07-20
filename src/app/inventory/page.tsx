'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { StatCard, useHiddenCards, NumberInput, SearchableSelect } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { formatCurrency } from '@/lib/utils';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

const UNITS = ['pcs', 'ml', 'litres', 'kg', 'g', 'box', 'bottle', 'sachet', 'roll', 'pair'];
const REASONS = [
  { value: 'purchase',    label: 'Purchase / Restock' },
  { value: 'use',         label: 'Used in Service' },
  { value: 'damage',      label: 'Damaged / Expired' },
  { value: 'return',      label: 'Returned to Supplier' },
  { value: 'adjustment',  label: 'Stock Adjustment' },
];

type TabKey = 'items' | 'groups' | 'allocations' | 'movements';

interface Supplier  { id: string; name: string; is_active: boolean }
interface Group     { id: string; name: string; color: string; description: string | null; is_active: boolean; sort_order: number; parent_id: string | null; parent: { id: string; name: string; color: string } | null; item_count: number }
interface Item      { id: string; name: string; unit: string; current_qty: number; reorder_level: number; cost_per_unit: number; sku: string | null; supplier: { id: string; name: string } | null; group: { id: string; name: string; color: string; parent_id: string | null } | null; description: string | null; branch_name?: string | null; supplier_id?: string | null }
interface Movement  { id: string; qty_change: number; qty_after: number; reason: string; notes: string | null; created_at: string; worker_name: string | null; item: { name: string; unit: string } | null; staff: { name: string } | null; branch_name?: string | null }
interface Worker    { id: string; name: string; job_title: string }
interface Allocation {
  id: string; status: string; closed_reason: string | null;
  qty_allocated: number; qty_returned: number;
  notes: string | null; allocated_at: string; returned_at: string | null;
  allocated_by_name: string | null;
  worker: { id: string; name: string; job_title: string } | null;
  item:   { id: string; name: string; unit: string } | null;
}

const BLANK_GROUP = { name: '', description: '', color: '#6366f1', sort_order: 0, parent_id: '' };
const BLANK_ITEM  = { name: '', description: '', unit: 'pcs', group_id: '', supplier_id: '', sku: '', current_qty: '', reorder_level: '', cost_per_unit: '' };

export default function InventoryPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit    = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin   = ['owner', 'admin'].includes(user?.role || '');
  const { isHidden, toggle: toggleCard } = useHiddenCards('inv_hidden_cards', ['invValue'] as const);

  const [tab, setTab]               = useState<TabKey>('items');
  const [groups, setGroups]         = useState<Group[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [workers, setWorkers]       = useState<Worker[]>([]);
  const [items, setItems]           = useState<Item[]>([]);
  const [movements, setMovements]   = useState<Movement[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [invSummary, setInvSummary] = useState({ totalValue: 0, lowStockCount: 0, totalItems: 0 });
  const [filterGroup, setFilterGroup]       = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [loading, setLoading]       = useState(true);
  const { run } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup]     = useState<Group | null>(null);
  const [groupForm, setGroupForm]           = useState(BLANK_GROUP);
  const [savingGroup, setSavingGroup]       = useState(false);

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem]     = useState<Item | null>(null);
  const [itemForm, setItemForm]           = useState(BLANK_ITEM);
  const [savingItem, setSavingItem]       = useState(false);

  // Adjust qty modal
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [adjQty, setAdjQty]         = useState('');
  const [adjDir, setAdjDir]         = useState<'add' | 'remove'>('add');
  const [adjReason, setAdjReason]   = useState('purchase');
  const [adjNotes, setAdjNotes]     = useState('');
  const [adjusting, setAdjusting]   = useState(false);

  // Row action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos]       = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  // Allocation modal
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [allocForm, setAllocForm]           = useState({ worker_id: '', item_id: '', qty: '', notes: '' });
  const [savingAlloc, setSavingAlloc]       = useState(false);
  const [returnAlloc, setReturnAlloc]       = useState<Allocation | null>(null);
  const [returnQty, setReturnQty]           = useState('');
  const [returnNotes, setReturnNotes]       = useState('');
  const [returningAlloc, setReturningAlloc] = useState(false);
  const [closeAlloc, setCloseAlloc]         = useState<{ alloc: Allocation; action: 'consumed' | 'damage' } | null>(null);
  const [closeNotes, setCloseNotes]         = useState('');
  const [closingAlloc, setClosingAlloc]     = useState(false);
  const [allocMenuId, setAllocMenuId]       = useState<string | null>(null);
  const [allocMenuPos, setAllocMenuPos]     = useState<{ top: number; right: number } | null>(null);
  const [allocFilter, setAllocFilter]       = useState<'active' | 'returned' | 'consumed' | 'damage' | 'all'>('active');

  const loadGroups    = useCallback(async () => { const r = await fetch('/api/inventory/groups');    if (r.ok) setGroups(await r.json()); }, []);
  const loadSuppliers = useCallback(async () => { const r = await fetch('/api/inventory/suppliers'); if (r.ok) setSuppliers(await r.json()); }, []);
  const loadWorkers   = useCallback(async () => { const r = await fetch('/api/workers');             if (r.ok) setWorkers(await r.json()); }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterGroup)    qs.set('group_id', filterGroup);
    if (filterSupplier) qs.set('supplier_id', filterSupplier);
    const r = await fetch(`/api/inventory/items?${qs}`);
    const d = await r.json();
    if (r.ok) { setItems(d.items); setInvSummary(d.summary); }
    setLoading(false);
  }, [filterGroup, filterSupplier]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/inventory/movements?limit=100');
    if (r.ok) setMovements(await r.json());
    setLoading(false);
  }, []);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/inventory/allocations?status=${allocFilter}`);
    if (r.ok) setAllocations(await r.json());
    setLoading(false);
  }, [allocFilter]);

  useEffect(() => { loadGroups(); loadSuppliers(); loadWorkers(); }, [loadGroups, loadSuppliers, loadWorkers]);
  useEffect(() => { if (tab === 'items')       loadItems(); },       [tab, loadItems]);
  useEffect(() => { if (tab === 'movements')   loadMovements(); },   [tab, loadMovements]);
  useEffect(() => { if (tab === 'allocations') loadAllocations(); }, [tab, loadAllocations]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('new') === 'true') {
      setEditingItem(null); setItemForm(BLANK_ITEM); setShowItemModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ── Group helpers ─────────────────────────────────────────────────────────
  const rootGroups = groups.filter(g => !g.parent_id);
  const childGroups = (parentId: string) => groups.filter(g => g.parent_id === parentId);

  const openAddGroup  = () => { setEditingGroup(null); setGroupForm(BLANK_GROUP); setShowGroupModal(true); };
  const openEditGroup = (g: Group) => {
    setEditingGroup(g);
    setGroupForm({ name: g.name, description: g.description || '', color: g.color, sort_order: g.sort_order, parent_id: g.parent_id || '' });
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return toast.error('Name is required');
    setSavingGroup(true);
    try {
      const url    = editingGroup ? `/api/inventory/groups/${editingGroup.id}` : '/api/inventory/groups';
      const method = editingGroup ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...groupForm, parent_id: groupForm.parent_id || null, is_active: true }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingGroup ? 'Group updated' : 'Group created');
      setShowGroupModal(false);
      loadGroups();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingGroup(false); }
  };

  const deleteGroup = (id: string) => {
    if (!confirm('Delete this group? This cannot be undone.')) return;
    run(`delgroup:${id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/inventory/groups/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Group deleted'); loadGroups();
    }));
  };

  // ── Item helpers ──────────────────────────────────────────────────────────
  const openAddItem  = () => { setEditingItem(null); setItemForm(BLANK_ITEM); setShowItemModal(true); };
  const openEditItem = (i: Item) => {
    setEditingItem(i);
    setItemForm({ name: i.name, description: i.description || '', unit: i.unit, group_id: i.group?.id || '', supplier_id: i.supplier?.id || '', sku: i.sku || '', current_qty: String(i.current_qty), reorder_level: String(i.reorder_level), cost_per_unit: String(i.cost_per_unit) });
    setShowItemModal(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) return toast.error('Name is required');
    setSavingItem(true);
    try {
      const url    = editingItem ? `/api/inventory/items/${editingItem.id}` : '/api/inventory/items';
      const method = editingItem ? 'PUT' : 'POST';
      const payload = { ...itemForm, group_id: itemForm.group_id || null, supplier_id: itemForm.supplier_id || null, sku: itemForm.sku || null };
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingItem ? 'Item updated' : 'Item added');
      setShowItemModal(false); loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingItem(false); }
  };

  const deleteItem = (id: string) => {
    if (!confirm('Remove this item from inventory?')) return;
    run(`delitem:${id}`, () => guardAction('sensitive', async () => {
      await fetch(`/api/inventory/items/${id}`, { method: 'DELETE' });
      toast.success('Item removed'); loadItems();
    }));
  };

  // ── Adjust stock ──────────────────────────────────────────────────────────
  const openAdjust = (i: Item) => { setAdjustItem(i); setAdjQty(''); setAdjDir('add'); setAdjReason('purchase'); setAdjNotes(''); };

  const submitAdjust = async () => {
    if (!adjQty || Number(adjQty) <= 0) return toast.error('Enter a valid quantity');
    setAdjusting(true);
    try {
      const qty_change = adjDir === 'add' ? Number(adjQty) : -Number(adjQty);
      const res = await fetch('/api/inventory/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: adjustItem!.id, qty_change, reason: adjReason, notes: adjNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Stock ${adjDir === 'add' ? 'added' : 'reduced'} — new qty: ${data.new_qty} ${adjustItem!.unit}`);
      setAdjustItem(null); loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setAdjusting(false); }
  };

  // ── Allocations ───────────────────────────────────────────────────────────
  const saveAlloc = async () => {
    if (!allocForm.worker_id) return toast.error('Select a staff member');
    if (!allocForm.item_id)   return toast.error('Select an item');
    if (!allocForm.qty || Number(allocForm.qty) <= 0) return toast.error('Enter a valid quantity');
    setSavingAlloc(true);
    try {
      const res = await fetch('/api/inventory/allocations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: allocForm.worker_id, item_id: allocForm.item_id, qty_allocated: Number(allocForm.qty), notes: allocForm.notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Stock allocated to staff');
      setShowAllocModal(false); setAllocForm({ worker_id: '', item_id: '', qty: '', notes: '' });
      loadAllocations(); loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAlloc(false); }
  };

  const submitReturn = async () => {
    if (!returnQty || Number(returnQty) <= 0) return toast.error('Enter a valid quantity');
    setReturningAlloc(true);
    try {
      const res = await fetch(`/api/inventory/allocations/${returnAlloc!.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', qty_returned: Number(returnQty), notes: returnNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Return recorded');
      setReturnAlloc(null); loadAllocations(); loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setReturningAlloc(false); }
  };

  const submitClose = async () => {
    if (!closeAlloc) return;
    setClosingAlloc(true);
    try {
      const res = await fetch(`/api/inventory/allocations/${closeAlloc.alloc.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: closeAlloc.action, notes: closeNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(closeAlloc.action === 'consumed' ? 'Marked as consumed' : 'Damage / loss recorded');
      setCloseAlloc(null); loadAllocations(); loadItems();
    } catch (e: any) { toast.error(e.message); }
    finally { setClosingAlloc(false); }
  };

  const lowStock = (i: Item) => Number(i.reorder_level) > 0 && Number(i.current_qty) <= Number(i.reorder_level);

  // Build group options for SearchableSelect — hierarchical (parent then indented children)
  const groupOptions = [
    { value: '', label: 'All Groups' },
    ...rootGroups.filter(g => g.is_active).flatMap(g => [
      { value: g.id, label: g.name },
      ...childGroups(g.id).filter(c => c.is_active).map(c => ({ value: c.id, label: `  ↳ ${c.name}` })),
    ]),
    // orphaned sub-groups whose parent was deleted
    ...groups.filter(g => g.is_active && g.parent_id && !groups.find(p => p.id === g.parent_id))
             .map(g => ({ value: g.id, label: g.name })),
  ];

  // Build supplier options for SearchableSelect
  const supplierOptions = [{ value: '', label: 'All Suppliers' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))];
  const supplierSelectOptions = suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name }));
  const workerOptions  = workers.map(w => ({ value: w.id, label: `${w.name} — ${w.job_title}` }));
  const itemOptions    = items.map(i => ({ value: i.id, label: `${i.name} (${i.current_qty} ${i.unit})` }));

  const statusColor = (status: string) =>
    status === 'active' ? 'bg-blue-50 text-blue-700' :
    status === 'partial_return' ? 'bg-amber-50 text-amber-700' :
    'bg-gray-100 text-gray-500';

  const reasonColor = (r: string) =>
    r === 'purchase'    ? 'bg-green-50 text-green-700'  :
    r === 'use'         ? 'bg-blue-50 text-blue-700'    :
    r === 'damage'      ? 'bg-red-50 text-red-700'      :
    r === 'staff_loan'  ? 'bg-purple-50 text-purple-700':
    r === 'staff_return'? 'bg-teal-50 text-teal-700'    :
    'bg-gray-100 text-gray-600';

  const reasonLabel = (r: string) => ({
    purchase: 'Purchase', use: 'Used in Service', damage: 'Damaged',
    return: 'Returned', adjustment: 'Adjustment',
    staff_loan: 'Staff Loan', staff_return: 'Staff Return',
  }[r] || r);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Inventory" />

      <div className="container mx-auto p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard label="Total Items" value={invSummary.totalItems} accent="border-l-4 border-indigo-500" />
          <StatCard label="Inventory Value" value={formatCurrency(invSummary.totalValue)} accent="border-l-4 border-purple-500" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('invValue')} onToggle={() => toggleCard('invValue')} />
          <StatCard
            label="Low Stock Alerts"
            value={invSummary.lowStockCount}
            accent={`border-l-4 ${invSummary.lowStockCount > 0 ? 'border-red-500' : 'border-green-500'}`}
            valueColor={invSummary.lowStockCount > 0 ? 'text-red-600 text-xl sm:text-2xl' : 'text-green-600 text-xl sm:text-2xl'}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
            {(['items', 'groups', 'allocations', 'movements'] as TabKey[]).map(t => {
              const active = tab === t;
              const labels: Record<TabKey, string> = { items: 'Stock Items', groups: 'Stock Groups', allocations: 'Staff Allocations', movements: 'Movement Log' };
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {canEdit  && tab === 'items'       && <button onClick={openAddItem}  className="btn-primary text-sm">+ Add Item</button>}
            {canAdmin && tab === 'groups'       && <button onClick={openAddGroup} className="btn-primary text-sm">+ Add Group</button>}
            {canEdit  && tab === 'allocations' && <button onClick={() => { setAllocForm({ worker_id: '', item_id: '', qty: '', notes: '' }); setShowAllocModal(true); }} className="btn-primary text-sm">+ Allocate Stock</button>}
            <Link href="/inventory/equipment" className="btn-secondary text-sm">Equipment</Link>
            <Link href="/inventory/payables" className="btn-secondary text-sm">Payables</Link>
            <Link href="/inventory/suppliers" className="btn-secondary text-sm">Suppliers</Link>
          </div>
        </div>

        {/* ── ITEMS TAB ── */}
        {tab === 'items' && (
          <div className="space-y-4">
            {/* Filters row */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Group filter */}
              <SearchableSelect
                options={groupOptions}
                value={filterGroup}
                onChange={setFilterGroup}
                placeholder="All Groups"
                className="w-48"
              />
              {/* Supplier filter */}
              {suppliers.length > 0 && (
                <SearchableSelect
                  options={supplierOptions}
                  value={filterSupplier}
                  onChange={setFilterSupplier}
                  placeholder="All Suppliers"
                  className="w-48"
                />
              )}
            </div>

            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No items yet.
                  {canEdit && <button onClick={openAddItem} className="block mx-auto mt-3 btn-primary text-sm">Add First Item</button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Reorder</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Cost / unit</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                        {canEdit && <th className="py-3 px-4" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(i => (
                        <tr key={i.id} onClick={() => router.push(`/inventory/items/${i.id}`)} className={`hover:bg-gray-50 cursor-pointer ${lowStock(i) ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">{i.name}</div>
                            {i.sku && <div className="text-xs text-gray-400 font-mono">SKU: {i.sku}</div>}
                          </td>
                          <td className="py-3 px-4">
                            {i.group ? (
                              <div className="flex flex-col gap-0.5">
                                {i.group.parent_id && (
                                  <span className="text-xs text-gray-400">
                                    {groups.find(g => g.id === i.group!.parent_id)?.name}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white w-fit" style={{ backgroundColor: i.group.color }}>
                                  {i.group.name}
                                </span>
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{i.supplier?.name || <span className="text-gray-300">—</span>}</td>
                          <td className="py-3 px-4">
                            {i.branch_name ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {i.branch_name}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${lowStock(i) ? 'text-red-600' : 'text-gray-900'}`}>{i.current_qty} {i.unit}</span>
                            {lowStock(i) && <div className="text-[10px] text-red-500 font-medium">LOW STOCK</div>}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500">{i.reorder_level > 0 ? `${i.reorder_level} ${i.unit}` : '—'}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{i.cost_per_unit > 0 ? formatCurrency(i.cost_per_unit) : '—'}</td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCurrency(i.current_qty * i.cost_per_unit)}</td>
                          {canEdit && (
                            <td className="py-3 px-4">
                              <button onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const spaceBelow = window.innerHeight - r.bottom; const pos = spaceBelow < 220 ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right }; setMenuPos(pos); setOpenMenuId(openMenuId === i.id ? null : i.id); }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GROUPS TAB ── */}
        {tab === 'groups' && (
          <div className="space-y-6">
            {groups.length === 0 ? (
              <div className="card text-center text-gray-400 py-12">
                No groups yet.
                {canAdmin && <button onClick={openAddGroup} className="block mx-auto mt-3 btn-primary text-sm">Create First Group</button>}
              </div>
            ) : (
              <>
                {/* Parent groups with their children */}
                {rootGroups.map(g => {
                  const children = childGroups(g.id);
                  return (
                    <div key={g.id}>
                      {/* Parent group card */}
                      <div className="card flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: g.color }}>
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{g.name}</p>
                            {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${g.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{g.is_active ? 'Active' : 'Inactive'}</span>
                              <span className="text-xs text-gray-400">{g.item_count} item{g.item_count !== 1 ? 's' : ''}</span>
                              {children.length > 0 && <span className="text-xs text-gray-400">{children.length} sub-group{children.length !== 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                        {canAdmin && (
                          <div className="flex gap-3 shrink-0">
                            <button onClick={() => openEditGroup(g)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                            <button onClick={() => deleteGroup(g.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                          </div>
                        )}
                      </div>
                      {/* Child groups */}
                      {children.length > 0 && (
                        <div className="ml-6 grid md:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                          {children.map(c => (
                            <div key={c.id} className="card flex items-start justify-between gap-2 py-3 border-l-4" style={{ borderLeftColor: c.color }}>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                                {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                                <span className="text-xs text-gray-400">{c.item_count} item{c.item_count !== 1 ? 's' : ''}</span>
                              </div>
                              {canAdmin && (
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={() => openEditGroup(c)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                                  <button onClick={() => deleteGroup(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                                </div>
                              )}
                            </div>
                          ))}
                          {canAdmin && (
                            <button onClick={() => { setGroupForm({ ...BLANK_GROUP, parent_id: g.id, color: g.color }); setEditingGroup(null); setShowGroupModal(true); }}
                              className="card flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-brand-primary border-2 border-dashed border-gray-200 hover:border-brand-primary transition-colors">
                              + Add sub-group
                            </button>
                          )}
                        </div>
                      )}
                      {children.length === 0 && canAdmin && (
                        <div className="ml-6 mb-2">
                          <button onClick={() => { setGroupForm({ ...BLANK_GROUP, parent_id: g.id, color: g.color }); setEditingGroup(null); setShowGroupModal(true); }}
                            className="text-xs text-gray-400 hover:text-brand-primary font-medium transition-colors">
                            + Add sub-group under {g.name}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Orphan groups (parent was deleted) */}
                {groups.filter(g => g.parent_id && !groups.find(p => p.id === g.parent_id)).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase mb-2">Ungrouped sub-groups</p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groups.filter(g => g.parent_id && !groups.find(p => p.id === g.parent_id)).map(g => (
                        <div key={g.id} className="card flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: g.color }}>{g.name.charAt(0).toUpperCase()}</div>
                            <div><p className="font-medium text-gray-900 text-sm">{g.name}</p></div>
                          </div>
                          {canAdmin && <div className="flex gap-2 shrink-0"><button onClick={() => openEditGroup(g)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button><button onClick={() => deleteGroup(g.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ALLOCATIONS TAB ── */}
        {tab === 'allocations' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { value: 'active',   label: 'Active Loans',   color: '' },
                { value: 'returned', label: 'Returned',        color: 'text-gray-700 border-gray-300 bg-gray-100' },
                { value: 'consumed', label: 'Consumed',        color: 'text-green-700 border-green-300 bg-green-50' },
                { value: 'damage',   label: 'Damaged / Lost',  color: 'text-red-700 border-red-300 bg-red-50' },
                { value: 'all',      label: 'All',             color: '' },
              ] as const).map(f => (
                <button key={f.value} onClick={() => setAllocFilter(f.value)}
                  style={allocFilter === f.value && !f.color ? { backgroundColor: brandColor, color: '#fff' } : {}}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all border ${
                    allocFilter === f.value
                      ? f.color || 'border-transparent shadow-sm'
                      : `bg-white border-gray-200 text-gray-600 hover:bg-gray-50`
                  } ${allocFilter === f.value && f.color ? f.color : ''}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading…</div>
              ) : allocations.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <p className="text-lg font-medium mb-1">No allocations</p>
                  <p className="text-sm mb-4">Use "Allocate Stock" to loan inventory items to staff members.</p>
                  {canEdit && <button onClick={() => setShowAllocModal(true)} className="btn-primary text-sm">+ Allocate Stock</button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Returned</th>
                        <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        {canEdit && <th className="py-3 px-4" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allocations.map(a => {
                        const outstanding = Number(a.qty_allocated) - Number(a.qty_returned);
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <p className="font-medium text-gray-900">{a.worker?.name || '—'}</p>
                              <p className="text-xs text-gray-400">{a.worker?.job_title}</p>
                            </td>
                            <td className="py-3 px-4 font-medium text-gray-800">{a.item?.name || '—'}</td>
                            <td className="py-3 px-4 text-right text-gray-700">{a.qty_allocated} {a.item?.unit}</td>
                            <td className="py-3 px-4 text-right text-gray-500">{a.qty_returned} {a.item?.unit}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-semibold ${outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {outstanding} {a.item?.unit}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusColor(a.status)}`}>
                                  {a.status === 'active' ? 'Active' : a.status === 'partial_return' ? 'Partial Return' : 'Closed'}
                                </span>
                                {a.closed_reason && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                                    a.closed_reason === 'consumed' ? 'bg-green-50 text-green-700' :
                                    a.closed_reason === 'damage'   ? 'bg-red-50 text-red-700'     :
                                    'bg-gray-100 text-gray-500'
                                  }`}>
                                    {a.closed_reason === 'consumed' ? 'Consumed' :
                                     a.closed_reason === 'damage'   ? 'Damaged / Lost' :
                                     'Returned'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                              {new Date(a.allocated_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            {canEdit && (
                              <td className="py-3 px-4">
                                {a.status !== 'closed' && (
                                  <button
                                    onClick={e => {
                                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setAllocMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                                      setAllocMenuId(allocMenuId === a.id ? null : a.id);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                    </svg>
                                  </button>
                                )}
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
        )}

        {/* ── MOVEMENTS TAB ── */}
        {tab === 'movements' && (
          <div className="card p-0 overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No stock movements recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                      <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">After</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff / Worker</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{m.item?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reasonColor(m.reason)}`}>
                            {reasonLabel(m.reason)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{m.notes || '—'}</td>
                        <td className={`py-3 px-4 text-right font-semibold ${m.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {m.qty_change > 0 ? '+' : ''}{m.qty_change} {m.item?.unit}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700">{m.qty_after} {m.item?.unit}</td>
                        <td className="py-3 px-4 text-gray-500">
                          <div>{m.staff?.name || '—'}</div>
                          {m.worker_name && <div className="text-xs text-purple-600">→ {m.worker_name}</div>}
                        </td>
                        <td className="py-3 px-4">
                          {m.branch_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary whitespace-nowrap">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {m.branch_name}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
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

      {/* ── Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editingGroup ? 'Edit Group' : 'New Stock Group'}</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. Gel Products" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Group <span className="text-gray-400 font-normal">(optional — makes this a sub-group)</span></label>
                <select value={groupForm.parent_id} onChange={e => setGroupForm(f => ({ ...f, parent_id: e.target.value }))} className="input w-full">
                  <option value="">None — top-level group</option>
                  {groups.filter(g => !g.parent_id && g.id !== editingGroup?.id).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} className="input w-full" placeholder="Brief description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={groupForm.color} onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input value={groupForm.color} onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))} className="input flex-1 font-mono" maxLength={7} />
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: groupForm.color }} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveGroup} disabled={savingGroup} className="btn-primary flex-1">{savingGroup ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Modal ── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editingItem ? 'Edit Item' : 'New Stock Item'}</h2>
              <button onClick={() => setShowItemModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. OPI Gel Base Coat 15ml" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={itemForm.group_id} onChange={e => setItemForm(f => ({ ...f, group_id: e.target.value }))} className="input w-full">
                    <option value="">No group</option>
                    {rootGroups.filter(g => g.is_active).map(g => (
                      <optgroup key={g.id} label={g.name}>
                        <option value={g.id}>{g.name}</option>
                        {childGroups(g.id).filter(c => c.is_active).map(c => (
                          <option key={c.id} value={c.id}>↳ {c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                    {groups.filter(g => g.is_active && g.parent_id && !groups.find(p => p.id === g.parent_id)).map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} className="input w-full">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier <span className="text-gray-400 font-normal">(optional)</span></label>
                <SearchableSelect
                  options={[{ value: '', label: 'No supplier' }, ...supplierSelectOptions]}
                  value={itemForm.supplier_id}
                  onChange={v => setItemForm(f => ({ ...f, supplier_id: v }))}
                  placeholder="Search supplier…"
                />
                {supplierSelectOptions.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    No suppliers yet. <Link href="/inventory/suppliers" className="text-brand-primary hover:underline">Add suppliers →</Link>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Product Code <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={itemForm.sku} onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))} className="input w-full font-mono" placeholder="e.g. OPI-GEL-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {!editingItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opening Qty</label>
                    <NumberInput min={0} value={itemForm.current_qty} onChange={e => setItemForm(f => ({ ...f, current_qty: e.target.value }))} className="input w-full" placeholder="0" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <NumberInput min={0} value={itemForm.reorder_level} onChange={e => setItemForm(f => ({ ...f, reorder_level: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost / unit (UGX)</label>
                  <NumberInput min={0} value={itemForm.cost_per_unit} onChange={e => setItemForm(f => ({ ...f, cost_per_unit: e.target.value }))} className="input w-full" placeholder="0" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowItemModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveItem} disabled={savingItem} className="btn-primary flex-1">{savingItem ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust Qty Modal ── */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Adjust Stock</h2>
                <p className="text-sm text-gray-500 mt-0.5">{adjustItem.name} — Current: <strong>{adjustItem.current_qty} {adjustItem.unit}</strong></p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity ({adjustItem.unit})</label>
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
              <button onClick={() => setAdjustItem(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitAdjust} disabled={adjusting} className="btn-primary flex-1">{adjusting ? 'Saving…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocate Stock Modal ── */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Allocate Stock to Staff</h2>
              <button onClick={() => setShowAllocModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <SearchableSelect options={workerOptions} value={allocForm.worker_id} onChange={v => setAllocForm(f => ({ ...f, worker_id: v }))} placeholder="Search staff…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <SearchableSelect options={itemOptions} value={allocForm.item_id} onChange={v => setAllocForm(f => ({ ...f, item_id: v }))} placeholder="Search item…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <NumberInput min={1} value={allocForm.qty} onChange={e => setAllocForm(f => ({ ...f, qty: e.target.value }))} className="input w-full" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={allocForm.notes} onChange={e => setAllocForm(f => ({ ...f, notes: e.target.value }))} className="input w-full" placeholder="Purpose, expected return date, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowAllocModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveAlloc} disabled={savingAlloc} className="btn-primary flex-1">{savingAlloc ? 'Saving…' : 'Allocate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Return Modal ── */}
      {returnAlloc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">Record Return</h2>
                <p className="text-sm text-gray-500 mt-0.5">{returnAlloc.worker?.name} → {returnAlloc.item?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Outstanding: {Number(returnAlloc.qty_allocated) - Number(returnAlloc.qty_returned)} {returnAlloc.item?.unit}</p>
              </div>
              <button onClick={() => setReturnAlloc(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Returned ({returnAlloc.item?.unit})</label>
                <NumberInput min={1} value={returnQty} onChange={e => setReturnQty(e.target.value)} className="input w-full" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} className="input w-full" placeholder="Condition, partial use, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setReturnAlloc(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitReturn} disabled={returningAlloc} className="btn-primary flex-1">{returningAlloc ? 'Saving…' : 'Confirm Return'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocation action menu ── */}
      {allocMenuId && allocMenuPos && (() => {
        const a = allocations.find(x => x.id === allocMenuId);
        if (!a) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAllocMenuId(null)} />
            <div className="fixed z-50 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: allocMenuPos.top, right: allocMenuPos.right }}>
              <button onClick={() => { setReturnAlloc(a); setReturnQty(''); setReturnNotes(''); setAllocMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Record Return
              </button>
              <button onClick={() => { setCloseAlloc({ alloc: a, action: 'consumed' }); setCloseNotes(''); setAllocMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark as Used / Consumed
              </button>
              <button onClick={() => { setCloseAlloc({ alloc: a, action: 'damage' }); setCloseNotes(''); setAllocMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Report Damage / Loss
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Mark as Consumed / Damage modal ── */}
      {closeAlloc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold">
                  {closeAlloc.action === 'consumed' ? 'Mark as Used / Consumed' : 'Report Damage / Loss'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {closeAlloc.alloc.worker?.name} → {closeAlloc.alloc.item?.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Outstanding: {Number(closeAlloc.alloc.qty_allocated) - Number(closeAlloc.alloc.qty_returned)} {closeAlloc.alloc.item?.unit}
                </p>
              </div>
              <button onClick={() => setCloseAlloc(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {closeAlloc.action === 'consumed' ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-sm text-green-800">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  The outstanding quantity will be logged as used in service. No stock is added back.
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-800">
                  <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  The outstanding quantity will be logged as damaged / lost. No stock is added back.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  className="input w-full"
                  placeholder={closeAlloc.action === 'consumed' ? 'Which services were they used for?' : 'What happened to the items?'}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setCloseAlloc(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={submitClose}
                disabled={closingAlloc}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60 ${
                  closeAlloc.action === 'damage' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {closingAlloc ? 'Saving…' : closeAlloc.action === 'consumed' ? 'Confirm' : 'Report Damage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row action menu ── */}
      {openMenuId && menuPos && (() => {
        const item = items.find(i => i.id === openMenuId);
        if (!item) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div className="fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}>
              <Link href={`/inventory/items/${item.id}`} onClick={() => setOpenMenuId(null)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                View Profile
              </Link>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { openAdjust(item); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>
                Adjust Stock
              </button>
              <button onClick={() => { setAllocForm({ worker_id: '', item_id: item.id, qty: '', notes: '' }); setShowAllocModal(true); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Allocate to Staff
              </button>
              <button onClick={() => { openEditItem(item); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Item
              </button>
              {canAdmin && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { deleteItem(item.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
