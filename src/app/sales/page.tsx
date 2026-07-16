'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { SearchInput, StatCard, DateRangePicker, useHiddenCards } from '@/components/ui';
import { TransactionSummaryModal, TransactionSummaryData } from '@/components/TransactionSummaryModal';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

interface Visit {
  id: string;
  receipt_number: string;
  total_amount: number;
  checkout_discount?: number;
  coupon_amount?: number;
  amount_paid?: number;
  balance_due?: number;
  payment_method: string;
  points_earned: number;
  created_at: string;
  edited_at?: string | null;
  client: { name: string; phone: string };
  visit_services: Array<{ quantity: number; unit_price: number; original_price?: number; discount_amount?: number; worker_ids?: string[]; service: { name: string } }>;
  visit_addons?: Array<{ name: string; quantity: number; price: number }>;
}

interface EditServiceLine {
  id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  worker_ids: string[];
}

interface WorkerOption {
  id: string;
  name: string;
  job_title: string;
}

export default function SalesPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const [visits, setVisits] = useState<Visit[]>([]);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'voided'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    totalSales: 0,
    transactionCount: 0,
    avgOrderValue: 0,
    pointsAwarded: 0,
    cashSales: 0,
    mtnSales: 0,
    airtelSales: 0,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionSummaryData | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [workersMap, setWorkersMap] = useState<Record<string, string>>({});

  // Edit staff assignment modal
  const [editVisit, setEditVisit] = useState<{ id: string; receipt_number: string } | null>(null);
  const [editServices, setEditServices] = useState<EditServiceLine[]>([]);
  const [editWorkers, setEditWorkers] = useState<WorkerOption[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editWorkerOpen, setEditWorkerOpen] = useState<string | null>(null);
  const [editWorkerQuery, setEditWorkerQuery] = useState('');

  const { isHidden, allHidden, toggle: toggleCard, toggleAll } = useHiddenCards(
    'sales_hidden_cards', ['totalSales', 'avgOrder', 'cash', 'mtn', 'airtel'] as const
  );

  useEffect(() => {
    fetch('/api/workers?active=true')
      .then(r => r.ok ? r.json() : [])
      .then((workers: { id: string; name: string }[]) => {
        setWorkersMap(Object.fromEntries(workers.map(w => [w.id, w.name])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [dateFilter, paymentFilter, statusFilter, customFromDate, customToDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVisits(page, searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [page, searchQuery, dateFilter, paymentFilter, statusFilter, customFromDate, customToDate]);

  const loadVisits = async (currentPage = page, query = searchQuery) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        paginated: 'true',
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      if (dateFilter === 'custom') {
        if (customFromDate) params.set('from_date', customFromDate);
        if (customToDate) params.set('to_date', customToDate);
      } else {
        params.set('date', dateFilter);
      }

      if (paymentFilter !== 'all') params.set('payment_method', paymentFilter);
      if (statusFilter === 'voided') params.set('status', 'voided');
      if (query.trim()) params.set('search', query.trim());

      const response = await fetch(`/api/visits?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        setVisits(payload.data || []);
        setPagination(payload.pagination || { page: currentPage, pageSize, total: 0, totalPages: 1 });
        setSummary(payload.summary || {
          totalSales: 0,
          transactionCount: 0,
          avgOrderValue: 0,
          pointsAwarded: 0,
          cashSales: 0,
          mtnSales: 0,
          airtelSales: 0,
        });
      }
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const getVisiblePages = () => {
    const pages: number[] = [];
    const total = pagination.totalPages;
    const current = pagination.page;

    if (total <= 7) {
      for (let i = 1; i <= total; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i += 1) pages.push(i);
    pages.push(total);

    return Array.from(new Set(pages));
  };

  const exportToCSV = () => {
    // Create CSV header
    const headers = ['Receipt', 'Date & Time', 'Client Name', 'Client Phone', 'Services', 'Payment Method', 'Amount', 'Points'];
    
    // Create CSV rows
    const rows = visits.map(visit => [
      visit.receipt_number,
      formatDateTime(visit.created_at),
      visit.client.name,
      visit.client.phone,
      visit.visit_services?.map(vs => `${vs.quantity}x ${vs.service?.name || 'Unknown'}`).join('; ') || '',
      visit.payment_method === 'mtn_mobile_money' ? 'MTN Mobile Money' : visit.payment_method === 'airtel_money' ? 'Airtel Money' : 'Cash',
      visit.total_amount,
      visit.points_earned
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_${dateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVoidTransaction = (visit: Visit) => {
    const confirmed = window.confirm(`Void transaction ${visit.receipt_number}?\n\nThis will permanently void the receipt and reverse the client's loyalty points and totals. This action cannot be undone.`);
    if (!confirmed) return;
    run(`void:${visit.id}`, () => guardAction('sensitive', async () => {
      const response = await fetch(`/api/visits/${visit.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to void transaction');
      }
      setPage(1);
      loadVisits(1, searchQuery);
    }));
  };

  const openEditStaff = async (_e: React.MouseEvent | MouseEvent | null, visit: Visit) => {
    setEditVisit({ id: visit.id, receipt_number: visit.receipt_number });
    setEditLoading(true);
    setEditWorkerOpen(null);
    setEditWorkerQuery('');
    try {
      const res = await fetch(`/api/visits/${visit.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditServices((data.services as any[]).map(s => ({ ...s, worker_ids: s.worker_ids || [] })));
        setEditWorkers(data.workers || []);
      }
    } catch { /* ignore */ }
    setEditLoading(false);
  };

  const saveEditStaff = async () => {
    if (!editVisit) return;
    await guardAction('sensitive', async () => {
      setEditSaving(true);
      try {
        const res = await fetch(`/api/visits/${editVisit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_assignments: editServices.map(s => ({
              visit_service_id: s.id,
              worker_ids: s.worker_ids,
            })),
          }),
        });
        if (!res.ok) throw new Error('Failed to save');
        toast.success('Staff assignments updated');
        setEditVisit(null);
      } catch {
        toast.error('Failed to update staff assignments');
      }
      setEditSaving(false);
    });
  };

  const addWorkerToEditService = (serviceId: string, workerId: string) => {
    setEditServices(prev => prev.map(s =>
      s.id === serviceId && !s.worker_ids.includes(workerId)
        ? { ...s, worker_ids: [...s.worker_ids, workerId] }
        : s
    ));
    setEditWorkerOpen(null);
    setEditWorkerQuery('');
  };

  const removeWorkerFromEditService = (serviceId: string, workerId: string) => {
    setEditServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, worker_ids: s.worker_ids.filter(id => id !== workerId) } : s
    ));
  };

  const openTransactionModal = (visit: Visit) => {
    const services = (visit.visit_services || []).map((item) => ({
      name: item.service?.name || 'Unknown Service',
      quantity: item.quantity || 1,
      unitPrice: Number(item.unit_price || 0),
      originalPrice: item.original_price ? Number(item.original_price) : undefined,
      discountAmount: item.discount_amount ? Number(item.discount_amount) : undefined,
    }));
    const totalDiscount = services.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
    const checkoutDiscount = Number(visit.checkout_discount || 0);
    const couponDiscount = Number(visit.coupon_amount || 0);
    const amountDue = Number(visit.total_amount || 0) - checkoutDiscount - couponDiscount;

    setSelectedTransaction({
      receiptNumber: visit.receipt_number,
      clientName: visit.client?.name || 'Unknown Client',
      clientPhone: visit.client?.phone || '',
      services,
      addons: (visit.visit_addons || []).map(a => ({
        name: a.name,
        quantity: a.quantity,
        price: a.price,
      })),
      total: Number(visit.total_amount || 0),
      totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
      checkoutDiscount: checkoutDiscount > 0 ? checkoutDiscount : undefined,
      couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
      amountPaid: visit.amount_paid !== undefined && Number(visit.amount_paid) !== amountDue
        ? Number(visit.amount_paid)
        : undefined,
      balanceDue: visit.balance_due !== undefined ? Number(visit.balance_due) : undefined,
      pointsEarned: Number(visit.points_earned || 0),
      paymentMethod: visit.payment_method,
      date: visit.created_at,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Sales & Transactions" />

      <div className="container mx-auto p-4 md:p-6">
        {/* Summary Stats */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-500">Summary</h2>
          <button
            onClick={toggleAll}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={allHidden ? 'Show all values' : 'Hide all values'}
          >
            {allHidden ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Sales" value={formatCurrency(summary.totalSales)} accent="border-l-4 border-brand-primary" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('totalSales')} onToggle={() => toggleCard('totalSales')} />
          <StatCard label="Transactions" value={summary.transactionCount} accent="border-l-4 border-green-500" />
          <StatCard label="Avg Order Value" value={formatCurrency(summary.avgOrderValue)} accent="border-l-4 border-blue-500" valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('avgOrder')} onToggle={() => toggleCard('avgOrder')} />
          <StatCard label="Points Awarded" value={summary.pointsAwarded} accent="border-l-4 border-purple-500" />
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Cash Payments" value={formatCurrency(summary.cashSales)} valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('cash')} onToggle={() => toggleCard('cash')} />
          <StatCard label="MTN Mobile Money" value={formatCurrency(summary.mtnSales)} valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('mtn')} onToggle={() => toggleCard('mtn')} />
          <StatCard label="Airtel Money" value={formatCurrency(summary.airtelSales)} valueColor="text-gray-900 text-lg sm:text-xl" hidden={isHidden('airtel')} onToggle={() => toggleCard('airtel')} />
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <SearchInput
              value={searchQuery}
              onChange={v => { setSearchQuery(v); setPage(1); }}
              placeholder="Search by client name, phone, or receipt..."
              className="flex-1"
            />
            <div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {dateFilter === 'custom' && (
              <DateRangePicker
                from={customFromDate}
                to={customToDate}
                onFromChange={setCustomFromDate}
                onToChange={setCustomToDate}
              />
            )}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="mtn_mobile_money">MTN Money</option>
                <option value="airtel_money">Airtel Money</option>
              </select>
            </div>
            {(user?.role === 'owner' || user?.role === 'admin') && (
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'active' | 'voided')}
                  className="input"
                >
                  <option value="active">Active Sales</option>
                  <option value="voided">Voided Sales</option>
                </select>
              </div>
            )}
            <div>
              <button
                onClick={exportToCSV}
                disabled={visits.length === 0}
                className="btn-secondary px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Receipt</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Services</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Payment</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : visits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className={`cursor-pointer ${statusFilter === 'voided' ? 'opacity-60 bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'}`}
                      onClick={() => openTransactionModal(visit)}
                    >
                      <td className="py-4 px-4">
                        <span className={`font-mono text-sm ${statusFilter === 'voided' ? 'line-through text-gray-400' : ''}`}>{visit.receipt_number}</span>
                        {statusFilter === 'voided' && (
                          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Voided</span>
                        )}
                        {visit.edited_at && statusFilter !== 'voided' && (
                          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Edited</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {formatDateTime(visit.created_at)}
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{visit.client.name}</p>
                          <p className="text-sm text-gray-600">{visit.client.phone}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {visit.visit_services?.map((vs, idx) => {
                          const staffNames = (vs.worker_ids || [])
                            .map(id => workersMap[id])
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <div key={idx} className="leading-snug">
                              <span>{vs.quantity}x {vs.service?.name || 'Unknown'}</span>
                              {staffNames && (
                                <span className="block text-xs text-gray-400">· {staffNames}</span>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          visit.payment_method === 'cash' 
                            ? 'bg-green-100 text-green-800'
                            : visit.payment_method === 'mtn_mobile_money'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {visit.payment_method === 'mtn_mobile_money' ? 'MTN_MOBILE_MONEY' : visit.payment_method === 'airtel_money' ? 'AIRTEL_MONEY' : visit.payment_method.toUpperCase()}
                        </span>
                      </td>
                      <td className={`py-4 px-4 text-right font-semibold ${statusFilter === 'voided' ? 'text-red-400 line-through' : 'text-gray-900'}`}>
                        {formatCurrency(visit.amount_paid && Number(visit.amount_paid) > Number(visit.total_amount) ? visit.amount_paid : visit.total_amount)}
                      </td>
                      <td className="py-4 px-4 text-right text-brand-primary font-medium">
                        +{visit.points_earned}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {statusFilter === 'voided' ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (user?.role === 'owner' || user?.role === 'admin') ? (
                          <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                if (openMenuId === visit.id) {
                                  setOpenMenuId(null);
                                  setMenuPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  setOpenMenuId(visit.id);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200 px-4 pb-4">
              <p className="text-sm text-gray-600">
                Showing {rangeStart}-{rangeEnd} of {pagination.total} transactions
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>

                {getVisiblePages().map((pageNumber, index, arr) => {
                  const previous = index > 0 ? arr[index - 1] : null;
                  const shouldShowEllipsis = previous !== null && pageNumber - previous > 1;

                  return (
                    <span key={`sales-page-${pageNumber}`} className="flex items-center gap-2">
                      {shouldShowEllipsis && <span className="text-gray-400">...</span>}
                      <button
                        onClick={() => setPage(pageNumber)}
                        className={`w-9 h-9 text-sm rounded-lg border ${
                          pagination.page === pageNumber
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}

                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Three-dot dropdown — fixed so it's never clipped by overflow */}
      {openMenuId && menuPos && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpenMenuId(null); setMenuPos(null); }} />
          <div
            className="fixed z-40 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {(() => {
              const visit = visits.find(v => v.id === openMenuId);
              if (!visit) return null;
              const isSameDay = new Date(visit.created_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              return (
                <>
                  {isSameDay && (
                    <button
                      onClick={() => { setOpenMenuId(null); setMenuPos(null); router.push(`/pos?edit=${visit.id}`); }}
                      className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      Edit Sale
                    </button>
                  )}
                  <button
                    onClick={() => { setOpenMenuId(null); setMenuPos(null); openEditStaff(null, visit); }}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    Edit Staff
                  </button>
                  <button
                    onClick={() => { setOpenMenuId(null); setMenuPos(null); handleVoidTransaction(visit); }}
                    className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  >
                    Void Transaction
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {SecurityModal}

      {selectedTransaction && (
        <TransactionSummaryModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Edit Staff Assignment Modal */}
      {editVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Staff Assignment</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editVisit.receipt_number}</p>
              </div>
              <button onClick={() => setEditVisit(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {editLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
              ) : editServices.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No services found</div>
              ) : (
                editServices.map(svc => (
                  <div key={svc.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 text-sm">{svc.service_name}</p>
                      <p className="text-xs text-gray-500">{svc.quantity}× {formatCurrency(svc.unit_price)}</p>
                    </div>

                    {/* Staff tags */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-400 shrink-0">Staff:</span>
                      {svc.worker_ids.map(wid => {
                        const w = editWorkers.find(w => w.id === wid);
                        return w ? (
                          <span key={wid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full text-white" style={{ backgroundColor: salon?.theme_primary_color || '#6366f1' }}>
                            {w.name}
                            <button onClick={() => removeWorkerFromEditService(svc.id, wid)} className="ml-0.5 opacity-80 hover:opacity-100 leading-none">×</button>
                          </span>
                        ) : null;
                      })}
                      <button
                        onClick={() => { setEditWorkerOpen(editWorkerOpen === svc.id ? null : svc.id); setEditWorkerQuery(''); }}
                        className="text-xs text-gray-400 hover:text-brand-primary border border-dashed border-gray-300 hover:border-brand-primary rounded-full px-2 py-0.5 transition-colors"
                      >
                        + add
                      </button>
                      {svc.worker_ids.length > 1 && (
                        <span className="text-xs text-gray-400 ml-0.5">(split equally)</span>
                      )}
                    </div>

                    {/* Inline worker search */}
                    {editWorkerOpen === svc.id && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={editWorkerQuery}
                          onChange={e => setEditWorkerQuery(e.target.value)}
                          placeholder="Search staff..."
                          autoFocus
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 mb-1"
                        />
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {editWorkers
                            .filter(w =>
                              !svc.worker_ids.includes(w.id) &&
                              (editWorkerQuery.trim() === '' ||
                                w.name.toLowerCase().includes(editWorkerQuery.toLowerCase()) ||
                                w.job_title.toLowerCase().includes(editWorkerQuery.toLowerCase()))
                            )
                            .map(w => (
                              <button
                                key={w.id}
                                onClick={() => addWorkerToEditService(svc.id, w.id)}
                                className="w-full flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-white border border-transparent hover:border-gray-200 text-left"
                              >
                                <span>{w.name}</span>
                                <span className="text-gray-400">{w.job_title}</span>
                              </button>
                            ))
                          }
                          {editWorkers.filter(w => !svc.worker_ids.includes(w.id) && (editWorkerQuery.trim() === '' || w.name.toLowerCase().includes(editWorkerQuery.toLowerCase()))).length === 0 && (
                            <p className="text-xs text-gray-400 italic px-2 py-1">No more staff</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEditVisit(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={saveEditStaff}
                disabled={editSaving || editLoading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
