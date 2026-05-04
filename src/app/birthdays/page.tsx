'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { useSalon } from '@/contexts/SalonContext';

interface BirthdayClient {
  id: string;
  name: string;
  phone: string;
  birthday: string;
  loyalty_points: number;
  total_visits: number;
  messages_this_year: {
    id: string;
    message_text: string;
    discount_percent: number | null;
    status: string;
    sent_at: string;
  }[];
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function renderTemplate(template: string, clientName: string, salonName: string, discountPercent?: number): string {
  return template
    .replaceAll('{clientName}', clientName)
    .replaceAll('{salonName}', salonName)
    .replaceAll('{discountPercent}', discountPercent ? String(discountPercent) : '');
}

function birthdayDay(birthday: string): number {
  return parseInt(birthday.split('-')[2], 10);
}

function birthYear(birthday: string): number {
  return parseInt(birthday.split('-')[0], 10);
}

export default function BirthdaysPage() {
  const router     = useRouter();
  const { salon }  = useSalon();
  const now        = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [clients, setClients] = useState<BirthdayClient[]>([]);
  const [loading, setLoading] = useState(true);

  const [defaultTemplate,    setDefaultTemplate]    = useState('');
  const [defaultDiscount,    setDefaultDiscount]    = useState(0);
  const [smsEnabled,         setSmsEnabled]         = useState(true);
  const [settingsLoaded,     setSettingsLoaded]     = useState(false);

  const [sendModal,    setSendModal]    = useState<BirthdayClient | null>(null);
  const [message,      setMessage]      = useState('');
  const [withDiscount, setWithDiscount] = useState(false);
  const [discountPct,  setDiscountPct]  = useState(0);
  const [sending,      setSending]      = useState(false);

  const loadSettings = useCallback(async () => {
    if (settingsLoaded) return;
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const d = await res.json();
        setDefaultTemplate(d.birthday_sms_template || 'Happy Birthday {clientName}! 🎂 The entire team at {salonName} wishes you a wonderful birthday. We look forward to celebrating with you soon!');
        setDefaultDiscount(d.birthday_discount_percent ?? 0);
        setSmsEnabled(d.birthday_sms_enabled !== false);
      }
      setSettingsLoaded(true);
    } catch { /* silently ignore */ }
  }, [settingsLoaded]);

  const loadBirthdays = useCallback(async (m: number, y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/birthdays?month=${m}&year=${y}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error('Failed to load birthdays'); return; }
      setClients(await res.json());
    } catch {
      toast.error('Failed to load birthdays');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadBirthdays(month, year); }, [month, year, loadBirthdays]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const openSendModal = (client: BirthdayClient) => {
    const rendered = renderTemplate(defaultTemplate, client.name, salon?.name || 'the salon');
    setMessage(rendered);
    setWithDiscount(false);
    setDiscountPct(defaultDiscount);
    setSendModal(client);
  };

  const openDiscountModal = (client: BirthdayClient) => {
    const discountTemplate = defaultDiscount > 0
      ? renderTemplate(defaultTemplate, client.name, salon?.name || 'the salon', defaultDiscount)
        + (defaultTemplate.includes('{discountPercent}') ? '' : ` Enjoy ${defaultDiscount}% off on your next visit! 🎁`)
      : renderTemplate(defaultTemplate, client.name, salon?.name || 'the salon');
    setMessage(discountTemplate);
    setWithDiscount(true);
    setDiscountPct(defaultDiscount > 0 ? defaultDiscount : 15);
    setSendModal(client);
  };

  const handleSend = async () => {
    if (!sendModal || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/birthdays/${sendModal.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_text: message,
          discount_percent: withDiscount ? discountPct : null,
        }),
      });
      const data = await res.json();
      if (res.ok || res.status === 207) {
        if (data.status === 'failed') {
          toast.error('Message logged but SMS delivery failed');
        } else {
          toast.success(`Birthday wish sent to ${sendModal.name}! 🎂`);
        }
        setSendModal(null);
        await loadBirthdays(month, year);
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send birthday wish');
    } finally {
      setSending(false);
    }
  };

  const todayDay   = now.getDate();
  const isThisMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const todayBirthdays    = clients.filter(c => birthdayDay(c.birthday) === todayDay && isThisMonth);
  const sentCount         = clients.filter(c => c.messages_this_year.length > 0).length;
  const pendingCount      = clients.length - sentCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader />
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Birthday Alerts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Send personalised birthday wishes and discount offers</p>
          </div>
          <Link href="/settings?tab=birthday" className="text-sm text-brand-primary hover:underline font-medium">
            Configure templates →
          </Link>
        </div>

        {/* Month navigation */}
        <div className="card flex items-center justify-between py-3">
          <button onClick={prevMonth} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{MONTH_NAMES[month - 1]} {year}</p>
            {isThisMonth && <p className="text-xs text-brand-primary font-medium">Current month</p>}
          </div>
          <button onClick={nextMonth} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card text-center border-t-4 border-amber-400">
            <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Birthdays</p>
          </div>
          <div className="card text-center border-t-4 border-green-400">
            <p className="text-2xl font-bold text-green-600">{sentCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Wishes Sent</p>
          </div>
          <div className="card text-center border-t-4 border-orange-400">
            <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </div>
          <div className="card text-center border-t-4 border-rose-400">
            <p className="text-2xl font-bold text-rose-600">{todayBirthdays.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Today 🎂</p>
          </div>
        </div>

        {/* Today's birthdays highlight */}
        {isThisMonth && todayBirthdays.length > 0 && (
          <div className="card bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">🎉 Today&apos;s Birthdays</p>
            <div className="flex flex-wrap gap-2">
              {todayBirthdays.map(c => (
                <button
                  key={c.id}
                  onClick={() => openSendModal(c)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-full text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  {c.name}
                  {c.messages_this_year.length > 0 && <span className="text-green-600 text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SMS disabled banner */}
        {!smsEnabled && (
          <div className="card bg-orange-50 border border-orange-200 flex items-center gap-3 p-4">
            <svg className="w-5 h-5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-sm text-orange-800">
              Birthday SMS is currently <strong>disabled</strong>.{' '}
              <Link href="/settings?tab=birthday" className="underline font-medium">Enable it in Settings → Birthdays</Link> to send wishes.
            </p>
          </div>
        )}

        {/* Birthday list */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {MONTH_NAMES[month - 1]} Birthdays
            </h2>
            <span className="text-sm text-gray-400">{clients.length} client{clients.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : clients.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🎂</p>
              <p className="font-medium text-gray-600">No birthdays in {MONTH_NAMES[month - 1]}</p>
              <p className="text-sm text-gray-400 mt-1">Clients need a birthday date set on their profile</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clients.map(client => {
                const day         = birthdayDay(client.birthday);
                const bYear       = birthYear(client.birthday);
                const age         = bYear > 1900 ? year - bYear : null;
                const isToday     = isThisMonth && day === todayDay;
                const alreadySent = client.messages_this_year.length > 0;

                return (
                  <div key={client.id} className={`p-4 ${isToday ? 'bg-amber-50' : 'hover:bg-gray-50'} transition-colors`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${isToday ? 'bg-amber-500' : 'bg-brand-primary/80'}`}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-brand-primary">
                            {client.name}
                          </Link>
                          {isToday && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">🎂 Today!</span>}
                          {alreadySent && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              ✓ {client.messages_this_year.length} wish{client.messages_this_year.length > 1 ? 'es' : ''} sent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {client.phone} · 🎂 {MONTH_NAMES[month - 1]} {day}{age ? ` · Turning ${age}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {client.total_visits} visit{client.total_visits !== 1 ? 's' : ''} · {client.loyalty_points} pts
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => smsEnabled && openSendModal(client)}
                          disabled={!smsEnabled}
                          title={!smsEnabled ? 'Birthday SMS is disabled in Settings' : ''}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Send Wish
                        </button>
                        <button
                          onClick={() => smsEnabled && openDiscountModal(client)}
                          disabled={!smsEnabled}
                          title={!smsEnabled ? 'Birthday SMS is disabled in Settings' : ''}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          + Discount
                        </button>
                      </div>
                    </div>

                    {/* Previous messages */}
                    {alreadySent && (
                      <div className="mt-2 ml-13 pl-13 space-y-1">
                        {client.messages_this_year.map(msg => (
                          <div key={msg.id} className="ml-13 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                            <svg className="w-3 h-3 mt-0.5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <span className="line-clamp-1">{msg.message_text}</span>
                              {msg.discount_percent && (
                                <span className="inline-block mt-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {msg.discount_percent}% discount included
                                </span>
                              )}
                            </div>
                            <span className="text-gray-300 shrink-0">{new Date(msg.sent_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Send Birthday Modal ── */}
      {sendModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSendModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold shrink-0">
                  {sendModal.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Send Birthday Wish</h3>
                  <p className="text-sm text-gray-500">{sendModal.name} · {sendModal.phone}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWithDiscount(p => !p)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${withDiscount ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${withDiscount ? 'left-4' : 'left-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">Include discount offer</span>
              </div>

              {withDiscount && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={discountPct}
                        onChange={e => setDiscountPct(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center font-bold"
                      />
                      <span className="text-sm text-gray-600 font-medium">% off</span>
                    </div>
                  </div>
                  <p className="text-xs text-green-700 flex-1">
                    This discount will be noted in the client&apos;s birthday message log. Apply it manually at checkout.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMessage(renderTemplate(defaultTemplate, sendModal.name, salon?.name || 'the salon', withDiscount ? discountPct : undefined))}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset to default template
              </button>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setSendModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#F59E0B' }}
              >
                {sending ? 'Sending…' : `Send SMS 🎂`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
