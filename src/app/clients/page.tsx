'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  loyalty_points: number;
  total_spent: number;
  total_visits: number;
  created_at: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({
    totalClients: 0,
    totalSpent: 0,
    totalVisits: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(page, searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [page, searchQuery]);

  const loadClients = async (currentPage = page, query = searchQuery) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        paginated: 'true',
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      if (query.trim()) {
        params.set('search', query.trim());
      }

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        setClients(payload.data || []);
        setPagination(payload.pagination || {
          page: currentPage,
          pageSize,
          total: 0,
          totalPages: 1,
        });
        setSummary(payload.summary || {
          totalClients: 0,
          totalSpent: 0,
          totalVisits: 0,
        });
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load clients');
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Client Management">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Logout
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">Manage your client database</p>
          </div>
          <button
            onClick={() => {
              setEditingClient(null);
              setShowModal(true);
            }}
            className="btn-primary"
          >
            + Add New Client
          </button>
        </div>

        {/* Search */}
        <div className="card mb-6">
          <input
            type="text"
            placeholder="Search by name or phone number..."
            className="input-lg"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalClients}</p>
              </div>
              <div className="w-12 h-12 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Lifetime Value</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summary.totalSpent)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Visits</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.totalVisits}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="card">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No clients found</p>
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add your first client
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Contact</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Visits</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Joined</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-brand-primary font-semibold">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            {client.birthday && (
                              <p className="text-xs text-gray-500">🎂 {formatDate(client.birthday)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-900">{client.phone}</p>
                        {client.email && (
                          <p className="text-xs text-gray-500">{client.email}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-primary/10 text-brand-primary">
                          {client.loyalty_points || 0} pts
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(client.total_spent || 0)}
                      </td>
                      <td className="py-4 px-4 text-center text-gray-600">
                        {client.total_visits || 0}
                      </td>
                      <td className="py-4 px-4 text-right text-sm text-gray-600">
                        {formatDate(client.created_at)}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditingClient(client);
                            setShowModal(true);
                          }}
                          className="text-brand-primary hover:text-brand-primary/80 font-medium text-sm cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {rangeStart}-{rangeEnd} of {pagination.total} clients
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <ClientModal
          client={editingClient}
          salon={salon}
          onClose={() => {
            setShowModal(false);
            setEditingClient(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingClient(null);
            loadClients(page, searchQuery);
          }}
        />
      )}
    </div>
  );
}

// Client Modal Component
function ClientModal({
  client,
  salon,
  onClose,
  onSuccess,
}: {
  client: Client | null;
  salon: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [email, setEmail] = useState(client?.email || '');
  const [birthday, setBirthday] = useState(client?.birthday || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          birthday: birthday || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save client');
      }

      toast.success(client ? 'Client updated successfully' : 'Client created successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {client ? 'Edit Client' : 'Add New Client'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+256 700 000 000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Birthday
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: salon?.theme_primary_color || '#E31C23' }}
            >
              {submitting ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
