'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { NumberInput } from '@/components/ui';
import { TransactionSummaryModal, TransactionSummaryData } from '@/components/TransactionSummaryModal';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { NewClientModal } from '@/components/NewClientModal';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

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
  customPrice?: number;
  workerIds: string[];
}

interface Addon {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
}

interface CartAddon {
  addon: Addon;
  quantity: number;
  customPrice?: number;
  serviceIndex?: number; // index into cart — which service this add-on belongs to
}

export default function POSPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { salon } = useSalon();
  const editVisitId = searchParams.get('edit');
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);
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
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [workerSearch, setWorkerSearch] = useState<string>('');
  const [serviceWorkerOpen, setServiceWorkerOpen] = useState<number | null>(null);
  const [serviceWorkerQuery, setServiceWorkerQuery] = useState('');
  const [serviceAddonOpen, setServiceAddonOpen] = useState<number | null>(null);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<TransactionSummaryData | null>(null);
  const [pendingRating, setPendingRating] = useState<{ visitId: string; clientId: string; workers: { id: string; name: string }[] } | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const [cartAddons, setCartAddons] = useState<CartAddon[]>([]);
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [quickAddonModal, setQuickAddonModal] = useState(false);
  const [quickAddonForm, setQuickAddonForm] = useState({ name: '', price: '' });
  const [savingQuickAddon, setSavingQuickAddon] = useState(false);
  const [quickWorkerModal, setQuickWorkerModal] = useState(false);
  const [quickWorkerForm, setQuickWorkerForm] = useState({ name: '', job_title: 'Stylist' });
  const [savingQuickWorker, setSavingQuickWorker] = useState(false);

  // Payment breakdown state
  const [checkoutDiscount, setCheckoutDiscount] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; remaining_value: number; group_name: string | null; note: string | null; issued_to: string | null } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Record balance payment modal state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceSearch, setBalanceSearch] = useState('');
  interface BalanceVisit { id: string; receipt_number: string; total_amount: number; amount_paid: number; checkout_discount: number; balance_due: number; created_at: string; }
  interface BalanceClient { id: string; name: string; phone: string; total_balance: number; outstanding_visits: BalanceVisit[]; }
  const [balanceClients, setBalanceClients] = useState<BalanceClient[]>([]);
  const [balanceSearching, setBalanceSearching] = useState(false);
  const [selectedBalanceClient, setSelectedBalanceClient] = useState<BalanceClient | null>(null);
  const [selectedBalanceVisit, setSelectedBalanceVisit] = useState<BalanceVisit | null>(null);
  const [balancePaymentAmount, setBalancePaymentAmount] = useState<string>('');
  const [balancePaymentMethod, setBalancePaymentMethod] = useState<string>('cash');
  const [processingBalance, setProcessingBalance] = useState(false);
  const balanceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load services, categories and workers on mount
  useEffect(() => {
    // Show cached data instantly while fresh data loads in background
    const cachedServices = localStorage.getItem('pos_services');
    const cachedCategories = localStorage.getItem('pos_categories');
    if (cachedServices) { setServices(JSON.parse(cachedServices)); setServicesLoading(false); }
    if (cachedCategories) setCategories(JSON.parse(cachedCategories));
    // Always fetch fresh in background
    Promise.all([loadServices(), loadCategories(), loadWorkers(), loadAddons()]);
  }, []);

  // Load visit data when in edit mode
  useEffect(() => {
    if (!editVisitId || editLoaded || services.length === 0 || availableAddons === undefined) return;
    (async () => {
      try {
        const res = await fetch(`/api/visits/${editVisitId}`);
        if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Visit not found'); router.push('/sales'); return; }
        const data = await res.json();
        const visit = data.visit;

        // Same-day check
        const visitDate = new Date(visit.created_at).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (visitDate !== today) { toast.error('This sale can only be edited on the same day'); router.push('/sales'); return; }

        // Set client
        if (visit.client) {
          setSelectedClient({ id: visit.client.id, name: visit.client.name, phone: visit.client.phone, loyalty_points: 0 });
        }

        // Set cart from services
        const cartItems: CartItem[] = (data.services || []).map((vs: any) => {
          const svc = services.find(s => s.id === vs.service_id);
          if (!svc) return null;
          const customPrice = vs.unit_price !== svc.price ? vs.unit_price : undefined;
          return { service: svc, quantity: vs.quantity || 1, customPrice, workerIds: vs.worker_ids || [] };
        }).filter(Boolean) as CartItem[];
        setCart(cartItems);

        // Set addons (deduplicate by addon_id)
        if (data.addons && data.addons.length > 0) {
          const seen = new Set<string>();
          const addonItems: CartAddon[] = data.addons.map((va: any) => {
            if (seen.has(va.addon_id)) return null;
            seen.add(va.addon_id);
            const found = availableAddons.find(a => a.id === va.addon_id);
            if (!found) return null;
            return { addon: found, quantity: va.quantity || 1, customPrice: va.price !== found.price ? va.price : undefined };
          }).filter(Boolean) as CartAddon[];
          setCartAddons(addonItems);
          if (addonItems.length > 0) setAddonsExpanded(true);
        }

        // Set payment breakdown
        if (visit.checkout_discount && Number(visit.checkout_discount) > 0) {
          setCheckoutDiscount(String(Number(visit.checkout_discount)));
        }

        // Pre-fill amount paid if this was an overpaid sale
        if (visit.amount_paid && Number(visit.amount_paid) > 0) {
          setAmountPaid(String(Number(visit.amount_paid)));
        }

        setIsEditMode(true);
        setEditLoaded(true);
      } catch {
        toast.error('Failed to load visit for editing');
      }
    })();
  }, [editVisitId, editLoaded, services, availableAddons, router]);

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
    setCart([...cart, { service, quantity: 1, workerIds: selectedWorkers.length > 0 ? [...selectedWorkers] : [] }]);
    toast.success(`${service.name} added to cart`);
  };

  const addWorkerToService = (cartIndex: number, workerId: string) => {
    setCart(prev => prev.map((item, i) =>
      i === cartIndex && !item.workerIds.includes(workerId)
        ? { ...item, workerIds: [...item.workerIds, workerId] }
        : item
    ));
    setServiceWorkerOpen(null);
    setServiceWorkerQuery('');
  };

  const removeWorkerFromService = (cartIndex: number, workerId: string) => {
    setCart(prev => prev.map((item, i) =>
      i === cartIndex
        ? { ...item, workerIds: item.workerIds.filter(id => id !== workerId) }
        : item
    ));
  };

  const addAddonForService = (addon: Addon, serviceIdx: number) => {
    setCartAddons(prev => {
      const existing = prev.find(c => c.addon.id === addon.id && c.serviceIndex === serviceIdx);
      if (existing) return prev;
      return [...prev, { addon, quantity: 1, serviceIndex: serviceIdx }];
    });
    setServiceAddonOpen(null);
  };

  const removeFromCart = (cartIndex: number) => {
    setCart(cart.filter((_, i) => i !== cartIndex));
  };

  const updateQuantity = (cartIndex: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartIndex);
    } else {
      setCart(cart.map((item, i) =>
        i === cartIndex
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const updateCustomPrice = (cartIndex: number, price: number) => {
    setCart(cart.map((item, i) =>
      i === cartIndex
        ? { ...item, customPrice: price === item.service.price ? undefined : price }
        : item
    ));
  };

  // Global worker selection fills only services that have no workers yet
  useEffect(() => {
    if (selectedWorkers.length > 0) {
      setCart(prev => prev.map(item =>
        item.workerIds.length === 0 ? { ...item, workerIds: [...selectedWorkers] } : item
      ));
    } else {
      setCart(prev => prev.map(item => ({ ...item, workerIds: [] })));
    }
  }, [selectedWorkers]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a service is removed, clean up addons linked to removed indices
  useEffect(() => {
    setCartAddons(prev => prev.filter(a =>
      a.serviceIndex === undefined || a.serviceIndex < cart.length
    ));
  }, [cart.length]);

  // Auto-fill Amount Paid from the live amount due whenever cart/discount/coupon changes.
  // Skip in edit mode so the existing paid amount is preserved on load.
  useEffect(() => {
    if (isEditMode) return;
    const grandTotal =
      cart.reduce((s, i) => s + (i.customPrice ?? i.service.price) * i.quantity, 0) +
      cartAddons.reduce((s, i) => s + (i.customPrice ?? i.addon.price) * i.quantity, 0);
    const discAmt = Math.max(0, Number(checkoutDiscount) || 0);
    const afterDiscount = Math.max(0, grandTotal - discAmt);
    const couponAmt = appliedCoupon ? Math.min(appliedCoupon.remaining_value, afterDiscount) : 0;
    const due = Math.max(0, afterDiscount - couponAmt);
    setAmountPaid(due > 0 ? String(due) : '');
  }, [cart, cartAddons, checkoutDiscount, appliedCoupon, isEditMode]);

  const loadAddons = async () => {
    try {
      const res = await fetch('/api/addons');
      if (res.ok) setAvailableAddons((await res.json()).filter((a: Addon) => a.is_active));
    } catch { /* silently ignore */ }
  };

  // Balance modal: debounced search for clients with unpaid balance
  useEffect(() => {
    if (!showBalanceModal) return;
    if (balanceSearchRef.current) clearTimeout(balanceSearchRef.current);
    balanceSearchRef.current = setTimeout(async () => {
      setBalanceSearching(true);
      try {
        const res = await fetch(`/api/clients/balances?search=${encodeURIComponent(balanceSearch)}`);
        if (res.ok) setBalanceClients(await res.json());
      } catch { /* ignore */ } finally {
        setBalanceSearching(false);
      }
    }, 300);
    return () => { if (balanceSearchRef.current) clearTimeout(balanceSearchRef.current); };
  }, [balanceSearch, showBalanceModal]);

  const openBalanceModal = () => {
    setBalanceSearch('');
    setBalanceClients([]);
    setSelectedBalanceClient(null);
    setSelectedBalanceVisit(null);
    setBalancePaymentAmount('');
    setBalancePaymentMethod('cash');
    setShowBalanceModal(true);
  };

  const processBalancePayment = async () => {
    if (!selectedBalanceVisit || !balancePaymentAmount) return;
    const amt = Number(balancePaymentAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid payment amount'); return; }

    setProcessingBalance(true);
    try {
      const res = await fetch(`/api/visits/${selectedBalanceVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_amount: amt, payment_method: balancePaymentMethod }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record payment');
      }
      const result = await res.json();
      toast.success('Balance payment recorded!');
      setShowBalanceModal(false);

      // Show a receipt for the balance payment
      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: result.client_name,
        clientPhone: result.client_phone,
        services: [],
        total: result.total_amount,
        checkoutDiscount: result.checkout_discount > 0 ? result.checkout_discount : undefined,
        amountPaid: result.amount_paid,
        balanceDue: result.balance_due,
        pointsEarned: 0,
        paymentMethod: result.payment_method,
        isBalancePayment: true,
        originalReceiptNumber: result.receipt_number,
      });
    } catch (e: any) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setProcessingBalance(false);
    }
  };

  const validateCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid coupon');
      setAppliedCoupon(data);
      setCouponCode('');
      toast.success(`Coupon applied! ${formatCurrency(data.remaining_value)} available`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const addAddon = (addon: Addon) => {
    setCartAddons(prev => {
      const existing = prev.find(c => c.addon.id === addon.id && c.serviceIndex === undefined);
      if (existing) return prev.filter(c => !(c.addon.id === addon.id && c.serviceIndex === undefined));
      return [...prev, { addon, quantity: 1 }];
    });
  };

  const addonMatch = (c: CartAddon, addonId: string, serviceIndex?: number) =>
    c.addon.id === addonId && c.serviceIndex === serviceIndex;

  const updateAddonQty = (addonId: string, qty: number, serviceIndex?: number) => {
    if (qty <= 0) { setCartAddons(prev => prev.filter(c => !addonMatch(c, addonId, serviceIndex))); return; }
    setCartAddons(prev => prev.map(c => addonMatch(c, addonId, serviceIndex) ? { ...c, quantity: qty } : c));
  };

  const updateAddonCustomPrice = (addonId: string, price: number, serviceIndex?: number) => {
    setCartAddons(prev => prev.map(c =>
      addonMatch(c, addonId, serviceIndex)
        ? { ...c, customPrice: price === c.addon.price ? undefined : price }
        : c
    ));
  };

  const createQuickWorker = async () => {
    if (!quickWorkerForm.name.trim()) { toast.error('Name is required'); return; }
    setSavingQuickWorker(true);
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickWorkerForm.name.trim(),
          job_title: quickWorkerForm.job_title.trim() || 'Stylist',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const newWorker = { id: data.id, name: data.name, job_title: data.job_title };
      setWorkersList(prev => [...prev, newWorker]);
      setSelectedWorkers(prev => [...prev, data.id]);
      setWorkerSearch('');
      toast.success(`"${data.name}" added as staff`);
      setQuickWorkerModal(false);
      setQuickWorkerForm({ name: '', job_title: 'Stylist' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingQuickWorker(false);
    }
  };

  const createQuickAddon = async () => {
    if (!quickAddonForm.name.trim()) { toast.error('Name is required'); return; }
    const price = parseFloat(quickAddonForm.price);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    setSavingQuickAddon(true);
    try {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickAddonForm.name.trim(), price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const newAddon: Addon = { id: data.id, name: data.name, price: data.price, description: data.description, is_active: true };
      setAvailableAddons(prev => [...prev, newAddon]);
      setCartAddons(prev => [...prev, { addon: newAddon, quantity: 1 }]);
      toast.success(`"${data.name}" added to cart`);
      setQuickAddonModal(false);
      setQuickAddonForm({ name: '', price: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingQuickAddon(false);
    }
  };

  const calculateAddonsTotal = () =>
    cartAddons.reduce((sum, item) => sum + (item.customPrice ?? item.addon.price) * item.quantity, 0);

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.customPrice ?? item.service.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const calculateTotalDiscount = () => {
    return cart.reduce((sum, item) => {
      if (item.customPrice !== undefined && item.customPrice < item.service.price) {
        return sum + (item.service.price - item.customPrice) * item.quantity;
      }
      return sum;
    }, 0);
  };

  const calculatePoints = () => {
    if (!salon || appliedCoupon) return 0;
    return cart.reduce((sum, item) => {
      if (item.customPrice !== undefined && item.customPrice < item.service.price) return sum;
      const price = item.customPrice ?? item.service.price;
      return sum + Math.floor((price * item.quantity) / 1000) * (salon.loyalty_points_per_ugx || 10);
    }, 0);
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

    if (isEditMode) {
      let proceed = false;
      await guardAction('sensitive', async () => { proceed = true; });
      if (!proceed) return;
    }

    setProcessingPayment(true);

    const totalAmount = calculateTotal() + calculateAddonsTotal();
    const pointsEarned = calculatePoints();
    const totalDiscount = calculateTotalDiscount();

    // Payment breakdown values
    const discountAmt = Math.max(0, Number(checkoutDiscount) || 0);
    const subtotalAfterDiscount = Math.max(0, totalAmount - discountAmt);
    const couponAmt = appliedCoupon ? Math.min(appliedCoupon.remaining_value, subtotalAfterDiscount) : 0;
    const amountDue = Math.max(0, subtotalAfterDiscount - couponAmt);
    const paidAmt = Math.max(0, Number(amountPaid) || 0);
    const balanceDueAmt = Math.max(0, amountDue - paidAmt);

    const purchasedServices = [
      ...cart.map((item) => ({
        name: item.service.name,
        quantity: item.quantity,
        unitPrice: item.customPrice ?? item.service.price,
        originalPrice: item.customPrice !== undefined && item.customPrice < item.service.price ? item.service.price : undefined,
        discountAmount: item.customPrice !== undefined && item.customPrice < item.service.price
          ? (item.service.price - item.customPrice) * item.quantity
          : undefined,
      })),
      ...cartAddons.map(item => ({
        name: `${item.addon.name} (Add-on)`,
        quantity: item.quantity,
        unitPrice: item.customPrice ?? item.addon.price,
        originalPrice: item.customPrice !== undefined && item.customPrice < item.addon.price ? item.addon.price : undefined,
        discountAmount: item.customPrice !== undefined && item.customPrice < item.addon.price
          ? (item.addon.price - item.customPrice) * item.quantity
          : undefined,
      })),
    ];

    try {
      const url = isEditMode ? `/api/visits/${editVisitId}` : '/api/visits';
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          services: cart.map(item => ({
            service_id: item.service.id,
            quantity: item.quantity,
            custom_price: item.customPrice,
            worker_ids: item.workerIds,
          })),
          payment_method: paymentMethod,
          send_receipt: false,
          worker_ids: selectedWorkers,
          transaction_date: transactionDate !== new Date().toISOString().split('T')[0] ? transactionDate : undefined,
          addons: cartAddons.map((item, _) => ({
            addon_id: item.addon.id,
            quantity: item.quantity,
            custom_price: item.customPrice,
            service_index: item.serviceIndex,
          })),
          checkout_discount: discountAmt > 0 ? discountAmt : undefined,
          amount_paid: paidAmt,
          coupon_code: appliedCoupon?.code,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      const result = await response.json();

      if (isEditMode) {
        toast.success('Sale updated successfully');
        router.push('/sales');
        return;
      }

      toast.success(`Payment successful! Receipt: ${result.receipt_number}`);

      // Trigger rating flow — unique workers across all per-service assignments, fallback to global
      if (selectedClient) {
        const allAssignedIds = [...new Set(cart.flatMap(item => item.workerIds))];
        const ratingIds = allAssignedIds.length > 0 ? allAssignedIds : selectedWorkers;
        if (ratingIds.length > 0) {
          const workers = ratingIds
            .map(id => workersList.find(w => w.id === id))
            .filter((w): w is { id: string; name: string; job_title: string } => !!w)
            .map(w => ({ id: w.id, name: w.name }));
          setPendingRating({ visitId: result.id, clientId: selectedClient.id, workers });
        }
      }

      setCompletedTransaction({
        receiptNumber: result.receipt_number,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        services: purchasedServices,
        total: totalAmount,
        totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
        checkoutDiscount: discountAmt > 0 ? discountAmt : undefined,
        couponDiscount: appliedCoupon ? Math.min(appliedCoupon.remaining_value, Math.max(0, totalAmount - discountAmt)) : undefined,
        amountPaid: paidAmt !== amountDue ? paidAmt : undefined,
        balanceDue: balanceDueAmt > 0 ? balanceDueAmt : undefined,
        pointsEarned,
        paymentMethod,
        workerName: (() => {
          const ids = [...new Set(cart.flatMap(item => item.workerIds))];
          const names = (ids.length > 0 ? ids : selectedWorkers).map(id => workersList.find(w => w.id === id)?.name).filter(Boolean);
          return names.length > 0 ? names.join(', ') : undefined;
        })(),
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
      setCartAddons([]);
      setAddonsExpanded(false);
      setSelectedWorkers([]);
      setWorkerSearch('');
      setCheckoutDiscount('');
      setAmountPaid('');
      setAppliedCoupon(null);
      setCouponCode('');
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

  const isInflatedSale = isEditMode && amountPaid !== '' && Number(amountPaid) > (calculateTotal() + calculateAddonsTotal() - Math.max(0, Number(checkoutDiscount) || 0) - (appliedCoupon ? Math.min(appliedCoupon.remaining_value, Math.max(0, calculateTotal() + calculateAddonsTotal() - (Number(checkoutDiscount) || 0))) : 0));

  return (
    <div className="min-h-screen bg-gray-50 lg:h-screen lg:overflow-hidden lg:flex lg:flex-col">
      <SalonHeader title={isEditMode ? "Edit Sale" : "POS System"} />
      {isInflatedSale && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <span className="text-sm font-medium text-blue-900">This is an inflated sale — charged amount ({formatCurrency(Number(amountPaid))}) exceeds service total</span>
        </div>
      )}

      <div className="container mx-auto p-6 lg:p-0 lg:flex lg:flex-1 lg:overflow-hidden lg:max-w-none">
        <div className="grid gap-6 lg:flex lg:flex-1 lg:gap-0 lg:overflow-hidden lg:w-full">
          {/* Left: Services Selection */}
          <div className="lg:col-span-2 space-y-6 lg:flex-1 lg:overflow-y-auto lg:p-6">
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
          <div className="space-y-6 lg:w-96 lg:flex-shrink-0 lg:border-l lg:border-gray-200 lg:bg-white lg:overflow-y-auto lg:p-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Cart</h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No services selected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, cartIdx) => {
                    const displayPrice = item.customPrice ?? item.service.price;
                    const hasDiscount = item.customPrice !== undefined && item.customPrice < item.service.price;
                    const linkedAddons = cartAddons.filter(a => a.serviceIndex === cartIdx);
                    return (
                    <div key={cartIdx} className="bg-gray-50 rounded-lg overflow-hidden">
                      {/* Service header row */}
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.service.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {hasDiscount && (
                              <span className="text-xs text-gray-400 line-through">{formatCurrency(item.service.price)}</span>
                            )}
                            {editingPriceId === `svc:${cartIdx}` ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value.replace(/[^0-9]/g, ''))}
                                onBlur={() => {
                                  const val = parseFloat(editingPriceValue);
                                  if (!isNaN(val) && val >= 0) updateCustomPrice(cartIdx, val);
                                  setEditingPriceId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseFloat(editingPriceValue);
                                    if (!isNaN(val) && val >= 0) updateCustomPrice(cartIdx, val);
                                    setEditingPriceId(null);
                                  }
                                  if (e.key === 'Escape') setEditingPriceId(null);
                                }}
                                autoFocus
                                className="w-24 text-sm px-2 py-0.5 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingPriceId(`svc:${cartIdx}`); setEditingPriceValue(String(displayPrice)); }}
                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 group"
                                title="Click to edit price"
                              >
                                <span>{formatCurrency(displayPrice)} × {item.quantity}</span>
                                <svg className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {hasDiscount && (
                            <span className="text-xs font-medium text-green-600">-{formatCurrency((item.service.price - item.customPrice!) * item.quantity)} discount • no points</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => updateQuantity(cartIdx, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">-</button>
                          <span className="w-6 text-center font-medium text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(cartIdx, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm">+</button>
                          <button onClick={() => removeFromCart(cartIdx)} className="ml-1 text-red-500 hover:text-red-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Per-service worker assignment */}
                      <div className="px-3 pb-2 border-t border-gray-200 pt-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs text-gray-400 shrink-0">Staff:</span>
                          {item.workerIds.map(wid => {
                            const w = workersList.find(w => w.id === wid);
                            return w ? (
                              <span key={wid} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full text-white" style={{ backgroundColor: salon?.theme_primary_color || '#6366f1' }}>
                                {w.name}
                                <button onClick={() => removeWorkerFromService(cartIdx, wid)} className="ml-0.5 opacity-80 hover:opacity-100 leading-none">×</button>
                              </span>
                            ) : null;
                          })}
                          <button
                            onClick={() => { setServiceWorkerOpen(serviceWorkerOpen === cartIdx ? null : cartIdx); setServiceWorkerQuery(''); }}
                            className="text-xs text-gray-400 hover:text-brand-primary border border-dashed border-gray-300 hover:border-brand-primary rounded-full px-2 py-0.5 transition-colors"
                          >
                            + add
                          </button>
                          {item.workerIds.length > 1 && (
                            <span className="text-xs text-gray-400 ml-0.5">(split equally)</span>
                          )}
                        </div>
                        {serviceWorkerOpen === cartIdx && (
                          <div className="mt-1.5">
                            <input
                              type="text"
                              value={serviceWorkerQuery}
                              onChange={e => setServiceWorkerQuery(e.target.value)}
                              placeholder="Search worker..."
                              autoFocus
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 mb-1"
                            />
                            <div className="max-h-28 overflow-y-auto space-y-0.5">
                              {workersList
                                .filter(w =>
                                  !item.workerIds.includes(w.id) &&
                                  (serviceWorkerQuery.trim() === '' || w.name.toLowerCase().includes(serviceWorkerQuery.toLowerCase()) || w.job_title.toLowerCase().includes(serviceWorkerQuery.toLowerCase()))
                                )
                                .map(w => (
                                  <button
                                    key={w.id}
                                    onClick={() => addWorkerToService(cartIdx, w.id)}
                                    className="w-full flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-white border border-transparent hover:border-gray-200 text-left"
                                  >
                                    <span>{w.name}</span>
                                    <span className="text-gray-400">{w.job_title}</span>
                                  </button>
                                ))
                              }
                              {workersList.filter(w => !item.workerIds.includes(w.id) && (serviceWorkerQuery.trim() === '' || w.name.toLowerCase().includes(serviceWorkerQuery.toLowerCase()))).length === 0 && (
                                <p className="text-xs text-gray-400 italic px-2 py-1">No more staff</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Linked add-ons for this service */}
                      {(linkedAddons.length > 0 || serviceAddonOpen === cartIdx) && (
                        <div className="px-3 pb-2 border-t border-gray-200 pt-2 space-y-1.5">
                          {linkedAddons.map(a => {
                            const addonEditKey = `addon:${a.addon.id}:${cartIdx}`;
                            const addonDisplayPrice = a.customPrice ?? a.addon.price;
                            return (
                              <div key={`${a.addon.id}-${cartIdx}`} className="flex items-center justify-between bg-brand-primary/5 rounded px-2 py-1.5">
                                <span className="text-xs font-medium text-gray-800 truncate">{a.addon.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => updateAddonQty(a.addon.id, a.quantity - 1, cartIdx)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">−</button>
                                  <span className="text-xs w-4 text-center font-medium">{a.quantity}</span>
                                  <button onClick={() => updateAddonQty(a.addon.id, a.quantity + 1, cartIdx)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">+</button>
                                  {editingPriceId === addonEditKey ? (
                                    <input
                                      type="text" inputMode="numeric" pattern="[0-9]*"
                                      value={editingPriceValue}
                                      onChange={e => setEditingPriceValue(e.target.value.replace(/[^0-9]/g, ''))}
                                      onBlur={() => { const val = parseFloat(editingPriceValue); if (!isNaN(val) && val >= 0) updateAddonCustomPrice(a.addon.id, val, cartIdx); setEditingPriceId(null); }}
                                      onKeyDown={e => { if (e.key === 'Enter') { const val = parseFloat(editingPriceValue); if (!isNaN(val) && val >= 0) updateAddonCustomPrice(a.addon.id, val, cartIdx); setEditingPriceId(null); } if (e.key === 'Escape') setEditingPriceId(null); }}
                                      autoFocus className="w-16 text-xs px-1 py-0.5 border border-blue-400 rounded focus:outline-none"
                                    />
                                  ) : (
                                    <button onClick={() => { setEditingPriceId(addonEditKey); setEditingPriceValue(String(addonDisplayPrice)); }} className="text-xs text-gray-500 hover:text-blue-600 w-16 text-right">{formatCurrency(addonDisplayPrice * a.quantity)}</button>
                                  )}
                                  <button onClick={() => updateAddonQty(a.addon.id, 0, cartIdx)} className="text-red-400 hover:text-red-600 ml-0.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {serviceAddonOpen === cartIdx && (
                            <div className="grid grid-cols-2 gap-1">
                              {availableAddons
                                .filter(addon => !cartAddons.find(c => c.addon.id === addon.id && c.serviceIndex === cartIdx))
                                .map(addon => (
                                  <button
                                    key={addon.id}
                                    onClick={() => addAddonForService(addon, cartIdx)}
                                    className="text-left px-2 py-1.5 rounded border border-gray-200 hover:border-brand-primary hover:bg-gray-50 text-xs transition-colors"
                                  >
                                    <p className="font-medium truncate">{addon.name}</p>
                                    <p className="text-gray-400 mt-0.5">{formatCurrency(addon.price)}</p>
                                  </button>
                                ))
                              }
                              {availableAddons.filter(addon => !cartAddons.find(c => c.addon.id === addon.id && c.serviceIndex === cartIdx)).length === 0 && (
                                <p className="text-xs text-gray-400 italic col-span-2 py-1">All add-ons already added</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Add extra button */}
                      <div className="px-3 pb-2.5">
                        <button
                          onClick={() => setServiceAddonOpen(serviceAddonOpen === cartIdx ? null : cartIdx)}
                          className="text-xs text-brand-primary hover:underline font-medium"
                        >
                          {serviceAddonOpen === cartIdx ? '− close extras' : '+ add extra for this service'}
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Add-ons & Extras — unlinked (not attached to a specific service) */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                {(() => {
                  const unlinkedAddons = cartAddons.filter(a => a.serviceIndex === undefined);
                  return (
                <button
                  onClick={() => setAddonsExpanded(p => !p)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    General Add-ons
                    {unlinkedAddons.length > 0 && <span className="ml-1 bg-brand-primary text-white text-xs rounded-full px-1.5 py-0.5">{unlinkedAddons.length}</span>}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${addonsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                );
                })()}

                {addonsExpanded && (
                  <>
                    {availableAddons.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-400 mb-2">No add-ons set up yet</p>
                        <button
                          onClick={() => setQuickAddonModal(true)}
                          className="text-xs font-medium text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg hover:bg-brand-primary/5"
                        >
                          + Create add-on
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {availableAddons.map(addon => {
                          const inCart = cartAddons.find(c => c.addon.id === addon.id && c.serviceIndex === undefined);
                          return (
                            <button
                              key={addon.id}
                              onClick={() => addAddon(addon)}
                              className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                                inCart
                                  ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                                  : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <p className="font-medium truncate">{addon.name}</p>
                              <p className="text-gray-400 mt-0.5">{formatCurrency(addon.price)}</p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {availableAddons.length > 0 && (
                      <button
                        onClick={() => setQuickAddonModal(true)}
                        className="text-xs text-brand-primary font-medium hover:underline w-full text-left mb-2"
                      >
                        + New add-on
                      </button>
                    )}

                    {(() => {
                      const unlinked = cartAddons.filter(a => a.serviceIndex === undefined);
                      return unlinked.length > 0 ? (
                        <div className="space-y-1.5 mt-1">
                          {unlinked.map((item, idx) => {
                            const addonEditKey = `addon:${item.addon.id}:unlinked:${idx}`;
                            const addonDisplayPrice = item.customPrice ?? item.addon.price;
                            return (
                              <div key={`${item.addon.id}-${idx}`} className="bg-brand-primary/5 rounded-lg px-2.5 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-gray-800">{item.addon.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => updateAddonQty(item.addon.id, item.quantity - 1)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">−</button>
                                    <span className="text-xs w-4 text-center font-medium">{item.quantity}</span>
                                    <button onClick={() => updateAddonQty(item.addon.id, item.quantity + 1)} className="w-5 h-5 text-xs border border-gray-300 bg-white rounded flex items-center justify-center hover:bg-gray-50">+</button>
                                    {editingPriceId === addonEditKey ? (
                                      <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        value={editingPriceValue}
                                        onChange={e => setEditingPriceValue(e.target.value.replace(/[^0-9]/g, ''))}
                                        onBlur={() => { const val = parseFloat(editingPriceValue); if (!isNaN(val) && val >= 0) updateAddonCustomPrice(item.addon.id, val); setEditingPriceId(null); }}
                                        onKeyDown={e => { if (e.key === 'Enter') { const val = parseFloat(editingPriceValue); if (!isNaN(val) && val >= 0) updateAddonCustomPrice(item.addon.id, val); setEditingPriceId(null); } if (e.key === 'Escape') setEditingPriceId(null); }}
                                        autoFocus className="w-20 text-xs px-1.5 py-0.5 border border-blue-400 rounded focus:outline-none text-right"
                                      />
                                    ) : (
                                      <button onClick={() => { setEditingPriceId(addonEditKey); setEditingPriceValue(String(addonDisplayPrice)); }} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-blue-600 group ml-1">
                                        {item.customPrice !== undefined && item.customPrice !== item.addon.price && <span className="text-gray-300 line-through mr-0.5">{formatCurrency(item.addon.price)}</span>}
                                        <span className="w-16 text-right">{formatCurrency(addonDisplayPrice * item.quantity)}</span>
                                        <svg className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
              </div>

              {/* Total */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {calculateTotalDiscount() > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-sm">Original Price</span>
                      <span className="text-sm text-gray-400 line-through">{formatCurrency(calculateTotal() + calculateTotalDiscount())}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-green-600 font-medium text-sm">Total Discount</span>
                      <span className="font-semibold text-green-600 text-sm">-{formatCurrency(calculateTotalDiscount())}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(calculateTotal())}</span>
                </div>
                {calculateAddonsTotal() > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 text-sm">Add-ons</span>
                    <span className="font-semibold text-sm">{formatCurrency(calculateAddonsTotal())}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Points to Earn</span>
                  <span className="font-semibold text-brand-primary">+{calculatePoints()}</span>
                </div>
                <div className="flex items-center justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-brand-primary">{formatCurrency(calculateTotal() + calculateAddonsTotal())}</span>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Details</p>

                {/* Checkout Discount */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discount (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={checkoutDiscount}
                      onChange={e => setCheckoutDiscount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Coupon Code */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Coupon Code</label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-mono font-semibold text-green-800 tracking-wider">{appliedCoupon.code}</p>
                        <p className="text-xs text-green-600">{formatCurrency(appliedCoupon.remaining_value)} available{appliedCoupon.group_name ? ` · ${appliedCoupon.group_name}` : ''}</p>
                        {appliedCoupon.issued_to && <p className="text-xs text-green-500 mt-0.5">For: {appliedCoupon.issued_to}</p>}
                      </div>
                      <button onClick={() => setAppliedCoupon(null)} className="text-green-400 hover:text-red-500 transition-colors text-xs ml-2">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && validateCoupon()}
                        placeholder="XXXX-XXXX-XXXX"
                        className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      />
                      <button
                        onClick={validateCoupon}
                        disabled={!couponCode.trim() || validatingCoupon}
                        className="px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {validatingCoupon ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={formatCurrency(Math.max(0, (calculateTotal() + calculateAddonsTotal()) - (Number(checkoutDiscount) || 0))).replace('UGX', '').trim()}
                      className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {isEditMode && isInflatedSale && <p className="text-xs text-amber-600 mt-1">Final charged amount (may exceed service total)</p>}
                </div>

                {/* Live balance preview */}
                {(() => {
                  const grandTotal = calculateTotal() + calculateAddonsTotal();
                  const disc = Math.max(0, Number(checkoutDiscount) || 0);
                  const subtotalAfterDiscount = Math.max(0, grandTotal - disc);
                  const couponAmt = appliedCoupon ? Math.min(appliedCoupon.remaining_value, subtotalAfterDiscount) : 0;
                  const due = Math.max(0, subtotalAfterDiscount - couponAmt);
                  const paid = Math.max(0, Number(amountPaid) || 0);
                  const bal = Math.max(0, due - paid);
                  const isOverpaid = paid > due;
                  if (disc === 0 && couponAmt === 0 && bal === 0 && !isOverpaid) return null;
                  return (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-sm">
                      {!isOverpaid && (disc > 0 || couponAmt > 0) && (
                        <>
                          <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span><span>{formatCurrency(grandTotal)}</span>
                          </div>
                          {disc > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount</span><span>−{formatCurrency(disc)}</span>
                            </div>
                          )}
                          {couponAmt > 0 && (
                            <div className="flex justify-between text-purple-600">
                              <span>Coupon</span><span>−{formatCurrency(couponAmt)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5">
                            <span>Amount Due</span><span>{formatCurrency(due)}</span>
                          </div>
                        </>
                      )}
                      {isOverpaid ? (
                        <div className="flex justify-between font-semibold text-brand-primary">
                          <span>Total</span><span>{formatCurrency(paid)}</span>
                        </div>
                      ) : (
                        <>
                          {amountPaid !== '' && (
                            <div className="flex justify-between text-gray-600">
                              <span>Amount Paid</span><span>{formatCurrency(paid)}</span>
                            </div>
                          )}
                          {bal > 0 ? (
                            <div className="flex justify-between font-bold text-red-600 border-t border-red-200 pt-1.5">
                              <span>Balance Due</span><span>{formatCurrency(bal)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between font-semibold text-green-600 border-t border-green-200 pt-1.5">
                              <span>Paid in Full</span><span>✓</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Served By — fills unassigned services; per-service assignment overrides */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-xs font-medium text-gray-500 mb-0.5">
                  Served By
                  {selectedWorkers.length > 0 && (
                    <span className="ml-1.5 text-blue-600">({selectedWorkers.length} selected)</span>
                  )}
                </label>
                <p className="text-xs text-gray-400 mb-1.5">Fills unassigned services above</p>
                {selectedWorkers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedWorkers.map(id => {
                      const w = workersList.find(w => w.id === id);
                      if (!w) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-white text-xs rounded-full"
                          style={{ backgroundColor: salon?.theme_primary_color || '#6366f1' }}
                        >
                          {w.name}
                          <button
                            onClick={() => setSelectedWorkers(prev => prev.filter(i => i !== id))}
                            className="ml-0.5 opacity-80 hover:opacity-100 leading-none"
                          >×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={workerSearch}
                  onChange={e => setWorkerSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1.5"
                />
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {workersList
                    .filter(w =>
                      workerSearch.trim() === '' ||
                      w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                      w.job_title.toLowerCase().includes(workerSearch.toLowerCase())
                    )
                    .map(w => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWorkers(prev =>
                          prev.includes(w.id) ? prev.filter(i => i !== w.id) : [...prev, w.id]
                        )}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-lg transition-colors text-left ${
                          selectedWorkers.includes(w.id)
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'hover:bg-gray-50 border border-transparent text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {selectedWorkers.includes(w.id) && (
                            <svg className="w-3.5 h-3.5 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          <span className={selectedWorkers.includes(w.id) ? 'font-medium' : ''}>{w.name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{w.job_title}</span>
                      </button>
                    ))}
                  {workersList.filter(w =>
                    workerSearch.trim() === '' ||
                    w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
                    w.job_title.toLowerCase().includes(workerSearch.toLowerCase())
                  ).length === 0 && (
                    <p className="text-sm text-gray-400 italic px-2 py-1.5">No staff found</p>
                  )}
                </div>
                {(user?.role === 'owner' || user?.role === 'admin') && (
                  <button
                    onClick={() => setQuickWorkerModal(true)}
                    className="text-xs text-brand-primary font-medium hover:underline mt-1.5"
                  >
                    + New staff member
                  </button>
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
                  {processingPayment ? 'Processing...' : isEditMode ? 'Save — MTN Mobile Money' : 'Pay with MTN Mobile Money'}
                </button>
                <button
                  onClick={() => processPayment('airtel_money')}
                  disabled={!selectedClient || cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditMode ? 'Save — Airtel Money' : 'Pay with Airtel Money'}
                </button>
                <button
                  onClick={() => processPayment('cash')}
                  disabled={!selectedClient || cart.length === 0 || processingPayment}
                  className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditMode ? 'Save — Cash' : 'Cash Payment'}
                </button>

                {/* Record Balance Payment — secondary action */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={openBalanceModal}
                    className="w-full text-sm font-medium text-gray-600 hover:text-brand-primary flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Record Balance Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Worker Create Modal */}
      {quickWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) { setQuickWorkerModal(false); setQuickWorkerForm({ name: '', job_title: 'Stylist' }); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">New Staff Member</h3>
              <p className="text-xs text-gray-400 mt-0.5">Will be saved and set as the serving staff</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                value={quickWorkerForm.name}
                onChange={e => setQuickWorkerForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickWorker()}
                placeholder="e.g. Sarah Nakato"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
              <input
                value={quickWorkerForm.job_title}
                onChange={e => setQuickWorkerForm(p => ({ ...p, job_title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickWorker()}
                placeholder="e.g. Stylist, Nail Tech"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setQuickWorkerModal(false); setQuickWorkerForm({ name: '', job_title: 'Stylist' }); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={createQuickWorker} disabled={savingQuickWorker || !quickWorkerForm.name.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingQuickWorker ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add-on Create Modal */}
      {quickAddonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) { setQuickAddonModal(false); setQuickAddonForm({ name: '', price: '' }); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">New Add-on</h3>
              <p className="text-xs text-gray-400 mt-0.5">Will be saved and added to this sale</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                value={quickAddonForm.name}
                onChange={e => setQuickAddonForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickAddon()}
                placeholder="e.g. Extra Jelly, Scalp Massage…"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price (UGX)</label>
              <NumberInput
                min="0"
                value={quickAddonForm.price}
                onChange={e => setQuickAddonForm(p => ({ ...p, price: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && createQuickAddon()}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setQuickAddonModal(false); setQuickAddonForm({ name: '', price: '' }); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={createQuickAddon} disabled={savingQuickAddon || !quickAddonForm.name.trim()} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingQuickAddon ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          workers={pendingRating.workers}
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

      {/* Record Balance Payment Modal */}
      {showBalanceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBalanceModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">Record Balance Payment</h3>
                <p className="text-xs text-gray-400 mt-0.5">Collect payment for a client's outstanding balance</p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Client search */}
              {!selectedBalanceClient ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Search Client</label>
                  <input
                    type="text"
                    value={balanceSearch}
                    onChange={e => setBalanceSearch(e.target.value)}
                    placeholder="Type client name or phone…"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {balanceSearching && <p className="text-xs text-gray-400 mt-2">Searching…</p>}
                  {!balanceSearching && balanceClients.length === 0 && balanceSearch !== '' && (
                    <p className="text-xs text-gray-400 mt-2">No clients with outstanding balance found</p>
                  )}
                  {!balanceSearching && balanceClients.length === 0 && balanceSearch === '' && (
                    <p className="text-xs text-gray-400 mt-2">Start typing to search, or see all clients with balance below</p>
                  )}
                  <div className="mt-3 space-y-2">
                    {balanceClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedBalanceClient(client);
                          if (client.outstanding_visits?.length === 1) {
                            setSelectedBalanceVisit(client.outstanding_visits[0]);
                            setBalancePaymentAmount(String(client.outstanding_visits[0].balance_due));
                          }
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                            <p className="text-xs text-gray-400">{client.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-600">{formatCurrency(Number(client.total_balance))}</p>
                            <p className="text-xs text-gray-400">{client.outstanding_visits?.length || 0} unpaid</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Selected client header */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{selectedBalanceClient.name}</p>
                      <p className="text-xs text-gray-400">{selectedBalanceClient.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(Number(selectedBalanceClient.total_balance))} owed</p>
                      <button onClick={() => { setSelectedBalanceClient(null); setSelectedBalanceVisit(null); setBalancePaymentAmount(''); }} className="text-xs text-brand-primary hover:underline">Change</button>
                    </div>
                  </div>

                  {/* Visit selector (if multiple) */}
                  {(selectedBalanceClient.outstanding_visits?.length || 0) > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Select Visit</label>
                      <div className="space-y-2">
                        {selectedBalanceClient.outstanding_visits.map(v => (
                          <button
                            key={v.id}
                            onClick={() => { setSelectedBalanceVisit(v); setBalancePaymentAmount(String(v.balance_due)); }}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selectedBalanceVisit?.id === v.id ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 hover:border-brand-primary/50'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-medium text-gray-900">{v.receipt_number}</p>
                                <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Total: {formatCurrency(Number(v.total_amount))}</p>
                                <p className="text-sm font-bold text-red-600">Owed: {formatCurrency(Number(v.balance_due))}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show the single visit summary */}
                  {selectedBalanceVisit && (selectedBalanceClient.outstanding_visits?.length || 0) === 1 && (
                    <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Receipt</span>
                        <span className="font-medium">{selectedBalanceVisit.receipt_number}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Visit Date</span>
                        <span>{new Date(selectedBalanceVisit.created_at).toLocaleDateString('en-UG', { dateStyle: 'medium' })}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Total</span>
                        <span>{formatCurrency(Number(selectedBalanceVisit.total_amount))}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Paid so far</span>
                        <span className="text-green-600">{formatCurrency(Number(selectedBalanceVisit.amount_paid))}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-gray-200 pt-1 mt-1">
                        <span className="text-red-600">Outstanding</span>
                        <span className="text-red-600">{formatCurrency(Number(selectedBalanceVisit.balance_due))}</span>
                      </div>
                    </div>
                  )}

                  {/* Amount + method */}
                  {selectedBalanceVisit && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paying Now</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={balancePaymentAmount}
                            onChange={e => setBalancePaymentAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full pl-11 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        {balancePaymentAmount !== '' && Number(balancePaymentAmount) > 0 && (
                          <p className={`text-xs mt-1 font-medium ${Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)) === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                            Remaining after this: {formatCurrency(Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)))}
                            {Math.max(0, Number(selectedBalanceVisit.balance_due) - Number(balancePaymentAmount)) === 0 ? ' ✓ Fully cleared' : ''}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[['cash', 'Cash'], ['mtn_mobile_money', 'MTN MoMo'], ['airtel_money', 'Airtel']].map(([val, label]) => {
                            const isSelected = balancePaymentMethod === val;
                            const salonColor = salon?.theme_primary_color || '#6366f1';
                            return (
                              <button
                                key={val}
                                onClick={() => setBalancePaymentMethod(val)}
                                className="py-2 px-3 text-xs rounded-lg border font-medium transition-colors"
                                style={
                                  isSelected
                                    ? { borderColor: salonColor, backgroundColor: salonColor + '15', color: salonColor }
                                    : { borderColor: '#e5e7eb', color: '#4b5563' }
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {selectedBalanceVisit && (
              <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
                <button onClick={() => setShowBalanceModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-white">Cancel</button>
                <button
                  onClick={processBalancePayment}
                  disabled={processingBalance || !balancePaymentAmount || Number(balancePaymentAmount) <= 0}
                  className="flex-1 btn-primary text-sm disabled:opacity-50"
                >
                  {processingBalance ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {SecurityModal}
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
            <NumberInput
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
            <NumberInput
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

// Staff Rating Modal — all workers on one page, single submit
function StaffRatingModal({
  visitId,
  workers,
  clientId,
  onDone,
}: {
  visitId: string;
  workers: { id: string; name: string }[];
  clientId: string;
  onDone: () => void;
}) {
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const toRate = workers.filter(w => (ratings[w.id] ?? 0) > 0);
    setSubmitting(true);
    try {
      await Promise.all(
        toRate.map(w =>
          fetch('/api/ratings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visit_id: visitId,
              worker_id: w.id,
              client_id: clientId,
              rating: ratings[w.id],
              comment: comments[w.id] || '',
            }),
          })
        )
      );
    } catch {}
    setSubmitting(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="text-center px-6 pt-6 pb-4 shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: brandColor + '20' }}>
            <span className="text-xl">⭐</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Rate Your Experience</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {workers.length === 1 ? `Rate ${workers[0].name}` : `Rate each staff member below`}
          </p>
        </div>

        {/* Worker list — scrollable */}
        <div className="overflow-y-auto px-6 space-y-4 pb-2">
          {workers.map(w => {
            const r = ratings[w.id] ?? 0;
            const h = hovered[w.id] ?? 0;
            return (
              <div key={w.id} className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">{w.name}</p>

                {/* Stars */}
                <div className="flex gap-1.5 mb-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onMouseEnter={() => setHovered(prev => ({ ...prev, [w.id]: star }))}
                      onMouseLeave={() => setHovered(prev => ({ ...prev, [w.id]: 0 }))}
                      onClick={() => setRatings(prev => ({ ...prev, [w.id]: star }))}
                      className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                    >
                      <span className={(h || r) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    </button>
                  ))}
                  {r > 0 && (
                    <span className="text-xs text-gray-500 self-center ml-1">{labels[r]}</span>
                  )}
                </div>

                {/* Comment */}
                <textarea
                  value={comments[w.id] ?? ''}
                  onChange={e => setComments(prev => ({ ...prev, [w.id]: e.target.value }))}
                  placeholder="Comment (optional)..."
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:border-transparent resize-none mt-1"
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Skip All
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? 'Submitting...' : 'Submit Ratings'}
          </button>
        </div>
      </div>
    </div>
  );
}

