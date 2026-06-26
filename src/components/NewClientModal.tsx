'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSalon } from '@/contexts/SalonContext';

export interface NewClientResult {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
}

interface NewClientModalProps {
  onClose: () => void;
  onClientCreated: (client: NewClientResult) => void;
}

export function NewClientModal({ onClose, onClientCreated }: NewClientModalProps) {
  const { salon } = useSalon();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [referralSourceId, setReferralSourceId] = useState('');
  const [referredBySearch, setReferredBySearch] = useState('');
  const [referredByResults, setReferredByResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [referredById, setReferredById] = useState('');
  const [referredByName, setReferredByName] = useState('');

  useEffect(() => {
    fetch('/api/referral-sources').then(r => r.json()).then(d => setSources(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (referredBySearch.length < 2) { setReferredByResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(referredBySearch)}`)
        .then(r => r.json()).then(d => setReferredByResults((Array.isArray(d) ? d : []).slice(0, 6))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [referredBySearch]);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone,
          email: email || undefined,
          birthday: birthday || undefined,
          ...(referralSourceId ? { referral_source_id: referralSourceId } : {}),
          ...(referredById ? { referred_by_client_id: referredById } : {}),
        }),
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="John Doe" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="+256 700 000 000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="john@example.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Birthday (Optional)</label>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">How did they hear about us?</label>
              <select value={referralSourceId} onChange={e => setReferralSourceId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">— Select a source —</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Referred by (optional)</label>
              {referredByName ? (
                <div className="flex items-center justify-between px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-800 font-medium">{referredByName}</span>
                  <button type="button" onClick={() => { setReferredById(''); setReferredByName(''); }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" value={referredBySearch} onChange={e => setReferredBySearch(e.target.value)} placeholder="Search existing client by name or phone…" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  {referredByResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {referredByResults.map(r => (
                        <button key={r.id} type="button" onClick={() => { setReferredById(r.id); setReferredByName(r.name); setReferredBySearch(''); setReferredByResults([]); }} className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0">
                          <span className="font-medium text-gray-900">{r.name}</span>
                          <span className="text-gray-400 ml-2">{r.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-4 border-t bg-gray-50">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: brandColor }}>
              {submitting ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
