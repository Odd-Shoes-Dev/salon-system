'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export interface ClientModalClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  gender?: string;
  location?: string;
}

export function ClientModal({
  client,
  salon,
  onClose,
  onSuccess,
}: {
  client: ClientModalClient | null;
  salon: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [email, setEmail] = useState(client?.email || '');
  const [birthday, setBirthday] = useState(client?.birthday ? client.birthday.split('T')[0] : '');
  const [gender, setGender] = useState(client?.gender || '');
  const [location, setLocation] = useState(client?.location || '');
  const [submitting, setSubmitting] = useState(false);

  const isNew = !client;
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [referralSourceId, setReferralSourceId] = useState('');
  const [referredBySearch, setReferredBySearch] = useState('');
  const [referredByResults, setReferredByResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [referredById, setReferredById] = useState('');
  const [referredByName, setReferredByName] = useState('');
  const [searchingReferrer, setSearchingReferrer] = useState(false);

  useEffect(() => {
    if (!isNew) return;
    fetch('/api/referral-sources').then(r => r.json()).then(d => setSources(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isNew]);

  const searchReferrer = useCallback(async (q: string) => {
    if (q.length < 2) { setReferredByResults([]); return; }
    setSearchingReferrer(true);
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setReferredByResults((Array.isArray(data) ? data : []).slice(0, 6));
      }
    } finally { setSearchingReferrer(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchReferrer(referredBySearch), 300);
    return () => clearTimeout(t);
  }, [referredBySearch, searchReferrer]);

  const selectReferrer = (c: { id: string; name: string; phone: string }) => {
    setReferredById(c.id);
    setReferredByName(c.name);
    setReferredBySearch('');
    setReferredByResults([]);
  };

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
          gender: gender || undefined,
          location: location || undefined,
          ...(isNew && referralSourceId ? { referral_source_id: referralSourceId } : {}),
          ...(isNew && referredById ? { referred_by_client_id: referredById } : {}),
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0">
          <h3 className="text-lg font-semibold">
            {client ? 'Edit Client' : 'Add New Client'}
          </h3>
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
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <span className={!phone && client ? 'text-amber-600' : 'text-gray-700'}>Phone Number {!client && '*'}</span>
              {!phone && client && <span className="text-xs font-normal text-amber-500">— add to complete profile</span>}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={!client}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${!phone && client ? 'border-amber-300 focus:ring-amber-300 bg-amber-50' : 'border-gray-300 focus:ring-blue-500'}`}
              placeholder="+256 700 000 000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <span className={!email && client ? 'text-amber-600' : 'text-gray-700'}>Email</span>
              {!email && client && <span className="text-xs font-normal text-amber-500">— add to complete profile</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${!email && client ? 'border-amber-300 focus:ring-amber-300 bg-amber-50' : 'border-gray-300 focus:ring-blue-500'}`}
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <span className={!birthday && client ? 'text-amber-600' : 'text-gray-700'}>Birthday</span>
              {!birthday && client && <span className="text-xs font-normal text-amber-500">— add to complete profile</span>}
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${!birthday && client ? 'border-amber-300 focus:ring-amber-300 bg-amber-50' : 'border-gray-300 focus:ring-blue-500'}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <span className={!gender && client ? 'text-amber-600' : 'text-gray-700'}>Gender</span>
              {!gender && client && <span className="text-xs font-normal text-amber-500">— add to complete profile</span>}
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${!gender && client ? 'border-amber-300 focus:ring-amber-300 bg-amber-50' : 'border-gray-300 focus:ring-blue-500'}`}
            >
              <option value="">— Select —</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <span className={!location && client ? 'text-amber-600' : 'text-gray-700'}>Location</span>
              {!location && client && <span className="text-xs font-normal text-amber-500">— add to complete profile</span>}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${!location && client ? 'border-amber-300 focus:ring-amber-300 bg-amber-50' : 'border-gray-300 focus:ring-blue-500'}`}
              placeholder="e.g. Ntinda, Kampala"
            />
          </div>

          {isNew && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How did they hear about us?
                </label>
                <select
                  value={referralSourceId}
                  onChange={e => setReferralSourceId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">— Select a source —</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referred by (optional)
                </label>
                {referredByName ? (
                  <div className="flex items-center justify-between px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-green-800 font-medium">{referredByName}</span>
                    <button type="button" onClick={() => { setReferredById(''); setReferredByName(''); }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={referredBySearch}
                      onChange={e => setReferredBySearch(e.target.value)}
                      placeholder="Search existing client by name or phone…"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchingReferrer && (
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>
                    )}
                    {referredByResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {referredByResults.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectReferrer(r)}
                            className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <span className="text-gray-400 ml-2">{r.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50 shrink-0">
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
