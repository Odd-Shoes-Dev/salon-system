'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader, SearchInput, StatCard, useHiddenCards, NumberInput } from '@/components/ui';
import { PageGroupTabs, SERVICE_TABS } from '@/components/PageGroupTabs';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useModalEsc } from '@/contexts/EscContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';

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
  const { salon } = useSalon();
  const { isHidden, toggle: toggleCard } = useHiddenCards('services_hidden_cards', ['avgPrice'] as const);
  const [services, setServices] = useState<Service[]>([]);
  const { run, isPending } = useAsyncAction();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  useModalEsc(showModal, () => setShowModal(false));
  const [categoryOptions, setCategoryOptions] = useState<ServiceCategoryOption[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => {
    const saved = localStorage.getItem('services_view_mode');
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  const setAndSaveViewMode = useCallback((mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('services_view_mode', mode);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setEditingService(null);
      setShowModal(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

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

  const toggleServiceStatus = (serviceId: string, currentStatus: boolean) => run(`toggle:${serviceId}`, async () => {
    const response = await fetch(`/api/services/${serviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentStatus }),
    });
    if (!response.ok) throw new Error('Failed to update service');
    toast.success(`Service ${currentStatus ? 'deactivated' : 'activated'}`);
    loadServices();
  });

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

  const printServices = useCallback(() => {
    const salonName = salon?.name || 'Salon';
    const brandColor = salon?.theme_primary_color || '#E31C23';
    const logoUrl = salon?.logo_url || '';
    const slogan = salon?.slogan || '';
    const printDate = new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });

    const initial = salonName.charAt(0).toUpperCase();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${salonName}" class="salon-logo" />`
      : `<div class="logo-placeholder" style="background:${brandColor}">${initial}</div>`;

    const listRows = Object.entries(groupedServices).map(([category, svcList]) => `
      <div class="category-section">
        <h2 class="category-title">${category}</h2>
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Service</th>
              <th style="text-align:right">Price</th>
              <th style="text-align:center">Duration</th>
              <th style="text-align:center">For</th>
            </tr>
          </thead>
          <tbody>
            ${svcList.map(s => `
              <tr>
                <td>
                  <strong>${s.name}</strong>
                  ${s.description ? `<br><span class="desc">${s.description}</span>` : ''}
                </td>
                <td style="text-align:right;font-weight:600">${formatCurrency(s.price)}</td>
                <td style="text-align:center">${s.duration_minutes} mins</td>
                <td style="text-align:center;text-transform:capitalize">${s.gender_target}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    const gridCards = Object.entries(groupedServices).map(([category, svcList]) => `
      <div class="category-section">
        <h2 class="category-title">${category}</h2>
        <div class="card-grid">
          ${svcList.map(s => `
            <div class="service-card-print">
              <div class="card-header">
                <h3>${s.name}</h3>
                <span class="gender-badge gender-${s.gender_target}">${s.gender_target}</span>
              </div>
              ${s.description ? `<p class="card-desc">${s.description}</p>` : ''}
              <div class="card-footer">
                <span class="price">${formatCurrency(s.price)}</span>
                <span class="duration">${s.duration_minutes} mins</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${salonName} — Services &amp; Pricing</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
  .header { text-align: center; margin-bottom: 28px; border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; }
  .salon-logo { max-height: 72px; max-width: 200px; object-fit: contain; margin-bottom: 10px; }
  .logo-placeholder { width: 64px; height: 64px; border-radius: 50%; color: #fff; font-size: 28px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; }
  .salon-name { font-size: 22px; font-weight: 700; color: ${brandColor}; }
  .salon-slogan { font-size: 12px; color: #6b7280; margin-top: 2px; font-style: italic; }
  .print-title { font-size: 15px; color: #374151; margin-top: 8px; font-weight: 600; }
  .print-date { font-size: 11px; color: #9ca3af; margin-top: 3px; }
  .category-section { margin-bottom: 28px; }
  .category-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${brandColor}; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 600; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  td { padding: 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .desc { font-size: 11px; color: #6b7280; }
  .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .service-card-print { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
  .card-header h3 { font-size: 14px; font-weight: 600; }
  .gender-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
  .gender-female { background: #fce7f3; color: #be185d; }
  .gender-male { background: #dbeafe; color: #1d4ed8; }
  .gender-unisex { background: #ede9fe; color: #6d28d9; }
  .card-desc { font-size: 11px; color: #6b7280; margin-bottom: 10px; }
  .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-top: 1px solid #f3f4f6; padding-top: 8px; }
  .price { font-size: 15px; font-weight: 700; color: ${brandColor}; }
  .duration { font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  ${logoHtml}
  <div class="salon-name">${salonName}</div>
  ${slogan ? `<div class="salon-slogan">${slogan}</div>` : ''}
  <div class="print-title">Services &amp; Pricing</div>
  <div class="print-date">As of ${printDate}</div>
</div>
${viewMode === 'grid' ? gridCards : listRows}
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups to print'); return; }
    win.document.write(html);
    win.document.close();
  }, [groupedServices, viewMode, salon, formatCurrency]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Services" />
      <PageGroupTabs tabs={SERVICE_TABS} />

      <div className="container mx-auto p-6">
        <PageHeader
          title="Services & Pricing"
          subtitle="Manage your service catalog"
          action={(
            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="inline-flex bg-gray-100 rounded-lg p-1">
                <button
                  title="List view"
                  onClick={() => setAndSaveViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  title="Grid view"
                  onClick={() => setAndSaveViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                </button>
              </div>
              {/* Print */}
              <button
                onClick={printServices}
                className="btn-secondary flex items-center gap-1.5"
                title="Print / Save as PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              {canManageServices && (
                <>
                  <Link href="/categories" className="btn-secondary">Manage Categories</Link>
                  <button onClick={() => { setEditingService(null); setShowModal(true); }} className="btn-primary">
                    + Add New Service
                  </button>
                </>
              )}
            </div>
          )}
        />

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search services..."
              className="md:col-span-2"
            />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Services" value={services.length} />
          <StatCard label="Active Services" value={services.filter(s => s.is_active).length} valueColor="text-green-600 text-2xl" />
          <StatCard label="Categories" value={Object.keys(groupedServices).length} />
          <StatCard
            label="Avg. Price"
            value={services.length > 0
              ? formatCurrency(services.reduce((sum, s) => sum + Number(s.price), 0) / services.length)
              : 'UGX 0'}
            valueColor="text-gray-900 text-xl"
            hidden={isHidden('avgPrice')}
            onToggle={() => toggleCard('avgPrice')}
          />
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
        ) : viewMode === 'grid' ? (
          /* ── Grid view ── */
          <div className="space-y-6">
            {Object.entries(groupedServices).map(([category, categoryServices]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {category}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryServices.map((service) => (
                    <div key={service.id} className="service-card flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{service.name}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                            GENDER_LABELS[service.gender_target]?.color || 'bg-gray-100 text-gray-700'
                          }`}>
                            {GENDER_LABELS[service.gender_target]?.label || 'Unisex'}
                          </span>
                        </div>
                        {service.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <span className="text-lg font-bold text-brand-primary">
                            {formatCurrency(service.price)}
                          </span>
                          <span className="text-sm text-gray-500">{service.duration_minutes} mins</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {service.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {canManageServices && (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => { setEditingService(service); setShowModal(true); }}
                                className="text-brand-primary hover:text-brand-primary/80 font-medium text-sm cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleServiceStatus(service.id, service.is_active)}
                                className="text-gray-500 hover:text-gray-800 font-medium text-sm cursor-pointer"
                              >
                                {service.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
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
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{service.name}</p>
                              {service.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2 max-w-xs">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(service.price)}
                          </td>
                          <td className="py-4 px-4 text-center text-gray-600 whitespace-nowrap">
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
              <NumberInput
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
              <NumberInput
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
