'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { SalonHeader } from '@/components/SalonBranding';
import { PeriodSelector, DateRangePicker, StatCard, useHiddenCards } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { localDateStr } from '@/lib/utils';

const PERIODS = [
  { value: 'week',       label: 'This Week' },
  { value: 'month',      label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: '3months',    label: 'Last 3 Months' },
  { value: 'year',       label: 'This Year' },
  { value: 'custom',     label: 'Custom' },
];

const PAY_COLORS: Record<string, string> = {
  cash:             '#22c55e',
  mtn_mobile_money: '#f59e0b',
  airtel_money:     '#ef4444',
  card:             '#6366f1',
  unknown:          '#9ca3af',
};

const PAY_LABELS: Record<string, string> = {
  cash:             'Cash',
  mtn_mobile_money: 'MTN MoMo',
  airtel_money:     'Airtel Money',
  card:             'Card',
};

interface Summary {
  totalRevenue: number;
  totalVisits: number;
  avgOrderValue: number;
  uniqueClients: number;
}

interface DayData   { date: string;  revenue: number; visits: number }
interface DowData   { dow: number;   day: string;    revenue: number; visits: number }
interface MonthData { month: string; label: string;  revenue: number; visits: number }
interface PayData   { method: string; amount: number; count: number }
interface ServiceRow { service_id: string; name: string; category: string; revenue: number; count: number }
interface ClientRow  { client_id: string; name: string; phone: string; total_spent: number; visits: number }

interface ExpSummary {
  total: number;
  revenue: number;
  netProfit: number;
  byCategory: { category: string; amount: number }[];
  byPaymentMethod: { method: string; amount: number }[];
}
interface ExpenseRow { id: string; category: string; amount: number; description: string; expense_date: string; payment_method: string; }
interface ClientSearch { id: string; name: string; phone: string; email?: string; total_visits: number; total_spent: number; }
interface ClientVisit {
  id: string; created_at: string; total_amount: number; payment_method: string; receipt_number: string; points_earned: number;
  visit_services: { id: string; unit_price: number; quantity: number; service: { name: string; category: string } }[];
}
interface StaffLedgerRow { id: string; name: string; phone: string; job_title: string; services_count: number; total_revenue: number; ratings_count: number; avg_rating: number | null; }

interface DbAccount { id: string; name: string; type: string; is_system: boolean; opening_balance: number; money_in: number; money_out: number; closing_balance: number; }
interface DbTransaction { id: string; account_id: string; account_name: string; amount: number; direction: 'in' | 'out'; description: string; reference_type: string; transaction_date: string; recorded_by_name: string; }
interface DbTotals { opening_balance: number; money_in: number; money_out: number; closing_balance: number; }
interface DbSummary { revenue: number; expenses: number; purchases: number; daily_net: number; }

type ReportTab = 'overview' | 'expenses' | 'clients' | 'staff' | 'daybook' | 'balance_sheet';

interface BsAccount    { id: string; name: string; type: string; balance: number; }
interface BsEquipment  { id: string; name: string; category: string | null; purchase_date: string | null; cost: number; useful_life: number; salvage_value: number; accumulated_depreciation: number; net_book_value: number; condition: string; }
interface BsLiability  { id: string; description: string; category: string; total_amount: number; amount_repaid: number; outstanding: number; due_date: string | null; notes: string | null; }
interface BsData { as_of: string; assets: { accounts: BsAccount[]; inventory_value: number; equipment: BsEquipment[]; }; liabilities: { supplier_payables: number; other: BsLiability[]; }; }

export default function ReportsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor    = salon?.theme_primary_color || '#6366f1';
  const canManageLiab = ['owner', 'admin', 'manager'].includes(user?.role || '');

  const VALID_TABS: ReportTab[] = ['overview', 'expenses', 'clients', 'staff', 'daybook', 'balance_sheet'];
  const initialTab = (searchParams.get('tab') as ReportTab | null);
  const [activeTab, setActiveTab] = useState<ReportTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'overview'
  );

  const goTab = useCallback((tab: ReportTab) => {
    setActiveTab(tab);
    router.replace(`/reports?tab=${tab}`, { scroll: false });
  }, [router]);

  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary]                   = useState<Summary | null>(null);
  const [revenueByDay, setRevenueByDay]         = useState<DayData[]>([]);
  const [revenueByDow, setRevenueByDow]         = useState<DowData[]>([]);
  const [revenueByMonth, setRevenueByMonth]     = useState<MonthData[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PayData[]>([]);
  const [topServices, setTopServices]           = useState<ServiceRow[]>([]);
  const [topClients, setTopClients]             = useState<ClientRow[]>([]);

  // ── Expenses tab ──────────────────────────────────────────────────
  const [expPeriod, setExpPeriod]       = useState('month');
  const [expFromDate, setExpFromDate]   = useState('');
  const [expToDate, setExpToDate]       = useState('');
  const [expLoading, setExpLoading]     = useState(false);
  const [expSummary, setExpSummary]     = useState<ExpSummary | null>(null);
  const [expRows, setExpRows]           = useState<ExpenseRow[]>([]);

  // ── Client Ledger tab ─────────────────────────────────────────────
  const [clientQuery, setClientQuery]         = useState('');
  const [clientResults, setClientResults]     = useState<ClientSearch[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selClient, setSelClient]             = useState<ClientSearch | null>(null);
  const [clientVisits, setClientVisits]       = useState<ClientVisit[]>([]);
  const [clientVisitsLoading, setClientVisitsLoading] = useState(false);

  // ── Staff Ledger tab ──────────────────────────────────────────────
  const [staffPeriod, setStaffPeriod]     = useState('month');
  const [staffFromDate, setStaffFromDate] = useState('');
  const [staffToDate, setStaffToDate]     = useState('');
  const [staffLoading, setStaffLoading]   = useState(false);
  const [staffLedger, setStaffLedger]     = useState<StaffLedgerRow[]>([]);

  // ── Day Book tab ──────────────────────────────────────────────────
  const [dbDate, setDbDate]               = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [dbLoading, setDbLoading]         = useState(false);
  const [dbAccounts, setDbAccounts]       = useState<DbAccount[]>([]);
  const [dbTransactions, setDbTransactions] = useState<DbTransaction[]>([]);
  const [dbTotals, setDbTotals]           = useState<DbTotals | null>(null);
  const [dbSummary, setDbSummary]         = useState<DbSummary | null>(null);

  // ── Balance Sheet tab ─────────────────────────────────────────────
  const [bsDate, setBsDate]       = useState(() => localDateStr());
  const [bsLoading, setBsLoading] = useState(false);
  const [bsData, setBsData]       = useState<BsData | null>(null);

  const [bsLiabOpen,    setBsLiabOpen]    = useState(false);
  const [bsLiabEditing, setBsLiabEditing] = useState<BsLiability | null>(null);
  const [bsLiabSaving,  setBsLiabSaving]  = useState(false);
  const [bsLiabError,   setBsLiabError]   = useState('');
  const [bsLiabForm,    setBsLiabForm]    = useState({ description: '', category: 'bank_loan', total_amount: '', amount_repaid: '', due_date: '', notes: '' });

  const { isHidden, toggle: toggleCard } = useHiddenCards(
    'reports_hidden_cards',
    ['revenue', 'avgOrder', 'expTotal', 'expRevenue', 'expNet', 'staffRevenue', 'clientSpent', 'clientAvg'] as const,
  );

  const { isHidden: isDbHidden, toggle: toggleDbCard, allHidden: allDbHidden, toggleAll: toggleAllDb } = useHiddenCards(
    'reports_daybook_cards',
    ['dbIn', 'dbOut', 'dbNet', 'dbRevenue', 'dbExpenses', 'dbPurchases', 'dbDailyNet'] as const,
  );

  const formatCurrency = (n: number | string) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(Number(n));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period });
      if (period === 'custom' && fromDate && toDate) {
        qs.set('from_date', fromDate);
        qs.set('to_date', toDate);
      }
      const res = await fetch(`/api/reports?${qs}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSummary(data.summary);
      setRevenueByDay(data.revenueByDay);
      setRevenueByDow(data.revenueByDow   || []);
      setRevenueByMonth(data.revenueByMonth || []);
      setPaymentBreakdown(data.paymentBreakdown);
      setTopServices(data.topServices);
      setTopClients(data.topClients);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom' || (fromDate && toDate)) load();
  }, [load, period, fromDate, toDate]);

  const loadExpenses = useCallback(async () => {
    setExpLoading(true);
    try {
      const qs = new URLSearchParams({ period: expPeriod });
      if (expPeriod === 'custom' && expFromDate && expToDate) {
        qs.set('from_date', expFromDate); qs.set('to_date', expToDate);
      }
      const res = await fetch(`/api/expenses?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setExpSummary(data.summary || null);
        setExpRows(data.expenses || []);
      }
    } finally { setExpLoading(false); }
  }, [expPeriod, expFromDate, expToDate]);

  const loadStaffLedger = useCallback(async () => {
    setStaffLoading(true);
    try {
      const qs = new URLSearchParams();
      if (staffPeriod === 'custom' && staffFromDate && staffToDate) {
        qs.set('from_date', staffFromDate); qs.set('to_date', staffToDate);
      } else {
        qs.set('period', staffPeriod);
      }
      const res = await fetch(`/api/workers/ledger?${qs}`);
      if (res.ok) { const d = await res.json(); setStaffLedger(d.ledger || []); }
    } finally { setStaffLoading(false); }
  }, [staffPeriod, staffFromDate, staffToDate]);

  const loadClientVisits = useCallback(async (clientId: string) => {
    setClientVisitsLoading(true);
    try {
      const res = await fetch(`/api/visits?client_id=${clientId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setClientVisits(Array.isArray(data) ? data : (data.visits || []));
      }
    } finally { setClientVisitsLoading(false); }
  }, []);

  const loadDayBook = useCallback(async () => {
    setDbLoading(true);
    try {
      const res = await fetch(`/api/reports/daybook?date=${dbDate}`);
      if (res.ok) {
        const data = await res.json();
        setDbAccounts(data.accounts || []);
        setDbTransactions(data.transactions || []);
        setDbTotals(data.totals || null);
        setDbSummary(data.daily_summary || null);
      }
    } finally { setDbLoading(false); }
  }, [dbDate]);

  const prevDay = useCallback(() => {
    const d = new Date(dbDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setDbDate(localDateStr(d));
  }, [dbDate]);

  const nextDay = useCallback(() => {
    const d = new Date(dbDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = localDateStr(d);
    if (next <= localDateStr()) setDbDate(next);
  }, [dbDate]);

  const printDayBook = useCallback(() => {
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) return;
    const dateLabel = new Date(dbDate + 'T12:00:00').toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const logoHtml = salon?.logo_url
      ? `<img src="${salon.logo_url}" alt="logo" style="height:44px;width:auto;margin-bottom:8px" onerror="this.style.display='none'" />`
      : `<div style="width:44px;height:44px;border-radius:50%;background:${brandColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;margin-bottom:8px">${(salon?.name || 'S')[0].toUpperCase()}</div>`;
    const netMovement = (dbTotals?.money_in || 0) - (dbTotals?.money_out || 0);
    const sumRevenue   = dbSummary?.revenue   || 0;
    const sumExpenses  = dbSummary?.expenses  || 0;
    const sumPurchases = dbSummary?.purchases || 0;
    const sumDailyNet  = dbSummary?.daily_net ?? 0;
    const acctRows = dbAccounts.map(a => `
      <tr>
        <td style="padding:7px 10px">${a.name}<br><span style="font-size:10px;color:#9ca3af;text-transform:capitalize">${a.type.replace(/_/g,' ')}</span></td>
        <td style="padding:7px 10px;text-align:right">${formatCurrency(a.opening_balance)}</td>
        <td style="padding:7px 10px;text-align:right;color:#16a34a">${a.money_in > 0 ? '+'+formatCurrency(a.money_in) : '—'}</td>
        <td style="padding:7px 10px;text-align:right;color:#dc2626">${a.money_out > 0 ? '-'+formatCurrency(a.money_out) : '—'}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:700">${formatCurrency(a.closing_balance)}</td>
      </tr>`).join('');
    const txRows = dbTransactions.map(tx => `
      <tr>
        <td style="padding:6px 10px;font-weight:500">${tx.account_name}</td>
        <td style="padding:6px 10px;color:#4b5563">${tx.description || '—'}</td>
        <td style="padding:6px 10px"><span style="font-size:10px;padding:2px 7px;border-radius:9999px;background:${tx.reference_type==='visit'?'#f0fdf4':tx.reference_type==='expense'?'#fef2f2':'#f3f4f6'};color:${tx.reference_type==='visit'?'#15803d':tx.reference_type==='expense'?'#dc2626':'#6b7280'}">${tx.reference_type==='visit'?'Sale':tx.reference_type==='expense'?'Expense':tx.reference_type||'Manual'}</span></td>
        <td style="padding:6px 10px;text-align:right;font-weight:600;color:#16a34a">${tx.direction==='in'?formatCurrency(tx.amount):'—'}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:600;color:#dc2626">${tx.direction==='out'?formatCurrency(tx.amount):'—'}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Day Book – ${dbDate}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{padding:24px;color:#111;font-size:13px}
      h1{font-size:20px;color:${brandColor};margin-bottom:2px}
      .meta{color:#6b7280;font-size:12px;margin-bottom:3px}
      hr{border:none;border-top:2px solid ${brandColor};margin:12px 0}
      .summary{display:flex;gap:12px;margin:14px 0 20px}
      .stat{flex:1;background:#f9fafb;border-radius:8px;padding:11px 13px;border-left:4px solid}
      .stat-lbl{font-size:10px;color:#6b7280;margin-bottom:3px;text-transform:uppercase;letter-spacing:.04em}
      .stat-val{font-size:15px;font-weight:700}
      .stat-sub{font-size:10px;color:#9ca3af;margin-top:2px}
      h2{font-size:13px;font-weight:600;margin:18px 0 7px;color:#111}
      table{width:100%;border-collapse:collapse;font-size:12px}
      thead{background:#f3f4f6}
      th{padding:7px 10px;text-align:right;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:.04em}
      th:first-child{text-align:left}
      td{border-bottom:1px solid #f3f4f6}
      .tot{background:#f9fafb;font-weight:700;border-top:2px solid #e5e7eb}
    </style></head><body>
      ${logoHtml}
      <h1>${salon?.name || 'Salon'}</h1>
      ${salon?.address ? `<p class="meta">${salon.address}</p>` : ''}
      ${salon?.phone   ? `<p class="meta">${salon.phone}</p>`   : ''}
      <hr/>
      <p style="font-size:16px;font-weight:700;margin-bottom:2px">Day Book</p>
      <p class="meta">${dateLabel}</p>
      <p class="meta">Generated: ${new Date().toLocaleString('en-UG')}</p>
      <div class="summary">
        <div class="stat" style="border-color:#22c55e"><div class="stat-lbl">Total Money In</div><div class="stat-val" style="color:#16a34a">+${formatCurrency(dbTotals?.money_in||0)}</div></div>
        <div class="stat" style="border-color:#ef4444"><div class="stat-lbl">Total Money Out</div><div class="stat-val" style="color:#dc2626">-${formatCurrency(dbTotals?.money_out||0)}</div></div>
        <div class="stat" style="border-color:${netMovement>=0?brandColor:'#f97316'}"><div class="stat-lbl">Net Movement</div><div class="stat-val" style="color:${netMovement>=0?'#111':'#ea580c'}">${netMovement>=0?'+':''}${formatCurrency(netMovement)}</div></div>
      </div>
      <h2>Daily Summary</h2>
      <div class="summary">
        <div class="stat" style="border-color:#22c55e"><div class="stat-lbl">Revenue</div><div class="stat-val" style="color:#16a34a">${formatCurrency(sumRevenue)}</div><div class="stat-sub">From sales</div></div>
        <div class="stat" style="border-color:#ef4444"><div class="stat-lbl">Expenses</div><div class="stat-val" style="color:#dc2626">${formatCurrency(sumExpenses)}</div><div class="stat-sub">Operating costs</div></div>
        ${sumPurchases>0?`<div class="stat" style="border-color:#a855f7"><div class="stat-lbl">Purchases</div><div class="stat-val" style="color:#9333ea">${formatCurrency(sumPurchases)}</div><div class="stat-sub">Stock bought</div></div>`:''}
        <div class="stat" style="border-color:${sumDailyNet>=0?brandColor:'#f97316'}"><div class="stat-lbl">Daily Net</div><div class="stat-val" style="color:${sumDailyNet>=0?'#111':'#ea580c'}">${sumDailyNet>=0?'':'-'}${formatCurrency(Math.abs(sumDailyNet))}</div><div class="stat-sub">Revenue − Expenses</div></div>
      </div>
      <h2>Account Balances</h2>
      <table><thead><tr><th>Account</th><th>Opening</th><th>Money In</th><th>Money Out</th><th>Closing</th></tr></thead>
      <tbody>${acctRows}${dbTotals?`<tr class="tot"><td style="padding:7px 10px">Total</td><td style="padding:7px 10px;text-align:right">${formatCurrency(dbTotals.opening_balance)}</td><td style="padding:7px 10px;text-align:right;color:#16a34a">+${formatCurrency(dbTotals.money_in)}</td><td style="padding:7px 10px;text-align:right;color:#dc2626">-${formatCurrency(dbTotals.money_out)}</td><td style="padding:7px 10px;text-align:right">${formatCurrency(dbTotals.closing_balance)}</td></tr>`:''}</tbody></table>
      ${dbTransactions.length>0?`<h2>Transactions (${dbTransactions.length})</h2><table><thead><tr><th>Account</th><th>Description</th><th>Type</th><th>In</th><th>Out</th></tr></thead><tbody>${txRows}</tbody></table>`:'<p style="color:#9ca3af;font-size:12px;margin-top:12px">No transactions recorded for this date.</p>'}
      <script>window.onload=function(){window.focus();window.print();};</script>
    </body></html>`);
    win.document.close();
  }, [dbDate, dbAccounts, dbTransactions, dbTotals, dbSummary, salon, brandColor, formatCurrency]);

  const loadBalanceSheet = useCallback(async () => {
    setBsLoading(true);
    try {
      const res = await fetch(`/api/balance-sheet?date=${bsDate}`);
      if (res.ok) setBsData(await res.json());
    } finally { setBsLoading(false); }
  }, [bsDate]);

  const openLiabModal = useCallback((item: BsLiability | null) => {
    setBsLiabEditing(item);
    setBsLiabError('');
    setBsLiabForm(item
      ? { description: item.description, category: item.category, total_amount: String(item.total_amount), amount_repaid: String(item.amount_repaid), due_date: item.due_date ?? '', notes: item.notes ?? '' }
      : { description: '', category: 'bank_loan', total_amount: '', amount_repaid: '', due_date: '', notes: '' });
    setBsLiabOpen(true);
  }, []);

  const closeLiabModal = useCallback(() => { setBsLiabOpen(false); setBsLiabEditing(null); }, []);

  const saveLiability = useCallback(async () => {
    if (!bsLiabForm.description.trim()) { setBsLiabError('Description is required'); return; }
    if (!bsLiabForm.total_amount || Number(bsLiabForm.total_amount) <= 0) { setBsLiabError('Enter a valid amount'); return; }
    setBsLiabSaving(true);
    setBsLiabError('');
    try {
      const url  = bsLiabEditing ? `/api/balance-sheet/liabilities/${bsLiabEditing.id}` : '/api/balance-sheet/liabilities';
      const res  = await fetch(url, { method: bsLiabEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bsLiabForm, total_amount: Number(bsLiabForm.total_amount), amount_repaid: Number(bsLiabForm.amount_repaid) || 0 }) });
      if (!res.ok) { setBsLiabError((await res.json()).error || 'Failed to save'); return; }
      closeLiabModal();
      loadBalanceSheet();
    } finally { setBsLiabSaving(false); }
  }, [bsLiabForm, bsLiabEditing, closeLiabModal, loadBalanceSheet]);

  const deleteLiability = useCallback(async (id: string) => {
    if (!confirm('Delete this liability?')) return;
    await fetch(`/api/balance-sheet/liabilities/${id}`, { method: 'DELETE' });
    loadBalanceSheet();
  }, [loadBalanceSheet]);

  const printBalanceSheet = useCallback(() => {
    if (!bsData) return;
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) return;
    const dateLabel = new Date(bsDate + 'T12:00:00').toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoHtml  = salon?.logo_url
      ? `<img src="${salon.logo_url}" alt="logo" style="height:44px;width:auto;margin-bottom:8px" onerror="this.style.display='none'" />`
      : `<div style="width:44px;height:44px;border-radius:50%;background:${brandColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;margin-bottom:8px">${(salon?.name||'S')[0].toUpperCase()}</div>`;
    const totalCurrentAssets = bsData.assets.accounts.reduce((s,a) => s + a.balance, 0) + bsData.assets.inventory_value;
    const totalFixedAssets   = bsData.assets.equipment.reduce((s,e) => s + e.net_book_value, 0);
    const totalAssets        = totalCurrentAssets + totalFixedAssets;
    const totalLiabilities   = bsData.liabilities.supplier_payables + bsData.liabilities.other.reduce((s,l) => s + l.outstanding, 0);
    const netEquity          = totalAssets - totalLiabilities;
    const acctRows  = bsData.assets.accounts.map(a => `<tr><td style="padding:5px 10px">${a.name}<br><span style="font-size:10px;color:#9ca3af;text-transform:capitalize">${a.type.replace(/_/g,' ')}</span></td><td style="padding:5px 10px;text-align:right;font-weight:600">${formatCurrency(a.balance)}</td></tr>`).join('');
    const eqRows    = bsData.assets.equipment.map(e => `<tr><td style="padding:5px 10px">${e.name}${e.category?`<br><span style="font-size:10px;color:#9ca3af">${e.category}</span>`:''}</td><td style="padding:5px 10px;text-align:right">${e.cost?formatCurrency(e.cost):'—'}</td><td style="padding:5px 10px;text-align:right;color:#dc2626">${e.accumulated_depreciation>0?`(${formatCurrency(e.accumulated_depreciation)})`:'—'}</td><td style="padding:5px 10px;text-align:right;font-weight:600">${formatCurrency(e.net_book_value)}</td></tr>`).join('');
    const liabRows  = bsData.liabilities.other.map(l => `<tr><td style="padding:5px 10px">${l.description}<br><span style="font-size:10px;color:#9ca3af;text-transform:capitalize">${l.category.replace(/_/g,' ')}</span></td><td style="padding:5px 10px;text-align:right;font-weight:600">${formatCurrency(l.outstanding)}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Balance Sheet – ${bsDate}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{padding:24px;color:#111;font-size:13px}
      h1{font-size:20px;color:${brandColor};margin-bottom:2px}
      .meta{color:#6b7280;font-size:12px;margin-bottom:3px}
      hr{border:none;border-top:2px solid ${brandColor};margin:12px 0}
      h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin:14px 0 4px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
      h3{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin:10px 0 3px;padding-left:10px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
      td{border-bottom:1px solid #f9fafb;padding:4px 10px}
      .sub{background:#f9fafb;font-weight:700}
      .grand{background:#111;color:#fff;font-weight:700;font-size:13px}
      .grand td{padding:8px 10px;border:none}
      .equity{background:${netEquity>=0?'#f0fdf4':'#fef2f2'};border-left:4px solid ${netEquity>=0?'#22c55e':'#ef4444'};padding:12px 14px;margin-top:16px;border-radius:6px}
    </style></head><body>
      ${logoHtml}<h1>${salon?.name||'Salon'}</h1>${salon?.address?`<p class="meta">${salon.address}</p>`:''}<hr/>
      <p style="font-size:16px;font-weight:700;margin-bottom:2px">Balance Sheet</p>
      <p class="meta">As of ${dateLabel}</p><p class="meta">Generated: ${new Date().toLocaleString('en-UG')}</p>
      <h2>Assets</h2>
      <h3>Current Assets</h3>
      <table><tbody>${acctRows}<tr><td style="padding:5px 10px">Inventory</td><td style="padding:5px 10px;text-align:right;font-weight:600">${formatCurrency(bsData.assets.inventory_value)}</td></tr><tr class="sub"><td style="padding:6px 10px">Total Current Assets</td><td style="padding:6px 10px;text-align:right">${formatCurrency(totalCurrentAssets)}</td></tr></tbody></table>
      ${bsData.assets.equipment.length>0?`<h3>Fixed Assets</h3><table><thead><tr><th style="text-align:left;padding:4px 10px;font-size:10px;color:#6b7280">Item</th><th style="text-align:right;padding:4px 10px;font-size:10px;color:#6b7280">Cost</th><th style="text-align:right;padding:4px 10px;font-size:10px;color:#6b7280">Depreciation</th><th style="text-align:right;padding:4px 10px;font-size:10px;color:#6b7280">NBV</th></tr></thead><tbody>${eqRows}<tr class="sub"><td style="padding:6px 10px">Total Fixed Assets</td><td></td><td></td><td style="text-align:right;padding:6px 10px">${formatCurrency(totalFixedAssets)}</td></tr></tbody></table>`:''}
      <table><tbody><tr class="grand"><td>TOTAL ASSETS</td><td style="text-align:right">${formatCurrency(totalAssets)}</td></tr></tbody></table>
      <h2>Liabilities</h2>
      <table><tbody><tr><td style="padding:5px 10px">Supplier Payables</td><td style="padding:5px 10px;text-align:right;font-weight:600">${formatCurrency(bsData.liabilities.supplier_payables)}</td></tr>${liabRows}<tr class="grand"><td>TOTAL LIABILITIES</td><td style="text-align:right">${formatCurrency(totalLiabilities)}</td></tr></tbody></table>
      <div class="equity"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px">Net Equity (Assets − Liabilities)</p><p style="font-size:20px;font-weight:700;color:${netEquity>=0?'#15803d':'#dc2626'}">${formatCurrency(netEquity)}</p></div>
      <p style="font-size:10px;color:#9ca3af;margin-top:16px">* Inventory reflects current stock levels. Equipment depreciation uses straight-line method.</p>
      <script>window.onload=function(){window.focus();window.print();};</script>
    </body></html>`);
    win.document.close();
  }, [bsDate, bsData, salon, brandColor, formatCurrency]);

  useEffect(() => {
    if (activeTab === 'expenses' && (expPeriod !== 'custom' || (expFromDate && expToDate))) {
      loadExpenses();
    }
  }, [activeTab, expPeriod, expFromDate, expToDate, loadExpenses]);

  useEffect(() => {
    if (activeTab === 'staff') loadStaffLedger();
  }, [activeTab, staffPeriod, staffFromDate, staffToDate, loadStaffLedger]);

  useEffect(() => {
    if (activeTab === 'daybook') loadDayBook();
  }, [activeTab, dbDate, loadDayBook]);

  useEffect(() => {
    if (activeTab === 'balance_sheet') loadBalanceSheet();
  }, [activeTab, bsDate, loadBalanceSheet]);

  useEffect(() => {
    if (activeTab !== 'clients') return;
    setClientSearching(true);
    const delay = clientQuery.trim() ? 300 : 0;
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ paginated: 'true', pageSize: '30' });
        if (clientQuery.trim()) qs.set('search', clientQuery.trim());
        const res = await fetch(`/api/clients?${qs}`);
        if (res.ok) {
          const data = await res.json();
          setClientResults(data.data || data.clients || []);
        }
      } finally { setClientSearching(false); }
    }, delay);
    return () => clearTimeout(timer);
  }, [clientQuery, activeTab]);

  const exportCSV = () => {
    if (!summary) return;
    const rows: string[][] = [];

    rows.push(['SUMMARY']);
    rows.push(['Total Revenue', String(summary.totalRevenue)]);
    rows.push(['Total Transactions', String(summary.totalVisits)]);
    rows.push(['Avg Order Value', String(Math.round(summary.avgOrderValue))]);
    rows.push(['Unique Clients', String(summary.uniqueClients)]);
    rows.push([]);

    rows.push(['REVENUE BY DAY', '', '']);
    rows.push(['Date', 'Revenue', 'Visits']);
    revenueByDay.forEach(d => rows.push([d.date, String(d.revenue), String(d.visits)]));
    rows.push([]);

    rows.push(['TOP SERVICES', '', '']);
    rows.push(['Service', 'Revenue', 'Count']);
    topServices.forEach(s => rows.push([s.name, String(s.revenue), String(s.count)]));
    rows.push([]);

    rows.push(['TOP CLIENTS', '', '', '']);
    rows.push(['Name', 'Phone', 'Visits', 'Total Spent']);
    topClients.forEach(c => rows.push([c.name, c.phone, String(c.visits), String(c.total_spent)]));
    rows.push([]);

    rows.push(['PAYMENT METHODS', '', '']);
    rows.push(['Method', 'Amount', 'Count']);
    paymentBreakdown.forEach(p => rows.push([p.method, String(p.amount), String(p.count)]));

    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!summary || !reportRef.current) return;
    setExporting(true);
    setExportOpen(false);
    try {
      const { default: jsPDF } = await import('jspdf');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // ── Header: logo + salon info ──────────────────────────────────
      const brandColor = salon?.theme_primary_color || '#E31C23';
      const r = parseInt(brandColor.slice(1, 3), 16);
      const g = parseInt(brandColor.slice(3, 5), 16);
      const b = parseInt(brandColor.slice(5, 7), 16);

      if (salon?.logo_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej();
            img.src = salon.logo_url!;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          const logoData = canvas.toDataURL('image/png');
          const logoH = 16;
          const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
          pdf.addImage(logoData, 'PNG', margin, y, logoW, logoH);
          y += logoH + 4;
        } catch { /* skip logo if blocked */ }
      }

      pdf.setFontSize(18);
      pdf.setTextColor(r, g, b);
      pdf.setFont('helvetica', 'bold');
      pdf.text(salon?.name || 'Salon', margin, y);
      y += 7;

      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont('helvetica', 'normal');
      if (salon?.address) { pdf.text(salon.address, margin, y); y += 5; }
      if (salon?.phone)   { pdf.text(salon.phone, margin, y); y += 5; }
      if (salon?.email)   { pdf.text(salon.email, margin, y); y += 5; }

      const periodLabel = PERIODS.find(p => p.value === period)?.label || period;
      const dateRange = `${fromDate || ''} ${toDate ? '— ' + toDate : ''}`.trim();
      pdf.text(`Report Period: ${periodLabel}${dateRange ? ' (' + dateRange + ')' : ''}`, margin, y); y += 5;
      pdf.text(`Generated: ${new Date().toLocaleString('en-UG')}`, margin, y); y += 8;

      // Divider
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(0.4);
      pdf.line(margin, y, pw - margin, y);
      y += 6;

      // ── Summary cards ──────────────────────────────────────────────
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('Summary', margin, y); y += 6;

      const cards = [
        { label: 'Total Revenue',    value: formatCurrency(summary.totalRevenue) },
        { label: 'Transactions',     value: String(summary.totalVisits) },
        { label: 'Avg Order Value',  value: formatCurrency(summary.avgOrderValue) },
        { label: 'Unique Clients',   value: String(summary.uniqueClients) },
      ];
      const cardW = (pw - margin * 2 - 9) / 4;
      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 3);
        pdf.setFillColor(248, 248, 248);
        pdf.roundedRect(x, y, cardW, 16, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(c.label, x + 3, y + 5);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(c.value, x + 3, y + 12);
      });
      y += 22;

      const checkPageBreak = (needed: number) => {
        if (y + needed > ph - margin) { pdf.addPage(); y = margin; }
      };

      const sectionTitle = (title: string) => {
        checkPageBreak(12);
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 30, 30);
        pdf.text(title, margin, y); y += 6;
      };

      // ── Revenue chart (bar chart drawn with rects) ─────────────────
      if (revenueByDay.length > 0) {
        sectionTitle('Revenue Over Time');
        const chartH = 40; const chartW = pw - margin * 2;
        const maxRev = Math.max(...revenueByDay.map(d => d.revenue), 1);
        const slotW = Math.max(4, Math.min(12, chartW / revenueByDay.length));
        const barW = slotW * 0.6;
        const gapW = slotW - barW;
        const totalBarsW = revenueByDay.length * slotW;
        const startX = margin + (chartW - totalBarsW) / 2;
        revenueByDay.forEach((d, i) => {
          const barH = Math.max(0.5, (d.revenue / maxRev) * chartH);
          const x = startX + i * slotW + gapW / 2;
          pdf.setFillColor(r, g, b);
          pdf.rect(x, y + chartH - barH, barW, barH, 'F');
        });
        // x-axis baseline
        pdf.setDrawColor(200, 200, 200); pdf.setLineWidth(0.2);
        pdf.line(startX, y + chartH, startX + totalBarsW, y + chartH);
        // x-axis labels (first + last)
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
        if (revenueByDay.length > 0) {
          pdf.text(formatDate(revenueByDay[0].date), startX, y + chartH + 4);
          if (revenueByDay.length > 1) {
            const lastDate = formatDate(revenueByDay[revenueByDay.length - 1].date);
            const lastX = startX + (revenueByDay.length - 1) * slotW + gapW / 2;
            pdf.text(lastDate, lastX, y + chartH + 4);
          }
        }
        y += chartH + 10;
      }

      // ── Payment Methods ────────────────────────────────────────────
      if (paymentBreakdown.length > 0) {
        checkPageBreak(10 + paymentBreakdown.length * 7);
        sectionTitle('Payment Methods');
        const colW = (pw - margin * 2) / 3;
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Method', margin, y);
        pdf.text('Count', margin + colW, y, { align: 'right' });
        pdf.text('Amount', margin + colW * 2, y, { align: 'right' });
        y += 1;
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.3);
        pdf.line(margin, y, pw - margin, y); y += 4;
        const totalAmt = paymentBreakdown.reduce((s, p) => s + Number(p.amount), 0);
        paymentBreakdown.forEach(p => {
          const pct = totalAmt > 0 ? ((Number(p.amount) / totalAmt) * 100).toFixed(0) : '0';
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30);
          pdf.text(`${PAY_LABELS[p.method] || p.method} (${pct}%)`, margin, y);
          pdf.text(String(p.count), margin + colW, y, { align: 'right' });
          pdf.text(formatCurrency(Number(p.amount)), margin + colW * 2, y, { align: 'right' });
          y += 6;
        });
        y += 4;
      }

      // ── Top Services ───────────────────────────────────────────────
      if (topServices.length > 0) {
        checkPageBreak(10 + Math.min(topServices.length, 6) * 7);
        sectionTitle('Top Services');
        const maxRev = topServices[0].revenue;
        topServices.slice(0, 6).forEach((svc, i) => {
          checkPageBreak(8);
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
          pdf.text(`#${i + 1}`, margin, y);
          pdf.setTextColor(30, 30, 30);
          pdf.text(svc.name, margin + 8, y);
          pdf.setFont('helvetica', 'bold');
          pdf.text(formatCurrency(svc.revenue), pw - margin - 18, y, { align: 'right' });
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130, 130, 130);
          pdf.text(`×${svc.count}`, pw - margin, y, { align: 'right' });
          y += 3;
          // bar
          const barW = ((pw - margin * 2 - 8) * (svc.revenue / maxRev));
          pdf.setFillColor(r, g, b, 0.15);
          pdf.setFillColor(220, 220, 220);
          pdf.rect(margin + 8, y, pw - margin * 2 - 8, 1.5, 'F');
          pdf.setFillColor(r, g, b);
          pdf.rect(margin + 8, y, barW, 1.5, 'F');
          y += 5;
        });
        y += 4;
      }

      // ── Top Clients ────────────────────────────────────────────────
      if (topClients.length > 0) {
        checkPageBreak(14 + topClients.length * 8);
        sectionTitle('Top Clients by Spend');
        const cols = [
          { label: '#',           w: 8,  align: 'left'  as const },
          { label: 'Client',      w: 60, align: 'left'  as const },
          { label: 'Visits',      w: 20, align: 'right' as const },
          { label: 'Total Spent', w: 40, align: 'right' as const },
          { label: 'Avg / Visit', w: 40, align: 'right' as const },
        ];
        // header row
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 100, 100);
        let cx = margin;
        cols.forEach(col => {
          pdf.text(col.label, col.align === 'right' ? cx + col.w : cx, y, { align: col.align });
          cx += col.w;
        });
        y += 1;
        pdf.setDrawColor(220, 220, 220); pdf.setLineWidth(0.3);
        pdf.line(margin, y, pw - margin, y); y += 4;

        topClients.forEach((c, i) => {
          checkPageBreak(9);
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 30, 30);
          cx = margin;
          const rowData = [
            String(i + 1),
            c.name,
            String(c.visits),
            formatCurrency(c.total_spent),
            formatCurrency(c.total_spent / c.visits),
          ];
          cols.forEach((col, ci) => {
            pdf.text(rowData[ci], col.align === 'right' ? cx + col.w : cx, y, { align: col.align });
            cx += col.w;
          });
          // phone sub-line
          if (c.phone) {
            pdf.setFontSize(6.5); pdf.setTextColor(150, 150, 150);
            pdf.text(c.phone, margin + 8, y + 4);
          }
          y += 8;
          pdf.setDrawColor(240, 240, 240); pdf.setLineWidth(0.2);
          pdf.line(margin, y - 1, pw - margin, y - 1);
        });
      }

      pdf.save(`report_${period}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const maxDayRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Reports & Analytics">
        {!loading && summary && (
          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              disabled={exporting}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting…' : 'Export'}
              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { exportCSV(); setExportOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export as CSV
                </button>
                <button
                  onClick={exportPDF}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        )}
      </SalonHeader>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {([
            { id: 'overview', label: 'Overview' },
            { id: 'expenses', label: 'Expense Report' },
            { id: 'clients',  label: 'Client Ledger' },
            { id: 'staff',    label: 'Staff Ledger' },
            { id: 'daybook',       label: 'Day Book' },
            { id: 'balance_sheet', label: 'Balance Sheet' },
          ] as { id: ReportTab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => goTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto p-6">

        {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
        {activeTab === 'overview' && <>

        {/* Period Selector */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <PeriodSelector periods={PERIODS} value={period} onChange={setPeriod} label="Period" />
            {period === 'custom' && (
              <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 animate-pulse mb-6">
            {[1,2,3,4].map(i => <div key={i} className="card h-24 bg-gray-100" />)}
          </div>
        ) : (
          <div ref={reportRef}>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
              <StatCard label="Total Revenue" value={formatCurrency(summary?.totalRevenue || 0)} accent="border-l-4 border-brand-primary" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('revenue')} onToggle={() => toggleCard('revenue')} />
              <StatCard label="Total Transactions" value={summary?.totalVisits || 0} accent="border-l-4 border-blue-500" />
              <StatCard label="Avg. Order Value" value={formatCurrency(summary?.avgOrderValue || 0)} accent="border-l-4 border-green-500" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('avgOrder')} onToggle={() => toggleCard('avgOrder')} />
              <StatCard label="Unique Clients" value={summary?.uniqueClients || 0} accent="border-l-4 border-purple-500" />
            </div>

            {/* Revenue Chart */}
            <div className="card mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
              {revenueByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={36}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                      labelFormatter={(label: any) => formatDate(String(label ?? ''))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill={brandColor} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Day-of-week + Monthly patterns */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Busiest Day of Week */}
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Busiest Day of Week</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Across the selected period</p>
                  </div>
                  {revenueByDow.length > 0 && (() => {
                    const max = revenueByDow.reduce((best, d) => d.revenue > best.revenue ? d : best, revenueByDow[0]);
                    return max.revenue > 0 ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: brandColor + '20', color: brandColor }}>
                        {max.day} leads
                      </span>
                    ) : null;
                  })()}
                </div>
                {revenueByDow.every(d => d.revenue === 0) ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenueByDow} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#6b7280' }} width={36} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: any, _: any, props: any) => [
                          <span key="rev">{formatCurrency(Number(value ?? 0))}<br/><span style={{color:'#6b7280'}}>{props.payload?.visits} visits</span></span>,
                          'Revenue',
                        ]}
                        contentStyle={{ fontSize: 12 }}
                        cursor={{ fill: '#f9fafb' }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {revenueByDow.map((entry, i) => {
                          const maxRev = Math.max(...revenueByDow.map(d => d.revenue), 1);
                          const intensity = entry.revenue > 0 ? 0.4 + 0.6 * (entry.revenue / maxRev) : 0.15;
                          return <Cell key={i} fill={brandColor} fillOpacity={intensity} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Revenue by Month */}
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Revenue by Month</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {['3months', 'year'].includes(period) ? 'Monthly breakdown' : 'Switch to 3 months or Year to see monthly trends'}
                    </p>
                  </div>
                  {revenueByMonth.length > 0 && (() => {
                    const max = revenueByMonth.reduce((best, m) => m.revenue > best.revenue ? m : best, revenueByMonth[0]);
                    return max.revenue > 0 ? (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">
                        {max.label} best
                      </span>
                    ) : null;
                  })()}
                </div>
                {!['3months', 'year'].includes(period) ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Select 3 months or Year period</div>
                ) : revenueByMonth.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} interval={0} angle={revenueByMonth.length > 6 ? -35 : 0} textAnchor={revenueByMonth.length > 6 ? 'end' : 'middle'} height={revenueByMonth.length > 6 ? 44 : 20} />
                      <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#6b7280' }} width={36} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: any, _: any, props: any) => [
                          <span key="rev">{formatCurrency(Number(value ?? 0))}<br/><span style={{color:'#6b7280'}}>{props.payload?.visits} visits</span></span>,
                          'Revenue',
                        ]}
                        contentStyle={{ fontSize: 12 }}
                        cursor={{ fill: '#f9fafb' }}
                      />
                      <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]}>
                        {revenueByMonth.map((entry, i) => {
                          const maxRev = Math.max(...revenueByMonth.map(m => m.revenue), 1);
                          const intensity = entry.revenue > 0 ? 0.4 + 0.6 * (entry.revenue / maxRev) : 0.15;
                          return <Cell key={i} fill="#22c55e" fillOpacity={intensity} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Payment Breakdown */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
                {paymentBreakdown.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-auto flex-shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={false}
                          labelLine={false}
                        >
                          {paymentBreakdown.map(entry => (
                            <Cell key={entry.method} fill={PAY_COLORS[entry.method] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value ?? 0))}
                          contentStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 flex-1">
                      {paymentBreakdown.map(p => {
                        const total = paymentBreakdown.reduce((s, x) => s + Number(x.amount), 0);
                        const pct = total > 0 ? ((Number(p.amount) / total) * 100).toFixed(0) : '0';
                        return (
                        <div key={p.method} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PAY_COLORS[p.method] || '#9ca3af' }}
                          />
                          <span className="text-gray-700 truncate">{PAY_LABELS[p.method] || p.method}</span>
                          <span className="ml-auto font-medium text-gray-900 shrink-0">{p.count} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Top Services */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Top Services</h2>
                {topServices.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="space-y-3">
                    {topServices.slice(0, 6).map((svc, i) => (
                      <div key={svc.service_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-800 truncate max-w-[55%]">
                            <span className="text-gray-400 mr-1.5">#{i + 1}</span>
                            {svc.name}
                          </span>
                          <div className="text-right shrink-0">
                            <span className="font-medium text-gray-900">{formatCurrency(svc.revenue)}</span>
                            <span className="text-gray-400 ml-2 text-xs">×{svc.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded-full"
                            style={{ width: `${(svc.revenue / topServices[0].revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Clients */}
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Top Clients by Spend</h2>
              {topClients.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Visits</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                        <th className="hidden sm:table-cell text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Avg/Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topClients.map((c, i) => (
                        <tr key={c.client_id} className="hover:bg-gray-50">
                          <td className="py-3 px-3 text-sm text-gray-400">{i + 1}</td>
                          <td className="py-3 px-3 max-w-[120px] sm:max-w-none">
                            <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.phone}</p>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-700 text-right">{c.visits}</td>
                          <td className="py-3 px-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">{formatCurrency(c.total_spent)}</td>
                          <td className="hidden sm:table-cell py-3 px-3 text-sm text-gray-600 text-right whitespace-nowrap">{formatCurrency(c.total_spent / c.visits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* end overview */}
        </>}

        {/* ── EXPENSES TAB ─────────────────────────────────────────── */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* Period */}
            <div className="card">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Period</label>
                  <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                    {PERIODS.map(p => {
                      const active = expPeriod === p.value;
                      return (
                        <button key={p.value} onClick={() => setExpPeriod(p.value)}
                          style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
                          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'}`}
                        >{p.label}</button>
                      );
                    })}
                  </div>
                </div>
                {expPeriod === 'custom' && (
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                      <input type="date" value={expFromDate} onChange={e => setExpFromDate(e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                      <input type="date" value={expToDate} max={localDateStr()} onChange={e => setExpToDate(e.target.value)} className="input" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {expLoading ? (
              <div className="grid grid-cols-3 gap-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="card h-20 bg-gray-100" />)}</div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Total Expenses" value={formatCurrency(expSummary?.total || 0)} accent="border-l-4 border-red-400" valueColor="text-red-600 text-xl sm:text-xl" hidden={isHidden('expTotal')} onToggle={() => toggleCard('expTotal')} />
                  <StatCard label="Revenue" value={formatCurrency(expSummary?.revenue || 0)} accent="border-l-4 border-green-400" valueColor="text-green-600 text-xl sm:text-xl" hidden={isHidden('expRevenue')} onToggle={() => toggleCard('expRevenue')} />
                  <StatCard
                    label="Net Profit"
                    value={formatCurrency(expSummary?.netProfit || 0)}
                    accent={`border-l-4 ${(expSummary?.netProfit || 0) >= 0 ? 'border-brand-primary' : 'border-orange-400'}`}
                    valueColor={`text-xl sm:text-xl ${(expSummary?.netProfit || 0) >= 0 ? 'text-gray-900' : 'text-orange-600'}`}
                    hidden={isHidden('expNet')}
                    onToggle={() => toggleCard('expNet')}
                  />
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* By Category */}
                  <div className="card">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">By Category</h2>
                    {(expSummary?.byCategory || []).length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">No expenses for this period</div>
                    ) : (
                      <div className="space-y-3">
                        {(expSummary?.byCategory || []).sort((a, b) => b.amount - a.amount).map(cat => (
                          <div key={cat.category}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-700 font-medium">{cat.category}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-900">{formatCurrency(cat.amount)}</span>
                                <Link
                                  href={`/expenses/${encodeURIComponent(cat.category)}`}
                                  className="text-xs text-brand-primary hover:underline whitespace-nowrap"
                                >
                                  View Details →
                                </Link>
                              </div>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-red-400"
                                style={{ width: `${(Number(cat.amount) / (Number(expSummary?.total) || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* By Payment Method */}
                  <div className="card">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">By Payment Method</h2>
                    {(expSummary?.byPaymentMethod || []).length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">No data</div>
                    ) : (
                      <div className="space-y-3">
                        {(expSummary?.byPaymentMethod || []).map(pm => (
                          <div key={pm.method} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PAY_COLORS[pm.method] || '#9ca3af' }} />
                              <span className="text-sm text-gray-700">{PAY_LABELS[pm.method] || pm.method}</span>
                            </div>
                            <span className="font-semibold text-sm text-gray-900">{formatCurrency(pm.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expense rows */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Expense Transactions <span className="text-gray-400 font-normal text-sm">({expRows.length})</span></h2>
                  </div>
                  {expRows.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No expenses recorded</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Paid From</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {expRows.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{e.expense_date}</td>
                              <td className="py-2.5 px-4 text-gray-700 font-medium">{e.category}</td>
                              <td className="py-2.5 px-4 text-gray-500">{e.description || '—'}</td>
                              <td className="py-2.5 px-4">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PAY_LABELS[e.payment_method] || e.payment_method}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CLIENT LEDGER TAB ────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            {/* Search */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Client</label>
              <div className="relative">
                <input
                  value={clientQuery}
                  onChange={e => { setClientQuery(e.target.value); setSelClient(null); setClientVisits([]); }}
                  placeholder="Name or phone number…"
                  className="input w-full pr-10"
                />
                {clientSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Searching…</span>
                )}
              </div>
            </div>

            {/* Client list — always visible when no client selected */}
            {!selClient && (
              <div className="card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Clients <span className="text-gray-400 font-normal text-sm">({clientResults.length})</span></h2>
                  {clientSearching && <span className="text-xs text-gray-400">Loading…</span>}
                </div>
                {clientResults.length === 0 && !clientSearching ? (
                  <div className="py-10 text-center text-gray-400 text-sm">No clients found</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelClient(c); loadClientVisits(c.id); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{c.total_visits} visits</p>
                          <p className="text-xs font-medium text-gray-700">{formatCurrency(Number(c.total_spent))}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selClient && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setSelClient(null); setClientVisits([]); }}
                    className="text-sm text-brand-primary font-medium flex items-center gap-1 hover:underline"
                  >
                    ← Back to clients
                  </button>
                  <Link href={`/clients/${selClient.id}`} className="btn-primary text-sm">
                    View Full Profile →
                  </Link>
                </div>
                {/* Client Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Total Visits" value={selClient.total_visits} accent="border-l-4 border-brand-primary" />
                  <StatCard label="Total Spent" value={formatCurrency(Number(selClient.total_spent))} accent="border-l-4 border-green-400" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('clientSpent')} onToggle={() => toggleCard('clientSpent')} />
                  <StatCard label="Avg / Visit" value={formatCurrency(Number(selClient.total_visits) > 0 ? Number(selClient.total_spent) / Number(selClient.total_visits) : 0)} accent="border-l-4 border-blue-400" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('clientAvg')} onToggle={() => toggleCard('clientAvg')} />
                  <StatCard label="Phone" value={selClient.phone} accent="border-l-4 border-purple-400" valueColor="text-sm text-gray-900" />
                </div>

                {/* Visit History */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Visit History <span className="text-gray-400 font-normal text-sm">({clientVisits.length})</span></h2>
                  </div>
                  {clientVisitsLoading ? (
                    <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
                  ) : clientVisits.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No visits recorded yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Services</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Points</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {clientVisits.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                                {new Date(v.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-2.5 px-4 text-gray-400 font-mono text-xs">{v.receipt_number}</td>
                              <td className="py-2.5 px-4 text-gray-700">
                                {(v.visit_services || []).map(vs => vs.service?.name).filter(Boolean).join(', ') || '—'}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PAY_LABELS[v.payment_method] || v.payment_method}</span>
                              </td>
                              <td className="py-2.5 px-4 text-right text-purple-600 font-medium">+{v.points_earned || 0}</td>
                              <td className="py-2.5 px-4 text-right font-semibold text-gray-900">{formatCurrency(v.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}


          </div>
        )}

        {/* ── STAFF LEDGER TAB ─────────────────────────────────────── */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* Period */}
            <div className="card">
              <div className="flex flex-wrap gap-3 items-end">
                <PeriodSelector periods={PERIODS} value={staffPeriod} onChange={setStaffPeriod} label="Period" />
                {staffPeriod === 'custom' && (
                  <DateRangePicker from={staffFromDate} to={staffToDate} onFromChange={setStaffFromDate} onToChange={setStaffToDate} />
                )}
              </div>
            </div>

            {staffLoading ? (
              <div className="card py-10 text-center text-gray-400">Loading…</div>
            ) : staffLedger.length === 0 ? (
              <div className="card py-16 text-center">
                <p className="text-3xl mb-3">📊</p>
                <p className="font-medium text-gray-600">No performance data</p>
                <p className="text-sm text-gray-400 mt-1">No visits were recorded for staff in this period</p>
              </div>
            ) : (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Revenue"
                    value={formatCurrency(staffLedger.reduce((s, w) => s + w.total_revenue, 0))}
                    accent="border-l-4 border-brand-primary"
                    valueColor="text-gray-900 text-lg sm:text-xl"
                    hidden={isHidden('staffRevenue')}
                    onToggle={() => toggleCard('staffRevenue')}
                  />
                  <StatCard
                    label="Total Services"
                    value={staffLedger.reduce((s, w) => s + w.services_count, 0)}
                    accent="border-l-4 border-blue-400"
                  />
                  <StatCard
                    label="Top Performer"
                    value={[...staffLedger].sort((a, b) => b.total_revenue - a.total_revenue)[0]?.name || '—'}
                    accent="border-l-4 border-yellow-400"
                    valueColor="text-gray-900 text-base sm:text-lg"
                  />
                </div>

                {/* Staff table */}
                <div className="card p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Staff Member</th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Services</th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Avg / Service</th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Rating</th>
                          <th className="py-3 px-4" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...staffLedger].sort((a, b) => b.total_revenue - a.total_revenue).map((w, i) => {
                          const maxRev = staffLedger[0]?.total_revenue || 1;
                          return (
                            <tr key={w.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-xs font-bold text-brand-primary shrink-0">
                                    {i + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{w.name}</p>
                                    <p className="text-xs text-gray-400">{w.phone}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-gray-500 capitalize">{w.job_title}</td>
                              <td className="py-3 px-4 text-right font-medium text-gray-700">{w.services_count}</td>
                              <td className="py-3 px-4 text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(w.total_revenue)}</p>
                                <div className="h-1 bg-gray-100 rounded-full mt-1 w-20 ml-auto">
                                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${(w.total_revenue / maxRev) * 100}%` }} />
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-gray-600">
                                {w.services_count > 0 ? formatCurrency(w.total_revenue / w.services_count) : '—'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {w.avg_rating != null ? (
                                  <span className="flex items-center justify-end gap-1 text-yellow-500 font-medium">
                                    ⭐ {w.avg_rating.toFixed(1)}
                                    <span className="text-xs text-gray-400 ml-1">({w.ratings_count})</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs">No ratings</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/workers/${w.id}`} className="text-sm text-brand-primary font-medium hover:underline whitespace-nowrap">
                                  View Profile →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DAY BOOK TAB ─────────────────────────────────────────── */}
        {activeTab === 'daybook' && (
          <div className="space-y-6">
            {/* Date nav + print */}
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevDay}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    title="Previous day"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={dbDate}
                      max={localDateStr()}
                      onChange={e => setDbDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <button
                    onClick={nextDay}
                    disabled={dbDate >= localDateStr()}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-5"
                    title="Next day"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <p className="text-sm text-gray-500 mt-5 hidden sm:block">
                    {new Date(dbDate + 'T12:00:00').toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAllDb}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title={allDbHidden ? 'Show all values' : 'Hide all values'}
                  >
                    {allDbHidden ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                  <button
                    onClick={printDayBook}
                    className="btn-secondary flex items-center gap-1.5 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Day Book
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2 sm:hidden">
                {new Date(dbDate + 'T12:00:00').toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {dbLoading ? (
              <div className="card py-10 text-center text-gray-400">Loading day book…</div>
            ) : (
              <>
                {/* Cash movement cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Money In"
                    value={formatCurrency(dbTotals?.money_in || 0)}
                    accent="border-l-4 border-green-400"
                    valueColor="text-green-600 text-xl sm:text-xl"
                    hidden={isDbHidden('dbIn')}
                    onToggle={() => toggleDbCard('dbIn')}
                  />
                  <StatCard
                    label="Total Money Out"
                    value={formatCurrency(dbTotals?.money_out || 0)}
                    accent="border-l-4 border-red-400"
                    valueColor="text-red-600 text-xl sm:text-xl"
                    hidden={isDbHidden('dbOut')}
                    onToggle={() => toggleDbCard('dbOut')}
                  />
                  <StatCard
                    label="Net Movement"
                    value={formatCurrency((dbTotals?.money_in || 0) - (dbTotals?.money_out || 0))}
                    accent={`border-l-4 ${((dbTotals?.money_in || 0) - (dbTotals?.money_out || 0)) >= 0 ? 'border-brand-primary' : 'border-orange-400'}`}
                    valueColor={`text-xl sm:text-xl ${((dbTotals?.money_in || 0) - (dbTotals?.money_out || 0)) >= 0 ? 'text-gray-900' : 'text-orange-600'}`}
                    hidden={isDbHidden('dbNet')}
                    onToggle={() => toggleDbCard('dbNet')}
                  />
                </div>

                {/* Daily summary */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Daily Summary</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Revenue"
                    value={formatCurrency(dbSummary?.revenue || 0)}
                    accent="border-l-4 border-green-400"
                    valueColor="text-green-600 text-xl sm:text-xl"
                    hidden={isDbHidden('dbRevenue')}
                    onToggle={() => toggleDbCard('dbRevenue')}
                  />
                  <StatCard
                    label="Expenses"
                    value={formatCurrency(dbSummary?.expenses || 0)}
                    accent="border-l-4 border-red-400"
                    valueColor="text-red-500 text-xl sm:text-xl"
                    hidden={isDbHidden('dbExpenses')}
                    onToggle={() => toggleDbCard('dbExpenses')}
                  />
                  <StatCard
                    label="Purchases"
                    value={formatCurrency(dbSummary?.purchases || 0)}
                    accent="border-l-4 border-purple-400"
                    valueColor="text-purple-600 text-xl sm:text-xl"
                    hidden={isDbHidden('dbPurchases')}
                    onToggle={() => toggleDbCard('dbPurchases')}
                  />
                  <StatCard
                    label="Daily Net"
                    value={`${(dbSummary?.daily_net ?? 0) < 0 ? '-' : ''}${formatCurrency(Math.abs(dbSummary?.daily_net ?? 0))}`}
                    accent={`border-l-4 ${(dbSummary?.daily_net ?? 0) >= 0 ? 'border-brand-primary' : 'border-orange-400'}`}
                    valueColor={`text-xl sm:text-xl ${(dbSummary?.daily_net ?? 0) >= 0 ? 'text-gray-900' : 'text-orange-600'}`}
                    hidden={isDbHidden('dbDailyNet')}
                    onToggle={() => toggleDbCard('dbDailyNet')}
                  />
                </div>

                {/* Account balances table */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Account Balances</h2>
                  </div>
                  {dbAccounts.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No accounts found. Set up accounts in the Accounts section.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Opening Balance</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Money In</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Money Out</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Closing Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {dbAccounts.map(acct => (
                            <tr key={acct.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900">{acct.name}</p>
                                <p className="text-xs text-gray-400 capitalize">{acct.type.replace(/_/g, ' ')}</p>
                              </td>
                              <td className="py-3 px-4 text-right text-gray-700">{formatCurrency(acct.opening_balance)}</td>
                              <td className="py-3 px-4 text-right font-medium text-green-600">
                                {acct.money_in > 0 ? `+${formatCurrency(acct.money_in)}` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-red-500">
                                {acct.money_out > 0 ? `-${formatCurrency(acct.money_out)}` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(acct.closing_balance)}</td>
                            </tr>
                          ))}
                          {dbTotals && (
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                              <td className="py-3 px-4 font-bold text-gray-900">Total</td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(dbTotals.opening_balance)}</td>
                              <td className="py-3 px-4 text-right font-bold text-green-600">+{formatCurrency(dbTotals.money_in)}</td>
                              <td className="py-3 px-4 text-right font-bold text-red-500">-{formatCurrency(dbTotals.money_out)}</td>
                              <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(dbTotals.closing_balance)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Transactions for the day */}
                <div className="card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">
                      Transactions <span className="text-gray-400 font-normal text-sm">({dbTransactions.length})</span>
                    </h2>
                  </div>
                  {dbTransactions.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 text-sm">No transactions recorded for this date</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Account</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Money In</th>
                            <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Money Out</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {dbTransactions.map(tx => (
                            <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-4 font-medium text-gray-900 whitespace-nowrap">{tx.account_name}</td>
                              <td className="py-2.5 px-4 text-gray-600 max-w-xs truncate">{tx.description || '—'}</td>
                              <td className="py-2.5 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  tx.reference_type === 'visit'   ? 'bg-green-50 text-green-700' :
                                  tx.reference_type === 'expense' ? 'bg-red-50 text-red-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {tx.reference_type === 'visit' ? 'Sale' : tx.reference_type === 'expense' ? 'Expense' : tx.reference_type || 'Manual'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-green-600">
                                {tx.direction === 'in' ? formatCurrency(tx.amount) : <span className="text-gray-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-red-500">
                                {tx.direction === 'out' ? formatCurrency(tx.amount) : <span className="text-gray-300 font-normal">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── BALANCE SHEET TAB ────────────────────────────────────── */}
        {activeTab === 'balance_sheet' && (
          <div className="space-y-6">

            {/* Controls */}
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
                  <input type="date" value={bsDate} max={localDateStr()} onChange={e => setBsDate(e.target.value)} className="input" />
                </div>
                <button onClick={printBalanceSheet} disabled={!bsData} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  Print Balance Sheet
                </button>
              </div>
            </div>

            {bsLoading ? (
              <div className="card py-10 text-center text-gray-400">Loading balance sheet…</div>
            ) : bsData ? (() => {
              const totalCurrentAssets = bsData.assets.accounts.reduce((s, a) => s + a.balance, 0) + bsData.assets.inventory_value;
              const totalFixedAssets   = bsData.assets.equipment.reduce((s, e) => s + e.net_book_value, 0);
              const totalAssets        = totalCurrentAssets + totalFixedAssets;
              const totalOtherLiab     = bsData.liabilities.other.reduce((s, l) => s + l.outstanding, 0);
              const totalLiabilities   = bsData.liabilities.supplier_payables + totalOtherLiab;
              const netEquity          = totalAssets - totalLiabilities;

              return (
                <>
                  {/* ── ASSETS ─────────────────────────────────────────────── */}
                  <div className="card p-0 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <h2 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Assets</h2>
                    </div>

                    {/* Current Assets */}
                    <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Assets</p>
                    </div>
                    {bsData.assets.accounts.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50">
                        <div>
                          <p className="text-sm text-gray-800">{a.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{a.type.replace(/_/g, ' ')}</p>
                        </div>
                        <p className={`text-sm font-medium tabular-nums ${a.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>{formatCurrency(a.balance)}</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50">
                      <div>
                        <p className="text-sm text-gray-800">Inventory</p>
                        <p className="text-xs text-gray-400">Stock at cost — current snapshot</p>
                      </div>
                      <p className="text-sm font-medium tabular-nums text-gray-900">{formatCurrency(bsData.assets.inventory_value)}</p>
                    </div>
                    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-700">Total Current Assets</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(totalCurrentAssets)}</p>
                    </div>

                    {/* Fixed Assets */}
                    <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100 mt-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fixed Assets — Equipment</p>
                    </div>
                    {bsData.assets.equipment.length === 0 ? (
                      <p className="px-5 py-3 text-sm text-gray-400 italic">No equipment recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="py-2 px-5 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                              <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Cost</th>
                              <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Depreciation</th>
                              <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 uppercase">Net Book Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {bsData.assets.equipment.map(eq => (
                              <tr key={eq.id} className="hover:bg-gray-50">
                                <td className="py-2.5 px-5">
                                  <p className="font-medium text-gray-800">{eq.name}</p>
                                  <p className="text-xs text-gray-400 capitalize">{[eq.category, `${eq.useful_life}yr life`].filter(Boolean).join(' · ')}</p>
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums text-gray-600">{eq.cost ? formatCurrency(eq.cost) : '—'}</td>
                                <td className="py-2.5 px-4 text-right tabular-nums text-red-400">{eq.accumulated_depreciation > 0 ? `(${formatCurrency(eq.accumulated_depreciation)})` : '—'}</td>
                                <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-900">{formatCurrency(eq.net_book_value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-700">Total Fixed Assets</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900">{formatCurrency(totalFixedAssets)}</p>
                    </div>

                    {/* Grand total */}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900 text-white">
                      <p className="font-bold uppercase tracking-widest text-xs">Total Assets</p>
                      <p className="font-bold text-lg tabular-nums">{formatCurrency(totalAssets)}</p>
                    </div>
                  </div>

                  {/* ── LIABILITIES ─────────────────────────────────────────── */}
                  <div className="card p-0 overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <h2 className="font-bold text-gray-900 uppercase tracking-widest text-xs">Liabilities</h2>
                    </div>

                    {/* Supplier payables — auto */}
                    <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50">
                      <div>
                        <p className="text-sm text-gray-800">Supplier Payables</p>
                        <p className="text-xs text-gray-400">Outstanding credit purchases</p>
                      </div>
                      <p className="text-sm font-medium tabular-nums text-gray-900">{formatCurrency(bsData.liabilities.supplier_payables)}</p>
                    </div>

                    {/* Other liabilities */}
                    <div className="flex items-center justify-between px-5 py-2 bg-gray-50/60 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Other Liabilities</p>
                      {canManageLiab && (
                        <button onClick={() => openLiabModal(null)} className="flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add
                        </button>
                      )}
                    </div>
                    {bsData.liabilities.other.length === 0 ? (
                      <p className="px-5 py-3 text-sm text-gray-400 italic border-b border-gray-50">No other liabilities recorded. Add bank loans, rent arrears, etc.</p>
                    ) : (
                      bsData.liabilities.other.map(l => (
                        <div key={l.id} className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800">{l.description}</p>
                            <p className="text-xs text-gray-400 capitalize">
                              {l.category.replace(/_/g, ' ')} · Total {formatCurrency(l.total_amount)} · Repaid {formatCurrency(l.amount_repaid)}
                              {l.due_date && ` · Due ${new Date(l.due_date + 'T12:00:00').toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-4 shrink-0">
                            <p className="text-sm font-medium tabular-nums text-gray-900">{formatCurrency(l.outstanding)}</p>
                            {canManageLiab && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openLiabModal(l)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => deleteLiability(l.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    {/* Grand total */}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-gray-900 text-white">
                      <p className="font-bold uppercase tracking-widest text-xs">Total Liabilities</p>
                      <p className="font-bold text-lg tabular-nums">{formatCurrency(totalLiabilities)}</p>
                    </div>
                  </div>

                  {/* ── EQUITY ──────────────────────────────────────────────── */}
                  <div className={`card border-l-4 ${netEquity >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Net Equity</p>
                        <p className="text-xs text-gray-400 mt-0.5">Total Assets − Total Liabilities</p>
                      </div>
                      <p className={`text-2xl font-bold tabular-nums ${netEquity >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatCurrency(netEquity)}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 text-center pb-2">
                    * Inventory reflects current stock levels, not a historical snapshot. Equipment uses straight-line depreciation.
                  </p>
                </>
              );
            })() : null}

            {/* ── Add / Edit Liability Modal ─────────────────────────── */}
            {bsLiabOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                  <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">{bsLiabEditing ? 'Edit Liability' : 'Add Liability'}</h2>
                    <button onClick={closeLiabModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    {bsLiabError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{bsLiabError}</p>}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                      <input className="input" placeholder="e.g. Stanbic Bank Loan" value={bsLiabForm.description} onChange={e => setBsLiabForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <select className="input" value={bsLiabForm.category} onChange={e => setBsLiabForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="bank_loan">Bank Loan</option>
                        <option value="personal_loan">Personal Loan</option>
                        <option value="rent_arrear">Rent Arrear</option>
                        <option value="equipment_financing">Equipment Financing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount *</label>
                        <input type="number" min="0" className="input" placeholder="0" value={bsLiabForm.total_amount} onChange={e => setBsLiabForm(f => ({ ...f, total_amount: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Amount Repaid</label>
                        <input type="number" min="0" className="input" placeholder="0" value={bsLiabForm.amount_repaid} onChange={e => setBsLiabForm(f => ({ ...f, amount_repaid: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                      <input type="date" className="input" value={bsLiabForm.due_date} onChange={e => setBsLiabForm(f => ({ ...f, due_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <textarea rows={2} className="input resize-none" placeholder="Optional notes" value={bsLiabForm.notes} onChange={e => setBsLiabForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button onClick={closeLiabModal} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={saveLiability} disabled={bsLiabSaving} className="btn-primary flex-1 disabled:opacity-60">
                      {bsLiabSaving ? 'Saving…' : bsLiabEditing ? 'Save Changes' : 'Add Liability'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
