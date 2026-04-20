'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';

interface Service {
  id: string;
  name: string;
  category: string;
  gender_target: 'male' | 'female' | 'unisex';
  price: number;
  duration_minutes: number;
  description?: string;
  points_earned: number;
  is_active: boolean;
  created_at: string;
}

const GENDER_LABELS: Record<string, { label: string; color: string }> = {
  male:   { label: 'Male',   color: 'bg-blue-100 text-blue-700' },
  female: { label: 'Female', color: 'bg-pink-100 text-pink-700' },
  unisex: { label: 'Unisex', color: 'bg-purple-100 text-purple-700' },
};

interface ServiceCategoryOption {
  id: string;
  name: string;
  color: string;
}

export default function ServicesPage() {
  const router = useRouter();
  const { user } = useUser();
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<ServiceCategoryOption[]>([]);

  useEffect(() => {
    loadServices();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategoryOptions(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services?showAll=true');
      if (response.ok) {
        const data = await response.json();
        setServices(data);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const toggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update service');
      }

      toast.success(`Service ${currentStatus ? 'deactivated' : 'activated'}`);
      loadServices();
    } catch (error) {
      toast.error('Failed to update service status');
    }
  };

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === 'all' || service.category === categoryFilter;
    const matchesGender =
      genderFilter === 'all' ||
      service.gender_target === genderFilter ||
      service.gender_target === 'unisex';
    return matchesSearch && matchesCategory && matchesGender;
  });

  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const canManageServices = user?.role === 'owner' || user?.role === 'manager';

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Service Management">
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
          </div>
          <Link href="/dashboard" className="btn-secondary">
            Dashboard
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Services & Pricing</h1>
            <p className="text-gray-600 mt-1">Manage your service catalog</p>
          </div>
          {canManageServices && (
            <div className="flex gap-2">
              <Link href="/categories" className="btn-secondary">
                Manage Categories
              </Link>
              <button
                onClick={() => {
                  setEditingService(null);
                  setShowModal(true);
                }}
                className="btn-primary"
              >
                + Add New Service
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search services..."
                className="input-lg w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="input-lg"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              className="input-lg"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">All Genders</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div className="card">
            <p className="text-sm text-gray-600">Total Services</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{services.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Active Services</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {services.filter((s) => s.is_active).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Categories</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {Object.keys(groupedServices).length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600">Avg. Price</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {services.length > 0
                ? formatCurrency(
                    services.reduce((sum, s) => sum + s.price, 0) / services.length
                  )
                : 'UGX 0'}
            </p>
          </div>
        </div>

        {/* Services by Category */}
        {loading ? (
          <div className="card text-center py-12 text-gray-400">Loading services...</div>
        ) : filteredServices.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p>No services found</p>
            {canManageServices && (
              <button
                onClick={() => setShowModal(true)}
                className="text-brand-primary hover:underline mt-2"
              >
                Add your first service
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedServices).map(([category, categoryServices]) => (
              <div key={category} className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase">
                  {category}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                          Service
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                          Price
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                          Duration
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                          Gender
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                          Points
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                          Status
                        </th>
                        {canManageServices && (
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {categoryServices.map((service) => (
                        <tr
                          key={service.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{service.name}</p>
                              {service.description && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-gray-900">
                            {formatCurrency(service.price)}
                          </td>
                          <td className="py-4 px-4 text-center text-gray-600">
                            {service.duration_minutes} mins
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              GENDER_LABELS[service.gender_target]?.color || 'bg-gray-100 text-gray-700'
                            }`}>
                              {GENDER_LABELS[service.gender_target]?.label || 'Unisex'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                              Auto
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                service.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {service.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {canManageServices && (
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => {
                                    setEditingService(service);
                                    setShowModal(true);
                                  }}
                                  className="text-brand-primary hover:text-brand-primary/80 font-medium text-sm cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    toggleServiceStatus(service.id, service.is_active)
                                  }
                                  className="text-gray-600 hover:text-gray-900 font-medium text-sm cursor-pointer"
                                >
                                  {service.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && canManageServices && (
        <ServiceModal
          service={editingService}
          categoryOptions={categoryOptions}
          onClose={() => {
            setShowModal(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingService(null);
            loadServices();
          }}
        />
      )}
    </div>
  );
}

// Service Modal Component
function ServiceModal({
  service,
  categoryOptions,
  onClose,
  onSuccess,
}: {
  service: Service | null;
  categoryOptions: ServiceCategoryOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { salon } = useSalon();
  const [name, setName] = useState(service?.name || '');
  const [category, setCategory] = useState(service?.category || '');
  const [genderTarget, setGenderTarget] = useState<'male' | 'female' | 'unisex'>(service?.gender_target || 'unisex');
  const [price, setPrice] = useState(service?.price || 0);
  const [duration, setDuration] = useState(service?.duration_minutes || 30);
  const [description, setDescription] = useState(service?.description || '');
  const [points, setPoints] = useState(service?.points_earned || 10);
  const [submitting, setSubmitting] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = service ? `/api/services/${service.id}` : '/api/services';
      const method = service ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          gender_target: genderTarget,
          price,
          duration_minutes: duration,
          description: description || undefined,
          points_earned: points,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save service');
      }

      toast.success(
        service ? 'Service updated successfully' : 'Service created successfully'
      );
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {service ? 'Edit Service' : 'Add New Service'}
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
              Service Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Premium Haircut"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categoryOptions.length > 0 ? (
                  categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <option value="Other">Other</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                For
              </label>
              <select
                value={genderTarget}
                onChange={(e) => setGenderTarget(e.target.value as 'male' | 'female' | 'unisex')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="unisex">Unisex</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (UGX) *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                required
                min="0"
                step="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (mins) *
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
                min="5"
                step="5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the service..."
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
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
