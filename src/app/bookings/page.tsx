'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader, BrandButton } from '@/components/SalonBranding';
import { DateRangePicker } from '@/components/ui';
import { PageGroupTabs, CLIENT_TABS } from '@/components/PageGroupTabs';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useModalEsc } from '@/contexts/EscContext';
import { localDateStr } from '@/lib/utils';
import { NewClientModal } from '@/components/NewClientModal';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import type { Booking, BookingStatus, Service, StaffSchedule } from '@/types';

const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'bg-gray-100 text-gray-700' },
  confirmed: { label: 'Confirmed', color: 'bg-gray-100 text-gray-700' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
  no_show:   { label: 'No Show',   color: 'bg-gray-100 text-gray-700' },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface StaffOption { id: string; name: string; }
interface ClientOption { id: string; name: string; phone: string; }

export default function BookingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#E31C23';

  // ── State ──
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);

  // Default to current month
  const now = new Date();
  const monthStart = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  
  const [dateFrom, setDateFrom]         = useState<string>(monthStart);
  const [dateTo, setDateTo]             = useState<string>(monthEnd);
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'range'>('month');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [staffFilter, setStaffFilter] = useState<string>('');

  // New booking modal
  const [showNewModal, setShowNewModal]         = useState(false);
  const [showDetailModal, setShowDetailModal]   = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking]   = useState<Booking | null>(null);

  // New booking form
  const [services, setServices]         = useState<Service[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [clients, setClients]           = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchFocused, setClientSearchFocused] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const { run, isPending } = useAsyncAction();
  const [loadingSlots, setLoadingSlots] = useState<Record<number, boolean>>({});
  const [slotsMap, setSlotsMap] = useState<Record<number, { staff_id: string; staff_name: string; slots: string[] }[]>>({});

  interface ServiceLine {
    service_id: string;
    staff_id: string;
    start_time: string;
  }

  const [form, setForm] = useState({
    client_type: 'registered' as 'registered' | 'guest',
    client_id: '',
    guest_name: '',
    guest_phone: '',
    booking_date: localDateStr(),
    notes: '',
  });

  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([
    { service_id: '', staff_id: '', start_time: '' },
  ]);

  const updateLine = (idx: number, updates: Partial<ServiceLine>) => {
    setServiceLines(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l));
  };
  const addLine = () => setServiceLines(prev => [...prev, { service_id: '', staff_id: '', start_time: '' }]);
  const removeLine = (idx: number) => setServiceLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  // Reschedule state
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ staff_id: string; staff_name: string; slots: string[] }[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // Schedule modal state
  const [scheduleStaffId, setScheduleStaffId] = useState('');
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);

  useModalEsc(showNewModal, () => setShowNewModal(false));
  useModalEsc(showDetailModal, () => setShowDetailModal(false));
  useModalEsc(showScheduleModal, () => setShowScheduleModal(false));

  // ── Period helpers ──
  const applyToday = useCallback(() => {
    const d = localDateStr();
    setDateFrom(d); setDateTo(d); setActivePeriod('today');
  }, []);

  const applyWeek = useCallback(() => {
    const now = new Date();
    const dow = now.getDay(); // 0 = Sunday
    const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    setDateFrom(localDateStr(mon));
    setDateTo(localDateStr(sun));
    setActivePeriod('week');
  }, []);

  const applyMonth = useCallback(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(localDateStr(first));
    setDateTo(localDateStr(last));
    setActivePeriod('month');
  }, []);

  // ── Load bookings ──
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date_from', dateFrom);
      params.set('date_to', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      if (staffFilter) params.set('staff_id', staffFilter);
      const res = await fetch(`/api/bookings?${params}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setBookings(await res.json());
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter, staffFilter, router]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  // ── Load lookup data ──
  useEffect(() => {
    const load = async () => {
      const [sRes, stRes, cRes] = await Promise.all([
        fetch('/api/services?showAll=false'),
        fetch('/api/workers'),
        fetch('/api/clients?paginated=false'),
      ]);
      if (sRes.ok)  setServices(await sRes.json());
      if (stRes.ok) setStaffOptions(await stRes.json());
      if (cRes.ok)  setClients(await cRes.json());
    };
    load();
  }, []);

  // ── Availability per service line ──
  const fetchSlotsForLine = useCallback(async (idx: number, line: ServiceLine) => {
    if (!line.service_id || !form.booking_date) return;
    setLoadingSlots(prev => ({ ...prev, [idx]: true }));
    try {
      const params = new URLSearchParams({ date: form.booking_date, service_id: line.service_id });
      if (line.staff_id) params.set('staff_id', line.staff_id);
      const res = await fetch(`/api/bookings/availability?${params}`);
      if (res.ok) {
        const d = await res.json();
        setSlotsMap(prev => ({ ...prev, [idx]: d.staff_availability ?? [] }));
      }
    } catch {
      toast.error('Failed to load available slots');
    } finally {
      setLoadingSlots(prev => ({ ...prev, [idx]: false }));
    }
  }, [form.booking_date]);

  const slotsDeps = serviceLines.map(l => `${l.service_id}:${l.staff_id}`).join(',');
  useEffect(() => {
    serviceLines.forEach((line, idx) => {
      if (line.service_id && form.booking_date) fetchSlotsForLine(idx, line);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.booking_date, slotsDeps, fetchSlotsForLine]);

  // ── Create booking ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceLines.some(l => !l.service_id || !l.staff_id || !l.start_time)) {
      toast.error('Select service, staff, and time for each line');
      return;
    }

    const payload = {
      booking_date: form.booking_date,
      notes: form.notes || undefined,
      services: serviceLines,
      ...(form.client_type === 'registered'
        ? { client_id: form.client_id }
        : { guest_name: form.guest_name, guest_phone: form.guest_phone }),
    };

    setBookingSubmitting(true);
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create booking'); return; }
      toast.success(serviceLines.length > 1 ? `${serviceLines.length} bookings created!` : 'Booking created!');
      setShowNewModal(false);
      setForm({ client_type: 'registered', client_id: '', guest_name: '', guest_phone: '', booking_date: localDateStr(), notes: '' });
      setServiceLines([{ service_id: '', staff_id: '', start_time: '' }]);
      setSlotsMap({});
      loadBookings();
    } catch {
      toast.error('Failed to create booking');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // ── Update booking status ──
  const updateStatus = (id: string, status: BookingStatus, reason?: string) =>
    run(`status:${id}`, async () => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellation_reason: reason }),
      });
      if (!res.ok) { toast.error('Failed to update booking'); return; }
      toast.success(`Booking ${status}`);
      setShowDetailModal(false);
      loadBookings();
    });

  // ── Reschedule ──
  const openReschedule = () => {
    if (!selectedBooking) return;
    const d = selectedBooking.booking_date.split('T')[0];
    setRescheduleDate(d);
    setRescheduleTime('');
    setRescheduleSlots([]);
    setRescheduleMode(true);
  };

  const fetchRescheduleSlots = useCallback(async () => {
    if (!selectedBooking || !rescheduleDate) return;
    setRescheduleLoading(true);
    try {
      const params = new URLSearchParams({ date: rescheduleDate, service_id: selectedBooking.service_id, staff_id: selectedBooking.staff_id });
      const res = await fetch(`/api/bookings/availability?${params}`);
      if (res.ok) {
        const d = await res.json();
        setRescheduleSlots(d.staff_availability ?? []);
      }
    } catch {
      toast.error('Failed to load slots');
    } finally {
      setRescheduleLoading(false);
    }
  }, [rescheduleDate, selectedBooking]);

  useEffect(() => {
    if (rescheduleMode) fetchRescheduleSlots();
  }, [rescheduleMode, fetchRescheduleSlots]);

  const handleReschedule = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) return;
    setRescheduleSaving(true);
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: rescheduleDate, start_time: rescheduleTime }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to reschedule');
        return;
      }
      toast.success('Booking rescheduled');
      setRescheduleMode(false);
      setShowDetailModal(false);
      loadBookings();
    } catch {
      toast.error('Failed to reschedule');
    } finally {
      setRescheduleSaving(false);
    }
  };

  // ── Staff schedules ──
  const loadSchedules = async (sId: string) => {
    setScheduleStaffId(sId);
    const res = await fetch(`/api/bookings/schedules?staff_id=${sId}`);
    if (res.ok) {
      const data = await res.json();
      // Merge with all 7 days
      const map = Object.fromEntries(data.map((s: StaffSchedule) => [s.day_of_week, s]));
      const full = Array.from({ length: 7 }, (_, i) => map[i] ?? { day_of_week: i, start_time: '07:00', end_time: '23:00', is_available: false });
      setSchedules(full as StaffSchedule[]);
    }
    setShowScheduleModal(true);
  };

  const saveSchedules = () => run('saveSchedule', async () => {
    const res = await fetch('/api/bookings/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: scheduleStaffId, schedules }),
    });
    if (res.ok) { toast.success('Schedule saved!'); setShowScheduleModal(false); }
    else toast.error('Failed to save schedule');
  });

  const isManager = user && ['owner', 'admin', 'manager'].includes(user.role);

  const printBooking = useCallback((b: Booking) => {
    const salonName = salon?.name || 'Salon';
    const bc = salon?.theme_primary_color || '#E31C23';
    const logoUrl = salon?.logo_url || '';
    const slogan = salon?.slogan || '';
    const salonPhone = salon?.phone || '';
    const salonAddress = salon?.address || '';
    const initial = salonName.charAt(0).toUpperCase();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${salonName}" class="salon-logo" />`
      : `<div class="logo-placeholder" style="background:${bc}">${initial}</div>`;

    const clientName = b.client_name ?? b.guest_name ?? '—';
    const clientPhone = b.client_phone ?? b.guest_phone ?? '';
    const bookingDate = (() => {
      const base = b.booking_date.split('T')[0];
      const [y, m, d] = base.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    })();

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Booking — ${clientName} — ${salonName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; background: #f3f4f6; display: flex; justify-content: center; padding: 40px 20px; }
  .slip { background: #fff; border-radius: 16px; width: 400px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
  .slip-top { background: ${bc}; padding: 28px 24px 20px; text-align: center; color: #fff; }
  .salon-logo { max-height: 56px; max-width: 160px; object-fit: contain; margin-bottom: 10px; filter: brightness(0) invert(1); }
  .logo-placeholder { width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.25); color: #fff; font-size: 24px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; }
  .salon-name { font-size: 18px; font-weight: 700; }
  .salon-slogan { font-size: 11px; opacity: 0.8; margin-top: 2px; font-style: italic; }
  .slip-label { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.75; margin-top: 14px; }
  .slip-body { padding: 24px; }
  .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; margin-bottom: 10px; }
  .detail-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; font-size: 13px; }
  .detail-label { color: #6b7280; flex-shrink: 0; }
  .detail-value { font-weight: 600; color: #111; text-align: right; }
  .divider { border: none; border-top: 1px solid #f3f4f6; margin: 16px 0; }
  .highlight-box { background: ${bc}10; border: 1.5px solid ${bc}30; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; text-align: center; }
  .highlight-date { font-size: 18px; font-weight: 700; color: ${bc}; }
  .highlight-time { font-size: 14px; color: #374151; margin-top: 4px; }
  .notes-box { background: #f9fafb; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #6b7280; font-style: italic; margin-top: 8px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .status-confirmed { background: #dcfce7; color: #15803d; }
  .status-pending { background: #fef9c3; color: #854d0e; }
  .status-completed { background: #f3f4f6; color: #374151; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }
  .status-no_show { background: #fef3c7; color: #92400e; }
  .slip-footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 14px 20px; text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.6; }
  @media print { body { background: none; padding: 0; } .slip { box-shadow: none; border-radius: 0; width: 100%; } }
</style>
</head>
<body>
<div class="slip">
  <div class="slip-top">
    ${logoHtml}
    <div class="salon-name">${salonName}</div>
    ${slogan ? `<div class="salon-slogan">${slogan}</div>` : ''}
    <div class="slip-label">Appointment Confirmation</div>
  </div>
  <div class="slip-body">
    <div class="highlight-box">
      <div class="highlight-date">${bookingDate}</div>
      <div class="highlight-time">${b.start_time.slice(0, 5)} – ${b.end_time.slice(0, 5)}</div>
    </div>

    <p class="section-title">Client</p>
    <div class="detail-row">
      <span class="detail-label">Name</span>
      <span class="detail-value">${clientName}</span>
    </div>
    ${clientPhone ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${clientPhone}</span></div>` : ''}

    <hr class="divider"/>

    <p class="section-title">Appointment</p>
    <div class="detail-row">
      <span class="detail-label">Service</span>
      <span class="detail-value">${b.service_name ?? '—'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">With</span>
      <span class="detail-value">${b.staff_name ?? '—'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span class="detail-value"><span class="status-badge status-${b.status}">${STATUS_META[b.status]?.label ?? b.status}</span></span>
    </div>

    ${b.notes ? `<hr class="divider"/><p class="section-title">Notes</p><div class="notes-box">${b.notes}</div>` : ''}
  </div>
  <div class="slip-footer">
    ${salonPhone ? `📞 ${salonPhone}` : ''}
    ${salonAddress ? `<br>${salonAddress}` : ''}
    <br>Please arrive 5 minutes before your appointment
  </div>
</div>
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups to print'); return; }
    win.document.write(html);
    win.document.close();
  }, [salon]);

  const printBookings = useCallback(() => {
    if (bookings.length === 0) return;
    const salonName = salon?.name || 'Salon';
    const bc = salon?.theme_primary_color || '#E31C23';
    const logoUrl = salon?.logo_url || '';
    const initial = salonName.charAt(0).toUpperCase();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${salonName}" class="salon-logo" />`
      : `<div class="logo-placeholder" style="background:${bc}">${initial}</div>`;

    const printDate = new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });

    // Group by date
    const byDate: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const base = b.booking_date.split('T')[0];
      if (!byDate[base]) byDate[base] = [];
      byDate[base].push(b);
    }

    const rows = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([dateStr, list]) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const label = new Date(y, m - 1, d).toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const tableRows = list.map(b => `
        <tr>
          <td>${b.start_time.slice(0, 5)} – ${b.end_time.slice(0, 5)}</td>
          <td><strong>${b.client_name ?? b.guest_name ?? '—'}</strong>${b.client_phone ?? b.guest_phone ? `<br><span class="phone">${b.client_phone ?? b.guest_phone}</span>` : ''}</td>
          <td>${b.service_name ?? '—'}</td>
          <td>${b.staff_name ?? '—'}</td>
          <td><span class="badge badge-${b.status}">${STATUS_META[b.status]?.label ?? b.status}</span></td>
        </tr>`).join('');
      return `
        <div class="date-section">
          <h2 class="date-heading">${label}</h2>
          <table>
            <thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Status</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Bookings Schedule — ${salonName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 28px; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid ${bc}; }
  .salon-logo { max-height: 56px; max-width: 160px; object-fit: contain; }
  .logo-placeholder { width: 52px; height: 52px; border-radius: 50%; color: #fff; font-size: 22px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .header-text .name { font-size: 20px; font-weight: 700; color: ${bc}; }
  .header-text .sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .date-section { margin-bottom: 24px; }
  .date-heading { font-size: 13px; font-weight: 700; color: ${bc}; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 600; color: #6b7280; text-align: left; padding: 5px 8px; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .phone { font-size: 10px; color: #9ca3af; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
  .badge-confirmed { background: #dcfce7; color: #15803d; }
  .badge-pending { background: #fef9c3; color: #854d0e; }
  .badge-completed { background: #f3f4f6; color: #374151; }
  .badge-cancelled { background: #fee2e2; color: #991b1b; }
  .badge-no_show { background: #fef3c7; color: #92400e; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
<div class="header">
  ${logoHtml}
  <div class="header-text">
    <div class="name">${salonName}</div>
    <div class="sub">Bookings Schedule · Printed ${printDate}</div>
  </div>
</div>
${rows}
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups to print'); return; }
    win.document.write(html);
    win.document.close();
  }, [bookings, salon]);

  const formatBookingDate = (dateValue?: string) => {
    if (!dateValue) return '—';
    const baseDate = dateValue.split('T')[0];
    const [y, m, d] = baseDate.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Bookings" />
      <PageGroupTabs tabs={CLIENT_TABS} />

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-4 pb-28 md:pb-6">
        <div className="flex flex-col gap-3 mb-4">
          {/* Row 1: period pills + action buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'today', label: 'Today',        fn: applyToday },
                { key: 'week',  label: 'This Week',    fn: applyWeek  },
                { key: 'month', label: 'This Month',   fn: applyMonth },
                { key: 'range', label: 'Custom Range', fn: () => setActivePeriod('range') },
              ] as const).map(({ key, label, fn }) => (
                <button
                  key={key}
                  type="button"
                  onClick={fn}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    activePeriod === key
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                  style={activePeriod === key ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              {bookings.length > 0 && (
                <button
                  onClick={printBookings}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-medium w-full sm:w-auto flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Schedule
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => {
                    setScheduleStaffId(staffOptions[0]?.id ?? '');
                    if (staffOptions[0]) loadSchedules(staffOptions[0].id);
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-medium w-full sm:w-auto"
                >
                  Manage Schedules
                </button>
              )}
              <BrandButton onClick={() => setShowNewModal(true)} className="px-4 py-2 rounded text-sm w-full sm:w-auto">
                + New Booking
              </BrandButton>
            </div>
          </div>

          {/* Row 2: date input(s) + status + staff */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            {activePeriod === 'today' ? (
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value); }}
                className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
              />
            ) : (
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onFromChange={v => { setDateFrom(v); setActivePeriod('range'); }}
                onToChange={v => { setDateTo(v); setActivePeriod('range'); }}
              />
            )}

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select
              value={staffFilter}
              onChange={e => setStaffFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
            >
              <option value="">All staff</option>
              {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Summary counts */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {Object.entries(STATUS_META).map(([k, v]) => {
            const count = bookings.filter(b => b.status === k).length;
            return (
              <span key={k} className={`px-3 py-1 rounded-full text-xs font-semibold ${v.color}`}>
                {v.label}: {count}
              </span>
            );
          })}
        </div>

        {/* Bookings list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No bookings found for the selected filters.</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  {activePeriod !== 'today' && <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>}
                  <th className="px-4 py-3 text-left whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Service</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Staff</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedBooking(b); setShowDetailModal(true); }}>
                    {activePeriod !== 'today' && (
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatBookingDate(b.booking_date)}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.client_name ?? b.guest_name ?? '—'}</div>
                      <div className="text-gray-400 text-xs">{b.client_phone ?? b.guest_phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.service_name}</td>
                    <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{b.staff_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[b.status].color}`}>
                        {STATUS_META[b.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {b.status === 'pending' && (
                          <button disabled={isPending(`status:${b.id}`)} onClick={() => updateStatus(b.id, 'confirmed')} className="text-xs text-white px-2 py-1 rounded disabled:opacity-50" style={{ backgroundColor: brandColor }}>
                            Confirm
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button disabled={isPending(`status:${b.id}`)} onClick={() => updateStatus(b.id, 'completed')} className="text-xs text-white px-2 py-1 rounded disabled:opacity-50" style={{ backgroundColor: brandColor }}>
                            Complete
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button disabled={isPending(`status:${b.id}`)} onClick={() => updateStatus(b.id, 'cancelled')} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* ── New Booking Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">New Booking</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Client type toggle */}
              <div className="flex gap-2">
                {(['registered', 'guest'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, client_type: t }))}
                    className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${form.client_type === t ? 'text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                    style={form.client_type === t ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {t === 'registered' ? 'Existing Client' : 'Walk-in / Guest'}
                  </button>
                ))}
              </div>

              {form.client_type === 'registered' ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  {form.client_id ? (
                    <div className="flex items-center justify-between border rounded px-3 py-2 text-sm bg-gray-50">
                      <span className="font-medium text-gray-900">
                        {clients.find(c => c.id === form.client_id)?.name} — {clients.find(c => c.id === form.client_id)?.phone}
                      </span>
                      <button type="button" onClick={() => { setForm(f => ({ ...f, client_id: '' })); setClientSearch(''); }} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search by name or phone..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          onFocus={() => setClientSearchFocused(true)}
                          onBlur={() => setTimeout(() => setClientSearchFocused(false), 150)}
                          className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                          autoComplete="off"
                        />
                      </div>
                      {clientSearchFocused && (() => {
                        const q = clientSearch.toLowerCase().trim();
                        const filtered = q.length >= 1
                          ? clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
                          : clients;
                        return (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filtered.length > 0 ? filtered.slice(0, 50).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(''); }}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                              >
                                <span className="font-medium text-gray-900">{c.name}</span>
                                <span className="text-gray-400 ml-2">{c.phone}</span>
                              </button>
                            )) : (
                              <div className="px-3 py-2 text-sm text-gray-400 italic">No clients found</div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                  <button type="button" onClick={() => setShowNewClientModal(true)} className="mt-1 text-sm text-brand-primary hover:underline">+ New Client</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                    <input required value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                    <input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input required type="date" min={localDateStr()} value={form.booking_date} onChange={e => { setForm(f => ({ ...f, booking_date: e.target.value })); setServiceLines(prev => prev.map(l => ({ ...l, start_time: '' }))); }} className="w-full border rounded px-3 py-2 text-sm" />
              </div>

              {/* Service Lines */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Services</label>
                  <button type="button" onClick={addLine} className="text-xs font-medium px-2 py-1 rounded" style={{ color: brandColor }}>
                    + Add Service
                  </button>
                </div>

                {serviceLines.map((line, idx) => {
                  const lineSlots = slotsMap[idx] ?? [];
                  const isLoadingLine = loadingSlots[idx] ?? false;
                  return (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-3 relative">
                      {serviceLines.length > 1 && (
                        <button type="button" onClick={() => removeLine(idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors" title="Remove service">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {serviceLines.length > 1 && (
                        <p className="text-xs font-semibold text-gray-400">Service {idx + 1}</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Service</label>
                          <select required value={line.service_id} onChange={e => updateLine(idx, { service_id: e.target.value, start_time: '' })} className="w-full border rounded px-3 py-2 text-sm">
                            <option value="">Select service…</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} min</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Staff</label>
                          <select value={line.staff_id} onChange={e => updateLine(idx, { staff_id: e.target.value, start_time: '' })} className="w-full border rounded px-3 py-2 text-sm">
                            <option value="">Any staff</option>
                            {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Slots for this service line */}
                      {line.service_id && form.booking_date && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Available Slots</label>
                          {isLoadingLine ? (
                            <p className="text-xs text-gray-400">Loading slots…</p>
                          ) : lineSlots.length === 0 ? (
                            <p className="text-xs text-red-500">No available slots for this date.</p>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-y-auto">
                              {lineSlots.map(sa => (
                                <div key={sa.staff_id}>
                                  {!line.staff_id && <p className="text-xs font-semibold text-gray-400 mb-1">{sa.staff_name}</p>}
                                  <div className="flex flex-wrap gap-1.5">
                                    {sa.slots.length === 0 && <span className="text-xs text-gray-400">No slots</span>}
                                    {sa.slots.map(slot => {
                                      const isSelected = line.start_time === slot && (line.staff_id === sa.staff_id || !line.staff_id);
                                      return (
                                        <button
                                          key={slot}
                                          type="button"
                                          onClick={() => updateLine(idx, { staff_id: line.staff_id || sa.staff_id, start_time: slot })}
                                          className={`px-2.5 py-1 rounded text-xs border transition-colors ${isSelected ? 'text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                                          style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                                        >
                                          {slot}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={bookingSubmitting || serviceLines.some(l => !l.start_time || !l.service_id || !l.staff_id)} className="flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: brandColor }}>
                  {bookingSubmitting ? 'Booking...' : `Book Appointment${serviceLines.length > 1 ? `s (${serviceLines.length})` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Booking Details</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => printBooking(selectedBooking)}
                  title="Print booking slip"
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <button onClick={() => { setShowDetailModal(false); setRescheduleMode(false); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">{selectedBooking.client_name ?? selectedBooking.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span>{selectedBooking.client_phone ?? selectedBooking.guest_phone ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Service</span>
                <span>{selectedBooking.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Staff</span>
                <span>{selectedBooking.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{formatBookingDate(selectedBooking.booking_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span>{selectedBooking.start_time.slice(0,5)} – {selectedBooking.end_time.slice(0,5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[selectedBooking.status].color}`}>
                  {STATUS_META[selectedBooking.status].label}
                </span>
              </div>
              {selectedBooking.notes && (
                <div className="pt-1">
                  <p className="text-gray-500 text-xs mb-1">Notes</p>
                  <p className="bg-gray-50 rounded p-2">{selectedBooking.notes}</p>
                </div>
              )}

              {isManager && (selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') && (
                <>
                  {/* Reschedule section */}
                  {rescheduleMode ? (
                    <div className="pt-3 border-t space-y-3">
                      <p className="text-xs font-semibold text-gray-500">Reschedule</p>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">New Date</label>
                        <input
                          type="date"
                          min={localDateStr()}
                          value={rescheduleDate}
                          onChange={e => { setRescheduleDate(e.target.value); setRescheduleTime(''); }}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">New Time</label>
                        {rescheduleLoading ? (
                          <p className="text-xs text-gray-400">Loading slots…</p>
                        ) : rescheduleSlots.length === 0 ? (
                          <p className="text-xs text-red-500">No available slots for this date.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {rescheduleSlots.flatMap(sa => sa.slots).map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setRescheduleTime(slot)}
                                className={`px-2.5 py-1 rounded text-xs border transition-colors ${rescheduleTime === slot ? 'text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                                style={rescheduleTime === slot ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setRescheduleMode(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-200">Back</button>
                        <button
                          onClick={handleReschedule}
                          disabled={!rescheduleTime || rescheduleSaving}
                          className="flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: brandColor }}
                        >
                          {rescheduleSaving ? 'Saving…' : 'Confirm Reschedule'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t">
                      {selectedBooking.status === 'pending' && (
                        <button disabled={isPending(`status:${selectedBooking.id}`)} onClick={() => updateStatus(selectedBooking.id, 'confirmed')} className="text-white py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>{isPending(`status:${selectedBooking.id}`) ? 'Updating…' : 'Confirm'}</button>
                      )}
                      <button disabled={isPending(`status:${selectedBooking.id}`)} onClick={() => updateStatus(selectedBooking.id, 'completed')} className="text-white py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>{isPending(`status:${selectedBooking.id}`) ? 'Updating…' : 'Complete'}</button>
                      <button onClick={openReschedule} className="py-2 rounded text-sm font-medium bg-gray-50 hover:bg-gray-100" style={{ color: brandColor }}>Reschedule</button>
                      <button disabled={isPending(`status:${selectedBooking.id}`)} onClick={() => updateStatus(selectedBooking.id, 'no_show')} className="bg-gray-400 text-white py-2 rounded text-sm font-medium hover:bg-gray-500 disabled:opacity-50">No Show</button>
                    </div>
                  )}
                </>
              )}
              {user && user.role !== 'viewer' && (selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') && !rescheduleMode && (
                <div className="pt-3 border-t">
                  <button disabled={isPending(`status:${selectedBooking.id}`)} onClick={() => updateStatus(selectedBooking.id, 'cancelled')} className="w-full bg-gray-200 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50">Cancel Booking</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Staff Weekly Schedule</h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select value={scheduleStaffId} onChange={e => loadSchedules(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Select staff…</option>
                  {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {schedules.length > 0 && (
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[360px]">
                  <thead className="text-xs uppercase text-gray-500 border-b">
                    <tr>
                      <th className="py-2 text-left">Day</th>
                      <th className="py-2 text-left">Available</th>
                      <th className="py-2 text-left">Start</th>
                      <th className="py-2 text-left">End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {schedules.map((s, i) => (
                      <tr key={s.day_of_week}>
                        <td className="py-2 font-medium">{DAY_NAMES[s.day_of_week]}</td>
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={s.is_available}
                            onChange={e => {
                              const updated = [...schedules];
                              updated[i] = { ...s, is_available: e.target.checked };
                              setSchedules(updated);
                            }}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="time"
                            value={s.start_time}
                            disabled={!s.is_available}
                            onChange={e => {
                              const updated = [...schedules];
                              updated[i] = { ...s, start_time: e.target.value };
                              setSchedules(updated);
                            }}
                            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="time"
                            value={s.end_time}
                            disabled={!s.is_available}
                            onChange={e => {
                              const updated = [...schedules];
                              updated[i] = { ...s, end_time: e.target.value };
                              setSchedules(updated);
                            }}
                            className="border rounded px-2 py-1 text-sm disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowScheduleModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={saveSchedules} disabled={!scheduleStaffId || isPending('saveSchedule')} className="flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>{isPending('saveSchedule') ? 'Saving…' : 'Save Schedule'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onClientCreated={(client) => {
            setClients(prev => [{ id: client.id, name: client.name, phone: client.phone }, ...prev]);
            setForm(f => ({ ...f, client_id: client.id }));
            setClientSearch('');
            setShowNewClientModal(false);
            toast.success('Client created successfully');
          }}
        />
      )}
    </div>
  );
}
