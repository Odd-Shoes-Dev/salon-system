'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';

const VARIABLES = [
  '{salonName}',
  '{clientName}',
  '{services}',
  '{total}',
  '{pointsEarned}',
  '{totalPoints}',
  '{receiptNumber}',
  '{paymentMethod}',
];

export default function SmsSettingsPage() {
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testText, setTestText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadTemplate();
  }, []);

  const chars = useMemo(() => template.length, [template]);

  const loadTemplate = async () => {
    try {
      const response = await fetch('/api/sms/template');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load template');
      setTemplate(data.template || '');
      setTestText(data.template || '');
    } catch (error: any) {
      toast.error(error.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/sms/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save template');
      toast.success('SMS template saved');
      setTestText(template);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim() || !testText.trim()) {
      toast.error('Enter test phone and message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone, text: testText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'SMS failed');
      toast.success('Test SMS sent');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading SMS settings...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="SMS Settings">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
          <Link href="/pos" className="btn-primary text-sm">Open POS</Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-6 space-y-6">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Receipt SMS Template</h2>
            <span className="text-xs text-gray-500">{chars} chars</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Admins can edit the message sent to customers after checkout.
          </p>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm"
          />

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Available variables</p>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => setTemplate((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${variable}`)}
                  className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                >
                  {variable}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <button onClick={saveTemplate} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Send Test SMS</h2>
          <div className="grid gap-3">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+256700000000"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm"
            />
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm"
            />
            <button onClick={sendTestSms} disabled={sending} className="btn-secondary text-sm w-fit">
              {sending ? 'Sending...' : 'Send Test SMS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
