'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface Visit {
  id: string;
  receipt_number: string;
  total_amount: number;
  payment_method: string;
  points_earned: number;
  created_at: string;
  client: {
    name: string;
    phone: string;
  };
  visit_services: Array<{
    quantity: number;
    unit_price: number;
    service: {
      name: string;
    };
  }>;
}

export default function SalesPage() {
  const { user } = useUser();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('today');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadVisits();
  }, [dateFilter]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/visits?date=${dateFilter}`);
      if (response.ok) {
        const data = await response.json();
        setVisits(data);
      }
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVisits = visits.filter((visit) => {
    const matchesPayment = paymentFilter === 'all' || visit.payment_method === paymentFilter;
    const matchesSearch = 
      visit.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.receipt_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.client.phone.includes(searchQuery);
    return matchesPayment && matchesSearch;
  });

  const totalSales = filteredVisits.reduce((sum, v) => sum + v.total_amount, 0);
  const transactionCount = filteredVisits.length;
  const avgOrderValue = transactionCount > 0 ? totalSales / transactionCount : 0;

  const cashSales = filteredVisits.filter(v => v.payment_method === 'cash').reduce((sum, v) => sum + v.total_amount, 0);
  const mtnSales = filteredVisits.filter(v => v.payment_method === 'mtn_mobile_money').reduce((sum, v) => sum + v.total_amount, 0);
  const airtelSales = filteredVisits.filter(v => v.payment_method === 'airtel_money').reduce((sum, v) => sum + v.total_amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Sales & Transactions">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            Dashboard
          </Link>
          <Link href="/pos" className="btn-primary text-sm px-3 py-2">
            New Sale
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-4 md:p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-600 mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{transactionCount}</p>
          </div>
          <div className="card border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgOrderValue)}</p>
          </div>
          <div className="card border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">Points Awarded</p>
            <p className="text-2xl font-bold text-gray-900">
              {filteredVisits.reduce((sum, v) => sum + v.points_earned, 0)}
            </p>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Cash Payments</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(cashSales)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">MTN Mobile Money</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(mtnSales)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Airtel Money</p>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(airtelSales)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by client name, phone, or receipt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full"
              />
            </div>
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
              </select>
            </div>
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
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm">{visit.receipt_number}</span>
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
                        {visit.visit_services?.map((vs, idx) => (
                          <div key={idx}>
                            {vs.quantity}x {vs.service?.name || 'Unknown'}
                          </div>
                        ))}
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
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(visit.total_amount)}
                      </td>
                      <td className="py-4 px-4 text-right text-brand-primary font-medium">
                        +{visit.points_earned}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
