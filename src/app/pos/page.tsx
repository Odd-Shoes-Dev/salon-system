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
  loyalty_points: number;
}

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
  points_earned: number;
}

interface CartItem {
  service: Service;
  quantity: number;
}

interface CompletedTransaction {
  receiptNumber: string;
  clientName: string;
  clientPhone: string;
  services: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  pointsEarned: number;
  paymentMethod: string;
}

export default function POSPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<CompletedTransaction | null>(null);

  // Load services on mount
  useEffect(() => {
    loadServices();
  }, []);

  // Search clients
  useEffect(() => {
    if (searchQuery.length >= 3) {
      searchClients();
    } else {
      setClients([]);
    }
  }, [searchQuery]);

  const loadServices = async () => {
    try {
      const response = await fetch('/api/services');
      if (response.ok) {
        const data = await response.json();
        setServices(data);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
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
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchQuery('');
    setClients([]);
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
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      const result = await response.json();

      toast.success(`Payment successful! Receipt: ${result.receipt_number}`);

      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        services: purchasedServices,
        total: totalAmount,
        pointsEarned,
        paymentMethod,
      });
      
      // Update client points in UI
      if (selectedClient) {
        setSelectedClient({
          ...selectedClient,
          loyalty_points: selectedClient.loyalty_points + pointsEarned,
        });
      }

      // Clear cart
      setCart([]);
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
    } finally {
      setProcessingPayment(false);
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

  const groupedServices = services.reduce((acc, service) => {
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
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Services Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Search */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Select Client</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by phone number or name..."
                  className="input-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                {/* Search Results Dropdown */}
                {clients.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => selectClient(client)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-600">{client.phone}</p>
                        <p className="text-xs text-brand-primary mt-1">
                          {client.loyalty_points} points
                        </p>
                      </button>
                    ))}
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
              
              {services.length === 0 ? (
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

      {/* Transaction Summary Modal */}
      {completedTransaction && (
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
  const [submitting, setSubmitting] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email: email || undefined }),
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
  const [category, setCategory] = useState('Nails');
  const [submitting, setSubmitting] = useState(false);

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Nails">Nails</option>
              <option value="Hair">Hair</option>
              <option value="Spa">Spa</option>
              <option value="Massage">Massage</option>
              <option value="Other">Other</option>
            </select>
          </div>          </div>

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

function TransactionSummaryModal({
  transaction,
  onClose,
  formatCurrency,
}: {
  transaction: CompletedTransaction;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const { salon } = useSalon();
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const formatPaymentMethod = (paymentMethod: string) => {
    if (paymentMethod === 'mtn_mobile_money') return 'MTN Mobile Money';
    if (paymentMethod === 'airtel_money') return 'Airtel Money';
    if (paymentMethod === 'cash') return 'Cash';
    return paymentMethod;
  };

  const handleNotifyCustomer = async () => {
    if (!transaction.clientPhone) {
      toast.error('Customer phone number is missing');
      return;
    }

    setNotifying(true);

    const servicesText = transaction.services
      .map((service) => `${service.name} x${service.quantity}`)
      .join(', ');

    const fallbackText = `Thank you ${transaction.clientName} for visiting ${salon?.name || 'our salon'}. Receipt: ${transaction.receiptNumber}. Services: ${servicesText}. Total: ${formatCurrency(transaction.total)}. Points earned: ${transaction.pointsEarned}.`;

    const renderTemplate = (template: string) => {
      const map: Record<string, string> = {
        salonName: salon?.name || 'Salon',
        clientName: transaction.clientName,
        services: servicesText,
        total: transaction.total.toLocaleString(),
        pointsEarned: String(transaction.pointsEarned),
        totalPoints: '-',
        receiptNumber: transaction.receiptNumber,
        paymentMethod: formatPaymentMethod(transaction.paymentMethod),
      };

      return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key: string) => map[key] ?? '');
    };

    try {
      let text = fallbackText;

      const templateResponse = await fetch('/api/sms/template');
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        if (templateData?.template) {
          text = renderTemplate(templateData.template);
        }
      }

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: transaction.clientPhone,
          text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      setNotified(true);
      toast.success('Customer notified successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send SMS');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Transaction Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Customer Name</p>
              <p className="font-semibold text-gray-900">{transaction.clientName}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Phone Number</p>
              <p className="font-semibold text-gray-900">{transaction.clientPhone}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Receipt Number</p>
              <p className="font-semibold text-gray-900">{transaction.receiptNumber}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Payment Method</p>
              <p className="font-semibold text-gray-900">{formatPaymentMethod(transaction.paymentMethod)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Services Provided</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {transaction.services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-600">Qty: {service.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(service.unitPrice * service.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="font-medium text-gray-700">Points Earned</p>
            <p className="text-lg font-bold text-brand-primary">+{transaction.pointsEarned}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-lg font-semibold text-gray-900">Total</p>
            <p className="text-2xl font-bold text-brand-primary">{formatCurrency(transaction.total)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={handleNotifyCustomer}
            disabled={notifying || notified}
            className="px-5 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {notifying ? 'Sending...' : notified ? 'Customer Notified' : 'Notify Customer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white bg-gray-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
