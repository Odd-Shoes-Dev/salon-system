'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { TransactionSummaryModal, TransactionSummaryData } from '@/components/TransactionSummaryModal';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
}

interface Service {
  id: string;
  name: string;
  category: string;
  gender_target: 'male' | 'female' | 'unisex';
  price: number;
  duration_minutes: number;
  points_earned: number;
}

interface CartItem {
  service: Service;
  quantity: number;
}

export default function POSPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [clientSearching, setClientSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [workersList, setWorkersList] = useState<{ id: string; name: string; job_title: string }[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [workerSearch, setWorkerSearch] = useState<string>('');
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<TransactionSummaryData | null>(null);
  const [pendingRating, setPendingRating] = useState<{ visitId: string; workerId: string; workerName: string; clientId: string } | null>(null);

  // Load services, categories and workers on mount
  useEffect(() => {
    // Show cached data instantly while fresh data loads in background
    const cachedServices = localStorage.getItem('pos_services');
    const cachedCategories = localStorage.getItem('pos_categories');
    if (cachedServices) { setServices(JSON.parse(cachedServices)); setServicesLoading(false); }
    if (cachedCategories) setCategories(JSON.parse(cachedCategories));
    // Always fetch fresh in background
    Promise.all([loadServices(), loadCategories(), loadWorkers()]);
  }, []);

  const loadWorkers = async () => {
    try {
      const res = await fetch('/api/workers');
      if (res.ok) {
        const data = await res.json();
        setWorkersList(data || []);
      }
    } catch {}
  };

  // Debounced client search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.length >= 2) {
      setClientSearching(true);
      searchDebounceRef.current = setTimeout(() => {
        searchClients();
      }, 300);
    } else {
      setClients([]);
      setClientSearching(false);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services');
      if (response.ok) {
        const data = await response.json();
        setServices(data);
        localStorage.setItem('pos_services', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setServicesLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
        localStorage.setItem('pos_categories', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const searchClients = async () => {
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setClientSearching(false);
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchQuery('');
    setClients([]);
    setClientSearching(false);
  };

  const addToCart = (service: Service) => {
    const existingItem = cart.find(item => item.service.id === service.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.service.id === service.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { service, quantity: 1 }]);
    }
    
    toast.success(`${service.name} added to cart`);
  };

  const removeFromCart = (serviceId: string) => {
    setCart(cart.filter(item => item.service.id !== serviceId));
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(serviceId);
    } else {
      setCart(cart.map(item =>
        item.service.id === serviceId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);
  };

  const calculatePoints = () => {
    if (!salon) return 0;
    const total = calculateTotal();
    // Calculate points based on salon's loyalty_points_per_ugx (e.g., 10 points per 1000 UGX)
    return Math.floor(total / 1000) * (salon.loyalty_points_per_ugx || 10);
  };

  const processPayment = async (paymentMethod: string) => {
    if (!selectedClient) {
      toast.error('Please select a client first');
      return;
    }

    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setProcessingPayment(true);

    const totalAmount = calculateTotal();
    const pointsEarned = calculatePoints();
    const purchasedServices = cart.map((item) => ({
      name: item.service.name,
      quantity: item.quantity,
      unitPrice: item.service.price,
    }));

    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          services: cart.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
          })),
          payment_method: paymentMethod,
          send_receipt: false,
          worker_id: selectedWorker || null,
          transaction_date: transactionDate !== new Date().toISOString().split('T')[0] ? transactionDate : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      const result = await response.json();

      toast.success(`Payment successful! Receipt: ${result.receipt_number}`);

      // Trigger rating flow if a worker was selected
      if (selectedWorker && selectedClient) {
        const workerMember = workersList.find(w => w.id === selectedWorker);
        setPendingRating({
          visitId: result.id,
          workerId: selectedWorker,
          workerName: workerMember?.name || 'Staff',
          clientId: selectedClient.id,
        });
      }

      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        services: purchasedServices,
        total: totalAmount,
        pointsEarned,
        paymentMethod,
        workerName: workersList.find(w => w.id === selectedWorker)?.name,
        date: result.created_at,
      });
      
      // Update client points in UI
      if (selectedClient) {
        setSelectedClient({
          ...selectedClient,
          loyalty_points: selectedClient.loyalty_points + pointsEarned,
        });
      }

      // Clear cart and reset worker
      setCart([]);
      setSelectedWorker('');
      setWorkerSearch('');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredByCategory = services
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory)
    .filter((s) =>
      selectedGender === 'all' ||
      s.gender_target === selectedGender ||
      s.gender_target === 'unisex'
    );

  const groupedServices = filteredByCategory.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="POS System">
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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Services Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Search */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Select Client</h2>
              <div className="relative">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    className="w-full pl-10 pr-9 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent min-h-[48px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {clientSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 6 12 6z" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                    </div>
                  )}
                  {searchQuery && !clientSearching && (
                    <button
                      onClick={() => { setSearchQuery(''); setClients([]); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {(clients.length > 0 || (searchQuery.length >= 2 && !clientSearching)) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {clients.length > 0 ? clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => selectClient(client)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            <p className="text-sm text-gray-500">{client.phone}</p>
                          </div>
                          <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                            {client.loyalty_points} pts
                          </span>
                        </div>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">No clients found for "{searchQuery}"</div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowNewClientModal(true)}
                className="mt-3 text-sm text-brand-primary hover:underline"
              >
                + New Client
              </button>

              {selectedClient && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedClient.name}
                      </p>
                      <p className="text-sm text-gray-600">{selectedClient.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Loyalty Points</p>
                      <p className="text-2xl font-bold text-brand-primary">
                        {selectedClient.loyalty_points || 0}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="mt-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Change Client
                  </button>
                </div>
              )}
            </div>

            {/* Services Grid by Category */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Select Services</h2>
                <button
                  onClick={() => setShowNewServiceModal(true)}
                  className="text-sm text-brand-primary hover:underline"
                >
                  + New Service
                </button>
              </div>

              {/* Gender Filter — All shows everything, Female/Male also shows Unisex services */}
              <div className="flex gap-2 mb-3">
                {([
                  { value: 'all',    label: 'All',    active: 'bg-gray-800 text-white' },
                  { value: 'female', label: 'Female', active: 'bg-pink-500 text-white' },
                  { value: 'male',   label: 'Male',   active: 'bg-blue-500 text-white' },
                ] as const).map(({ value, label, active }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedGender(value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedGender === value ? active : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Category Filter Tabs */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat.name
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={
                        selectedCategory === cat.name
                          ? { backgroundColor: cat.color }
                          : {}
                      }
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
              
              {servicesLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="grid md:grid-cols-2 gap-4">
                      <div className="h-20 bg-gray-100 rounded-xl" />
                      <div className="h-20 bg-gray-100 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : filteredByCategory.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No services available</p>
                  <p className="text-sm mt-2">Add services in Settings</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                        {category}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {categoryServices.map((service) => (
                          <div key={service.id} className="service-card">
                            <div>
                              <h4 className="font-semibold text-gray-900">{service.name}</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                {service.duration_minutes} mins • +{service.points_earned} pts
                              </p>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-lg font-bold text-brand-primary">
                                {formatCurrency(service.price)}
                              </span>
                              <button
                                onClick={() => addToCart(service)}
                                className="btn-primary text-sm"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart & Checkout */}
          <div className="space-y-6">
            <div className="card sticky top-6">
              <h2 className="text-lg font-semibold mb-4">Cart</h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No services selected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.service.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.service.name}</p>
                        <p className="text-sm text-gray-600">
                          {formatCurrency(item.service.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.service.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.service.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.service.id)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(calculateTotal())}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Points to Earn</span>
                  <span className="font-semibold text-brand-primary">+{calculatePoints()}</span>
                </div>
                <div className="flex items-center justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-brand-primary">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>

              {/* Served By — searchable autocomplete */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-xs font-medium text-gray-500 mb-1">Served By</label>
                <div className="relative">
                  <input
                    type="text"
                    value={workerSearch}
                    onChange={(e) => {
                      setWorkerSearch(e.target.value);
                      setSelectedWorker('');
                      setWorkerDropdownOpen(true);
                    }}
                    onFocus={() => setWorkerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setWorkerDropdownOpen(false), 150)}
                    placeholder="Search worker..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                  />
                  {selectedWorker && (
                    <button
                      onClick={() => { setSelectedWorker(''); setWorkerSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {workerDropdownOpen && (
                    <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {workersList
                        .filter((w) =>
                          workerSearch.trim() === '' ||
                          w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                          w.job_title.toLowerCase().includes(workerSearch.toLowerCase())
                        )
                        .map((w) => (
                          <li
                            key={w.id}
                            onMouseDown={() => {
                              setSelectedWorker(w.id);
                              setWorkerSearch(w.name);
                              setWorkerDropdownOpen(false);
                            }}
                            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                          >
                            <span className="font-medium text-gray-900">{w.name}</span>
                            <span className="text-xs text-gray-400 ml-2">{w.job_title}</span>
                          </li>
                        ))}
                      {workersList.filter((w) =>
                        workerSearch.trim() === '' ||
                        w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                        w.job_title.toLowerCase().includes(workerSearch.toLowerCase())
                      ).length === 0 && (
                        <li className="px-3 py-2 text-sm text-gray-400 italic">No workers found</li>
                      )}
                    </ul>
                  )}
                </div>
                {selectedWorker && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {workersList.find(w => w.id === selectedWorker)?.name} selected
                  </p>
                )}
              </div>

              {/* Backdate picker — owner/admin only */}
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={transactionDate}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {transactionDate !== new Date().toISOString().split('T')[0] && (
                    <p className="text-xs text-amber-600 mt-1">⚠ Backdating to {transactionDate}</p>
                  )}
                </div>
              )}

              {/* Payment Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => processPayment('mtn_mobile_money')}
                  disabled={!selectedClient || cart.length === 0 || processingPayment}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingPayment ? 'Processing...' : 'Pay with MTN Mobile Money'}
                </button>
                <button
                  onClick={() => processPayment('airtel_money')}
                  disabled={!selectedClient || cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pay with Airtel Money
                </button>
                <button
                  onClick={() => processPayment('cash')}
                  disabled={!selectedClient || cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cash Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Client Modal */}
      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onClientCreated={(client) => {
            setSelectedClient(client);
            setShowNewClientModal(false);
            toast.success('Client created successfully');
          }}
        />
      )}

      {/* New Service Modal */}
      {showNewServiceModal && (
        <NewServiceModal
          onClose={() => setShowNewServiceModal(false)}
          onServiceCreated={() => {
            setShowNewServiceModal(false);
            loadServices();
            toast.success('Service created successfully');
          }}
        />
      )}

      {/* Rating Modal — shown after payment */}
      {pendingRating && (
        <StaffRatingModal
          visitId={pendingRating.visitId}
          workerId={pendingRating.workerId}
          workerName={pendingRating.workerName}
          clientId={pendingRating.clientId}
          onDone={() => setPendingRating(null)}
        />
      )}

      {/* Transaction Summary Modal */}
      {!pendingRating && completedTransaction && (
        <TransactionSummaryModal
          transaction={completedTransaction}
          onClose={() => setCompletedTransaction(null)}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

// New Client Modal Component
function NewClientModal({
  onClose,
  onClientCreated,
}: {
  onClose: () => void;
  onClientCreated: (client: Client) => void;
}) {
  const { salon } = useSalon();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email: email || undefined, birthday: birthday || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create client');
      }

      const client = await response.json();
      onClientCreated(client);
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Add New Client</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto p-6 space-y-4">
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
              Email (Optional)
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
              Birthday (Optional)
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Service Modal Component
function NewServiceModal({
  onClose,
  onServiceCreated,
}: {
  onClose: () => void;
  onServiceCreated: () => void;
}) {
  const { salon } = useSalon();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [genderTarget, setGenderTarget] = useState<'male' | 'female' | 'unisex'>('unisex');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => {
        setCategoryOptions(data);
        if (data.length > 0) setCategory(data[0].name);
      })
      .catch(() => {});
  }, []);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          price: parseFloat(price),
          duration_minutes: parseInt(durationMinutes),
          category,
          gender_target: genderTarget,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create service');
      }

      onServiceCreated();
    } catch (error: any) {
      toast.error(error.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Add New Service</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto p-6 space-y-4">
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
              placeholder="e.g., Manicure"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (UGX) *
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="25000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
          </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Staff Rating Modal — shown after payment to collect client feedback
function StaffRatingModal({
  visitId,
  workerId,
  workerName,
  clientId,
  onDone,
}: {
  visitId: string;
  workerId: string;
  workerName: string;
  clientId: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_id: visitId, worker_id: workerId, client_id: clientId, rating, comment }),
      });
    } catch {}
    onDone();
  };

  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">⭐</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Rate Your Experience</h3>
          <p className="text-sm text-gray-500 mt-1">
            How was your service with <span className="font-medium text-gray-700">{workerName}</span>?
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110 focus:outline-none"
            >
              <span className={(hovered || rating) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-medium text-gray-600 mb-3">{labels[rating]}</p>
        )}

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)..."
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 px-4 py-2 text-sm text-white bg-yellow-400 rounded-lg hover:bg-yellow-500 disabled:opacity-50 font-medium"
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

