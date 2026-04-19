'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';

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

interface DayData    { date: string; revenue: number; visits: number }
interface PayData    { method: string; amount: number; count: number }
interface ServiceRow { service_id: string; name: string; category: string; revenue: number; count: number }
interface ClientRow  { client_id: string; name: string; phone: string; total_spent: number; visits: number }

export default function ReportsPage() {
  const router  = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();

  const [period, setPeriod]       = useState('month');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting]   = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary]                 = useState<Summary | null>(null);
  const [revenueByDay, setRevenueByDay]       = useState<DayData[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PayData[]>([]);
  const [topServices, setTopServices]         = useState<ServiceRow[]>([]);
  const [topClients, setTopClients]           = useState<ClientRow[]>([]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const domtoimage = await import('dom-to-image-more') as any;

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

      // ── Capture the visible report body as an image ────────────────
      const imgData = await domtoimage.default.toPng(reportRef.current, {
        quality: 1,
        bgcolor: '#f9fafb',
        width: reportRef.current.scrollWidth,
        height: reportRef.current.scrollHeight,
      });

      // Convert data URL to a natural-size image to get pixel dims
      const nativeImg = new Image();
      await new Promise<void>(res => { nativeImg.onload = () => res(); nativeImg.src = imgData; });
      const imgW = pw - margin * 2;
      const imgH = (nativeImg.naturalHeight / nativeImg.naturalWidth) * imgW;
      const maxH = ph - y - margin;

      if (imgH <= maxH) {
        pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH);
      } else {
        // Multi-page: slice the image across pages
        const canvas = document.createElement('canvas');
        canvas.width = nativeImg.naturalWidth;
        canvas.height = nativeImg.naturalHeight;
        canvas.getContext('2d')!.drawImage(nativeImg, 0, 0);
        let srcY = 0;
        const pageImgH = (maxH / imgH) * nativeImg.naturalHeight;
        while (srcY < nativeImg.naturalHeight) {
          const sliceH = Math.min(pageImgH, nativeImg.naturalHeight - srcY);
          const slice = document.createElement('canvas');
          slice.width = nativeImg.naturalWidth;
          slice.height = sliceH;
          slice.getContext('2d')!.drawImage(canvas, 0, srcY, nativeImg.naturalWidth, sliceH, 0, 0, nativeImg.naturalWidth, sliceH);
          const sliceData = slice.toDataURL('image/png');
          const slicePdfH = (sliceH / nativeImg.naturalHeight) * imgH;
          pdf.addImage(sliceData, 'PNG', margin, y, imgW, slicePdfH);
          srcY += sliceH;
          if (srcY < nativeImg.naturalHeight) { pdf.addPage(); y = margin; }
        }
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
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); }}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
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
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">

        {/* Period Selector */}
        <div className="card mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Period</label>
              <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                {PERIODS.map(p => {
                  const active = period === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      style={active ? { backgroundColor: '#E31C23', color: '#fff' } : {}}
                      className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
                        active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                  <input
                    type="date" value={fromDate} max={toDate || undefined}
                    onChange={e => setFromDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                  <input
                    type="date" value={toDate} min={fromDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setToDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-4 gap-6 animate-pulse mb-6">
            {[1,2,3,4].map(i => <div key={i} className="card h-24 bg-gray-100" />)}
          </div>
        ) : (
          <div ref={reportRef}>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="card border-l-4 border-brand-primary">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.totalRevenue || 0)}</p>
              </div>
              <div className="card border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.totalVisits || 0}</p>
              </div>
              <div className="card border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Avg. Order Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary?.avgOrderValue || 0)}</p>
              </div>
              <div className="card border-l-4 border-purple-500">
                <p className="text-sm text-gray-600">Unique Clients</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.uniqueClients || 0}</p>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="card mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
              {revenueByDay.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueByDay} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      width={44}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                      labelFormatter={(label: any) => formatDate(String(label ?? ''))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="revenue" fill="#E31C23" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">

              {/* Payment Breakdown */}
              <div className="card">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Methods</h2>
                {paymentBreakdown.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="amount"
                          nameKey="method"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={({ method, percent }: { method?: string; percent?: number }) => {
                            const label = PAY_LABELS[method ?? ''] ?? method ?? '';
                            return `${label} ${((percent ?? 0) * 100).toFixed(0)}%`;
                          }}
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
                    <div className="space-y-2 min-w-[140px]">
                      {paymentBreakdown.map(p => (
                        <div key={p.method} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PAY_COLORS[p.method] || '#9ca3af' }}
                          />
                          <span className="text-gray-700">{PAY_LABELS[p.method] || p.method}</span>
                          <span className="ml-auto font-medium text-gray-900">{p.count}</span>
                        </div>
                      ))}
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
                        <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Visits</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                        <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Avg/Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topClients.map((c, i) => (
                        <tr key={c.client_id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-400">{i + 1}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700 text-right">{c.visits}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(c.total_spent)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatCurrency(c.total_spent / c.visits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
