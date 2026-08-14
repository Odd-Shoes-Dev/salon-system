'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { StatCard, NumberInput, SearchableSelect, DateRangePicker, PeriodSelector } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { localDateStr } from '@/lib/utils';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

const UNITS = ['pcs', 'ml', 'litres', 'kg', 'g', 'box', 'bottle', 'sachet', 'roll', 'pair'];

const PAYMENT_TYPES = [
  { value: 'cash',             label: '💵 Cash' },
  { value: 'mtn_mobile_money', label: '📱 MTN Mobile Money' },
  { value: 'airtel_money',     label: '📲 Airtel Money' },
  { value: 'bank',             label: '🏦 Bank' },
  { value: 'credit',           label: '📋 Credit (Pay Later)' },
];

const PERIODS = [
  { value: 'month',       label: 'This Month' },
  { value: 'last_month',  label: 'Last Month' },
  { value: '3months',     label: '3 Months' },
  { value: 'custom',      label: 'Custom' },
];

interface Supplier  { id: string; name: string; is_active: boolean }
interface StockItem { id: string; name: string; unit: string; cost_per_unit: number; current_qty: number }
interface Account   { id: string; name: string; type: string; balance: number }

interface PurchaseLine {
  item_id:   string;
  item_name: string;
  unit:      string;
  qty:       string;
  unit_cost: string;
}

interface Purchase {
  id:              string;
  purchase_date:   string;
  payment_type:    string;
  status:          string;
  supplier_name:   string | null;
  subtotal:        number;
  carriage_inward: number;
  total_cost:      number;
  item_count:      number;
  notes:           string | null;
  due_date:        string | null;
}

interface Totals {
  total_purchases: number;
  total_on_credit: number;
  total_carriage:  number;
}

const fmt = (n: number) => 'UGX ' + Math.abs(Math.round(n)).toLocaleString('en-UG');

function getPeriodRange(period: string): { from: string; to: string } {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = now.getMonth();
  if (period === 'month')      return { from: localDateStr(new Date(y, m, 1)),     to: localDateStr() };
  if (period === 'last_month') return { from: localDateStr(new Date(y, m - 1, 1)), to: localDateStr(new Date(y, m, 0)) };
  if (period === '3months')    return { from: localDateStr(new Date(y, m - 2, 1)), to: localDateStr() };
  return { from: localDateStr(new Date(y, m, 1)), to: localDateStr() };
}

const BLANK_LINE: PurchaseLine = { item_id: '', item_name: '', unit: 'pcs', qty: '', unit_cost: '' };

export default function PurchasesPage() {
  const router     = useRouter();
  const { user }   = useUser();
  const { salon }  = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canEdit    = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canAdmin   = ['owner', 'admin'].includes(user?.role || '');
  const { run }    = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  // List state
  const [purchases,  setPurchases]  = useState<Purchase[]>([]);
  const [totals,     setTotals]     = useState<Totals>({ total_purchases: 0, total_on_credit: 0, total_carriage: 0 });
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Reference data
  const [suppliers,   setSuppliers]  = useState<Supplier[]>([]);
  const [stockItems,  setStockItems] = useState<StockItem[]>([]);
  const [accounts,    setAccounts]   = useState<Account[]>([]);

  // Modal
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Form
  const [form, setForm] = useState({
    supplier_id:     '',
    purchase_date:   localDateStr(),
    payment_type:    'cash',
    account_id:      '',
    due_date:        '',
    carriage_inward: '',
    notes:           '',
  });
  const [lines, setLines] = useState<PurchaseLine[]>([{ ...BLANK_LINE }]);

  const { from, to } = period === 'custom'
    ? { from: customFrom, to: customTo }
    : getPeriodRange(period);

  const loadPurchases = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (filterStatus) qs.set('status', filterStatus);
      const res = await fetch(`/api/purchases?${qs}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error('Failed to load purchases'); return; }
      const data = await res.json();
      setPurchases(data.purchases);
      setTotals(data.totals);
    } finally {
      setLoading(false);
    }
  }, [from, to, filterStatus, router]);

  const loadRefData = useCallback(async () => {
    const [supRes, itemRes, acctRes] = await Promise.all([
      fetch('/api/inventory/suppliers'),
      fetch('/api/inventory/items'),
      fetch('/api/accounts'),
    ]);
    if (supRes.ok)  setSuppliers((await supRes.json()).filter((s: Supplier) => s.is_active));
    if (itemRes.ok) setStockItems((await itemRes.json()).items ?? []);
    if (acctRes.ok) setAccounts((await acctRes.json()).filter((a: Account) => a.balance !== undefined));
  }, []);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);
  useEffect(() => { loadRefData(); }, [loadRefData]);

  // Derived line totals
  const subtotal    = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
  const carriage    = Number(form.carriage_inward) || 0;
  const totalCost   = subtotal + carriage;

  const addLine = () => setLines(prev => [...prev, { ...BLANK_LINE }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const updateLine = (i: number, field: keyof PurchaseLine, value: string) => {
    setLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };

      // Auto-fill unit + cost from selected stock item
      if (field === 'item_id' && value) {
        const si = stockItems.find(s => s.id === value);
        if (si) {
          next[i].item_name = si.name;
          next[i].unit      = si.unit;
          next[i].unit_cost = si.cost_per_unit > 0 ? String(si.cost_per_unit) : next[i].unit_cost;
        }
      }
      return next;
    });
  };

  const openModal = () => {
    setForm({ supplier_id: '', purchase_date: localDateStr(), payment_type: 'cash', account_id: accounts[0]?.id || '', due_date: '', carriage_inward: '', notes: '' });
    setLines([{ ...BLANK_LINE }]);
    setShowModal(true);
  };

  const savePurchase = async () => {
    if (lines.every(l => !l.item_name.trim())) { toast.error('Add at least one item'); return; }
    const validLines = lines.filter(l => l.item_name.trim() && Number(l.qty) > 0);
    if (validLines.length === 0) { toast.error('Each item must have a name and quantity'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id:     form.supplier_id || undefined,
          purchase_date:   form.purchase_date,
          payment_type:    form.payment_type,
          account_id:      form.payment_type !== 'credit' ? form.account_id : undefined,
          due_date:        form.payment_type === 'credit' ? form.due_date : undefined,
          carriage_inward: Number(form.carriage_inward) || 0,
          items:           validLines.map(l => ({
            item_id:   l.item_id || undefined,
            item_name: l.item_name.trim(),
            unit:      l.unit,
            qty:       Number(l.qty),
            unit_cost: Number(l.unit_cost) || 0,
          })),
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Purchase recorded');
      setShowModal(false);
      loadPurchases();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePurchase = (id: string) => run(`del:${id}`, () => guardAction('sensitive', async () => {
    const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Failed to delete'); return; }
    toast.success('Purchase deleted');
    loadPurchases();
  }));

  const paymentLabel = (pt: string) => PAYMENT_TYPES.find(p => p.value === pt)?.label ?? pt;

  const statusBadge = (status: string) =>
    status === 'credit'
      ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">On Credit</span>
      : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Paid</span>;

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Purchases" />
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/inventory" className="hover:text-brand-primary">Inventory</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Purchases</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
            <p className="text-sm text-gray-500 mt-0.5">Record stock purchases — separate from operating expenses</p>
          </div>
          {canEdit && (
            <button onClick={openModal} className="btn-primary text-sm shrink-0">+ New Purchase</button>
          )}
        </div>

        {/* Period filter */}
        <div className="flex flex-wrap items-end gap-4">
          <PeriodSelector periods={PERIODS} value={period} onChange={setPeriod} />
          {period === 'custom' && (
            <DateRangePicker from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} />
          )}
          <div className="flex gap-2 ml-auto">
            {['', 'paid', 'credit'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={filterStatus === s ? { backgroundColor: brandColor, borderColor: brandColor, color: '#fff' } : {}}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                  filterStatus === s ? '' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s === '' ? 'All' : s === 'paid' ? 'Paid' : 'On Credit'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Purchases" value={fmt(totals.total_purchases)} accent="border-l-4 border-blue-500"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
          <StatCard label="On Credit (Outstanding)" value={fmt(totals.total_on_credit)} accent="border-l-4 border-orange-500" valueColor={totals.total_on_credit > 0 ? 'text-orange-600 text-xl sm:text-2xl' : undefined}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard label="Carriage Inward" value={fmt(totals.total_carriage)} accent="border-l-4 border-gray-400"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} />
        </div>

        {/* Purchases list */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Purchase Records</h2>
            <span className="text-xs text-gray-400">{purchases.length} records</span>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400">Loading…</div>
          ) : purchases.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-3xl mb-3">🛒</p>
              <p className="font-medium text-gray-600">No purchases recorded</p>
              <p className="text-sm text-gray-400 mt-1">Record a stock purchase to track your cost of goods</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Payment</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Items</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Subtotal</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Carriage</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                    {canAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(p.purchase_date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.supplier_name || <span className="text-gray-400 italic">No supplier</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{paymentLabel(p.payment_type)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.item_count}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(p.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.carriage_inward > 0 ? fmt(p.carriage_inward) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.total_cost)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                      {canAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deletePurchase(p.id)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            title="Delete purchase"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 font-semibold text-gray-600 text-sm">Totals</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(purchases.reduce((s, p) => s + Number(p.subtotal), 0))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(purchases.reduce((s, p) => s + Number(p.carriage_inward), 0))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(purchases.reduce((s, p) => s + Number(p.total_cost), 0))}</td>
                    <td colSpan={canAdmin ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Info banner */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">How purchases feed into your accounts</p>
          <p className="text-blue-600">Cash/bank purchases immediately deduct from the selected account. Credit purchases create a payable — settle them from <Link href="/inventory/payables" className="underline font-medium">Payables</Link>. All purchases are used to calculate Cost of Goods Sold (COGS) in the Income Statement.</p>
        </div>

      </div>

      {/* ── Create Purchase Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">New Purchase</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">

              {/* Row 1: Supplier + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (optional)</label>
                  <SearchableSelect
                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                    value={form.supplier_id}
                    onChange={v => setForm(p => ({ ...p, supplier_id: v }))}
                    placeholder="Select supplier…"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input type="date" max={localDateStr()} value={form.purchase_date}
                    onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))}
                    className="input w-full" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Items Purchased</label>
                  <button onClick={addLine} className="text-xs text-brand-primary font-medium hover:underline">+ Add row</button>
                </div>
                <div className="border border-gray-200 rounded-xl" style={{ overflow: 'visible' }}>
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500 w-2/5">Item</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-28">Unit Cost</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-24">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((line, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <SearchableSelect
                              options={[
                                { value: '', label: 'Free text…' },
                                ...stockItems.map(s => ({ value: s.id, label: s.name })),
                              ]}
                              value={line.item_id}
                              onChange={v => updateLine(i, 'item_id', v)}
                              placeholder="Select or type…"
                            />
                            {!line.item_id && (
                              <div className="mt-1 space-y-1">
                                <input
                                  className="input w-full text-xs"
                                  placeholder="Item name"
                                  value={line.item_name}
                                  onChange={e => updateLine(i, 'item_name', e.target.value)}
                                />
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-400">Unit:</span>
                                  <select value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-primary">
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}
                            {line.item_id && (
                              <p className="text-xs text-gray-400 mt-0.5 pl-1">{line.unit}</p>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <NumberInput min="0" step="any" value={line.qty} onChange={e => updateLine(i, 'qty', e.target.value)}
                              className="input w-full text-right text-xs" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5">
                            <NumberInput min="0" step="any" value={line.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)}
                              className="input w-full text-right text-xs" placeholder="0" />
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-700 font-medium text-xs">
                            {((Number(line.qty) || 0) * (Number(line.unit_cost) || 0)).toLocaleString('en-UG')}
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {lines.length > 1 && (
                              <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">{subtotal.toLocaleString('en-UG')}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Carriage + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carriage Inward (delivery cost)</label>
                  <NumberInput min="0" value={form.carriage_inward} onChange={e => setForm(p => ({ ...p, carriage_inward: e.target.value }))}
                    className="input w-full" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="input w-full" placeholder="e.g. Monthly restock" />
                </div>
              </div>

              {/* Total summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-0.5 text-sm text-gray-600">
                  <div className="flex gap-6"><span>Subtotal:</span><span className="font-medium text-gray-800">{fmt(subtotal)}</span></div>
                  {carriage > 0 && <div className="flex gap-6"><span>Carriage:</span><span className="font-medium text-gray-800">{fmt(carriage)}</span></div>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">{fmt(totalCost)}</p>
                </div>
              </div>

              {/* Payment type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PAYMENT_TYPES.map(pt => (
                    <button key={pt.value} type="button"
                      onClick={() => setForm(p => ({ ...p, payment_type: pt.value }))}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-medium text-left transition-colors ${
                        form.payment_type === pt.value
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account selector (if not credit) */}
              {form.payment_type !== 'credit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pay From Account</label>
                  <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} className="input w-full">
                    <option value="">Select account…</option>
                    {accounts.filter(a => (a as any).is_active !== false).map(a => (
                      <option key={a.id} value={a.id}>{a.name} — {fmt(Number(a.balance))}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Due date (if credit) */}
              {form.payment_type === 'credit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date (optional)</label>
                  <input type="date" min={localDateStr()} value={form.due_date}
                    onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="input w-full" />
                  <p className="text-xs text-gray-400 mt-1">A payable will be created. Settle it from the Payables page.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={savePurchase} disabled={saving || totalCost === 0}
                className="flex-1 btn-primary text-sm disabled:opacity-50">
                {saving ? 'Saving…' : `Record Purchase — ${fmt(totalCost)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {SecurityModal}
    </div>
  );
}
