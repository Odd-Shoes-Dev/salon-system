'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'owner' | 'manager' | 'cashier';
  is_active: boolean;
  pin_hash?: string;
  last_login?: string;
  created_at: string;
}

interface StaffWithPerformance extends StaffMember {
  today_sales?: number;
  today_visits?: number;
  week_sales?: number;
  week_visits?: number;
}

export default function StaffPage() {
  const router = useRouter();
  const { user } = useUser();
  const [staff, setStaff] = useState<StaffWithPerformance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      if (response.ok) {
        const data = await response.json();
        setStaff(data);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        toast.error('Failed to load staff');
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
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
    return new Date(date).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffId,
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Staff member ${currentStatus ? 'deactivated' : 'activated'}`);
      loadStaff();
    } catch (error) {
      toast.error('Failed to update staff status');
    }
  };

  const resetPin = async (staffId: string) => {
    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffId,
          reset_pin: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to reset PIN');

      toast.success('PIN reset successfully. New PIN: 1234');
    } catch (error) {
      toast.error('Failed to reset PIN');
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery);
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const canManageStaff = user?.role === 'owner';

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Staff Management">
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
            <h1 className="text-2xl font-bold text-gray-900">Staff & Performance</h1>
            <p className="text-gray-600 mt-1">Manage team and track performance</p>
          </div>
          {canManageStaff && (
            <button
              onClick={() => {
                setEditingStaff(null);
                setShowModal(true);
              }}
              className="btn-primary"
            >
              + Add Staff Member
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Search staff by name or phone..."
              className="input-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="input-lg"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Staff</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{staff.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active Today</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {staff.filter((s) => s.today_visits && s.today_visits > 0).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Today's Sales</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(staff.reduce((sum, s) => sum + (s.today_sales || 0), 0))}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Week's Sales</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(staff.reduce((sum, s) => sum + (s.week_sales || 0), 0))}
            </p>
          </div>
        </div>

        {/* Staff Table */}
        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading staff...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-lg font-medium">No staff members found</p>
              <p className="text-sm mt-2">
                {staff.length === 0
                  ? 'Add your first staff member to get started'
                  : 'Try adjusting your filters'}
              </p>
            </div>
            {canManageStaff && staff.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add staff member
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Staff Member
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Today
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    This Week
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Last Login
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  {canManageStaff && (
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.phone}</p>
                        {member.email && (
                          <p className="text-xs text-gray-400 mt-1">{member.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          member.role === 'owner'
                            ? 'bg-purple-100 text-purple-700'
                            : member.role === 'manager'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(member.today_sales || 0)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.today_visits || 0} visits
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(member.week_sales || 0)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {member.week_visits || 0} visits
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600">
                      {member.last_login ? formatDate(member.last_login) : 'Never'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          member.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManageStaff && (
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingStaff(member);
                              setShowModal(true);
                            }}
                            className="text-brand-primary hover:text-brand-primary/80 font-medium text-sm"
                          >
                            Edit
                          </button>
                          {member.role === 'cashier' && (
                            <button
                              onClick={() => resetPin(member.id)}
                              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                            >
                              Reset PIN
                            </button>
                          )}
                          <button
                            onClick={() => toggleStaffStatus(member.id, member.is_active)}
                            className="text-gray-600 hover:text-gray-900 font-medium text-sm"
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Notice - Removed since API is now available */}
      </div>

      {/* Add/Edit Modal */}
      {showModal && canManageStaff && (
        <StaffModal
          staff={editingStaff}
          onClose={() => {
            setShowModal(false);
            setEditingStaff(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingStaff(null);
            loadStaff();
          }}
        />
      )}
    </div>
  );
}

// Staff Modal Component
function StaffModal({
  staff,
  onClose,
  onSuccess,
}: {
  staff: StaffMember | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(staff?.name || '');
  const [phone, setPhone] = useState(staff?.phone || '');
  const [email, setEmail] = useState(staff?.email || '');
  const [role, setRole] = useState<'owner' | 'manager' | 'cashier'>(staff?.role || 'cashier');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name || !phone || !role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!staff && !pin) {
      toast.error('PIN is required for new staff');
      return;
    }

    if (!staff && pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/staff', {
        method: staff ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          staff
            ? { id: staff.id, name, phone, email, role }
            : { name, phone, email, role, pin, password }
        ),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save staff');
      }

      toast.success(
        staff ? 'Staff updated successfully' : 'Staff member added successfully'
      );
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {staff ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
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
              placeholder="+256700000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {role === 'owner'
                ? 'Full access to all features'
                : role === 'manager'
                ? 'Can manage services, clients, and view reports'
                : 'Can process transactions and view limited data'}
            </p>
          </div>

          {!staff && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  4-Digit PIN *
                </label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required={!staff}
                  maxLength={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-2xl tracking-widest text-center"
                  placeholder="••••"
                />
                <p className="text-xs text-gray-500 mt-1">For quick login on POS</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional password for admin access"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional - for accessing dashboard and reports
                </p>
              </div>
            </>
          )}

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
              className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : staff ? 'Update Staff' : 'Create Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
