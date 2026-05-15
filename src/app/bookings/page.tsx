'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader, BrandButton } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useModalEsc } from '@/contexts/EscContext';
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

  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom]         = useState<string>(todayStr);
  const [dateTo, setDateTo]             = useState<string>(todayStr);
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month' | 'range'>('today');

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
  const [availableSlots, setAvailableSlots] = useState<{ staff_id: string; staff_name: string; slots: string[] }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({
    client_type: 'registered' as 'registered' | 'guest',
    client_id: '',
    guest_name: '',
    guest_phone: '',
    service_id: '',
    staff_id: '',
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '',
    notes: '',
  });

  // Schedule modal state
  const [scheduleStaffId, setScheduleStaffId] = useState('');
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);

  useModalEsc(showNewModal, () => setShowNewModal(false));
  useModalEsc(showDetailModal, () => setShowDetailModal(false));
  useModalEsc(showScheduleModal, () => setShowScheduleModal(false));

  // ── Period helpers ──
  const applyToday = useCallback(() => {
    const d = new Date().toISOString().split('T')[0];
    setDateFrom(d); setDateTo(d); setActivePeriod('today');
  }, []);

  const applyWeek = useCallback(() => {
    const now = new Date();
    const dow = now.getDay(); // 0 = Sunday
    const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    setDateFrom(mon.toISOString().split('T')[0]);
    setDateTo(sun.toISOString().split('T')[0]);
    setActivePeriod('week');
  }, []);

  const applyMonth = useCallback(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(first.toISOString().split('T')[0]);
    setDateTo(last.toISOString().split('T')[0]);
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

  // ── Availability ──
  const fetchSlots = useCallback(async () => {
    if (!form.service_id || !form.booking_date) return;
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({ date: form.booking_date, service_id: form.service_id });
      if (form.staff_id) params.set('staff_id', form.staff_id);
      const res = await fetch(`/api/bookings/availability?${params}`);
      if (res.ok) {
        const d = await res.json();
        setAvailableSlots(d.staff_availability ?? []);
      }
    } catch {
      toast.error('Failed to load available slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [form.service_id, form.booking_date, form.staff_id]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // ── Create booking ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      service_id: form.service_id,
      staff_id: form.staff_id,
      booking_date: form.booking_date,
      start_time: form.start_time,
      notes: form.notes || undefined,
      ...(form.client_type === 'registered'
        ? { client_id: form.client_id }
        : { guest_name: form.guest_name, guest_phone: form.guest_phone }),
    };

    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create booking'); return; }
      toast.success('Booking created!');
      setShowNewModal(false);
      setForm({ client_type: 'registered', client_id: '', guest_name: '', guest_phone: '', service_id: '', staff_id: '', booking_date: new Date().toISOString().split('T')[0], start_time: '', notes: '' });
      loadBookings();
    } catch {
      toast.error('Failed to create booking');
    }
  };

  // ── Update booking status ──
  const updateStatus = async (id: string, status: BookingStatus, reason?: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, cancellation_reason: reason }),
      });
      if (!res.ok) { toast.error('Failed to update booking'); return; }
      toast.success(`Booking ${status}`);
      setShowDetailModal(false);
      loadBookings();
    } catch {
      toast.error('Failed to update booking');
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
      const full = Array.from({ length: 7 }, (_, i) => map[i] ?? { day_of_week: i, start_time: '09:00', end_time: '18:00', is_available: false });
      setSchedules(full as StaffSchedule[]);
    }
    setShowScheduleModal(true);
  };

  const saveSchedules = async () => {
    const res = await fetch('/api/bookings/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_id: scheduleStaffId, schedules }),
    });
    if (res.ok) { toast.success('Schedule saved!'); setShowScheduleModal(false); }
    else toast.error('Failed to save schedule');
  };

  const isManager = user && ['owner', 'admin', 'manager'].includes(user.role);

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Bookings" />

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
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setActivePeriod('range'); }}
                  className="border rounded px-3 py-2 text-sm"
                />
                <span className="text-gray-400 text-sm">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setActivePeriod('range'); }}
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>
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
                        {new Date(b.booking_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
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
                          <button onClick={() => updateStatus(b.id, 'confirmed')} className="text-xs text-white px-2 py-1 rounded" style={{ backgroundColor: brandColor }}>
                            Confirm
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button onClick={() => updateStatus(b.id, 'completed')} className="text-xs text-white px-2 py-1 rounded" style={{ backgroundColor: brandColor }}>
                            Complete
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button onClick={() => updateStatus(b.id, 'cancelled')} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <select required value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                  </select>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                <select required value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value, start_time: '' }))} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Select service…</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} min</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input required type="date" min={new Date().toISOString().split('T')[0]} value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value, start_time: '' }))} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff (optional)</label>
                  <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value, start_time: '' }))} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="">Any staff</option>
                    {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Available slots */}
              {form.service_id && form.booking_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Slots</label>
                  {loadingSlots ? (
                    <p className="text-sm text-gray-400">Loading slots…</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-sm text-red-500">No available slots for this date.</p>
                  ) : (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {availableSlots.map(sa => (
                        <div key={sa.staff_id}>
                          {!form.staff_id && <p className="text-xs font-semibold text-gray-500 mb-1">{sa.staff_name}</p>}
                          <div className="flex flex-wrap gap-2">
                            {sa.slots.length === 0 && <span className="text-xs text-gray-400">No slots available</span>}
                            {sa.slots.map(slot => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, staff_id: f.staff_id || sa.staff_id, start_time: slot }))}
                                className={`px-3 py-1 rounded text-sm border transition-colors ${form.start_time === slot && (form.staff_id === sa.staff_id || !form.staff_id) ? 'text-white' : 'bg-white text-gray-700 border-gray-300'}`}
                                style={form.start_time === slot && (form.staff_id === sa.staff_id || !form.staff_id) ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={!form.start_time} className="flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: brandColor }}>
                  Book Appointment
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
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
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
                <span>{selectedBooking.booking_date}</span>
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
                <div className="flex flex-wrap gap-2 pt-3 border-t">
                  {selectedBooking.status === 'pending' && (
                    <button onClick={() => updateStatus(selectedBooking.id, 'confirmed')} className="flex-1 text-white py-2 rounded text-sm font-medium" style={{ backgroundColor: brandColor }}>Confirm</button>
                  )}
                  <button onClick={() => updateStatus(selectedBooking.id, 'completed')} className="flex-1 text-white py-2 rounded text-sm font-medium" style={{ backgroundColor: brandColor }}>Mark Complete</button>
                  <button onClick={() => updateStatus(selectedBooking.id, 'no_show')} className="flex-1 bg-gray-400 text-white py-2 rounded text-sm font-medium hover:bg-gray-500">No Show</button>
                  <button onClick={() => updateStatus(selectedBooking.id, 'cancelled')} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded text-sm font-medium hover:bg-gray-300">Cancel</button>
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
                <button onClick={saveSchedules} disabled={!scheduleStaffId} className="flex-1 text-white py-2 rounded text-sm font-medium disabled:opacity-50" style={{ backgroundColor: brandColor }}>Save Schedule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
