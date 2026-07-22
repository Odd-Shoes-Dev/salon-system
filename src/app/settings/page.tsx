'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { NumberInput } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

type Tab = 'general' | 'branding' | 'sms' | 'referral' | 'birthday' | 'branches' | 'security' | 'whatsapp';

const TABS: { key: Tab; label: string; ownerOnly?: boolean }[] = [
  { key: 'general',   label: 'General' },
  { key: 'branding',  label: 'Branding' },
  { key: 'sms',       label: 'SMS / Receipt' },
  { key: 'whatsapp',  label: 'WhatsApp' },
  { key: 'referral',  label: 'Referrals' },
  { key: 'birthday',  label: 'Birthdays' },
  { key: 'branches',  label: 'Branches', ownerOnly: true },
  { key: 'security',  label: 'Security' },
];

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  active_staff_count: number;
  active_worker_count: number;
}

const emptyBranchForm = { name: '', address: '', phone: '', email: '' };

const SMS_VARS = [
  '{salonName}', '{clientName}', '{services}', '{total}',
  '{pointsEarned}', '{totalPoints}', '{receiptNumber}', '{paymentMethod}',
];

const BIRTHDAY_VARS = ['{clientName}', '{salonName}', '{discountPercent}'];

const DEFAULT_BIRTHDAY_TEMPLATE =
  'Happy Birthday {clientName}! The entire team at {salonName} wishes you a wonderful birthday. We look forward to celebrating with you soon!';

interface SalonSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  slogan: string;
  logo_url: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  loyalty_points_per_ugx: number;
  loyalty_threshold: number;
  referral_points_reward: number;
  birthday_discount_percent: number;
  birthday_sms_template: string;
  referral_sms_enabled: boolean;
  birthday_sms_enabled: boolean;
  require_confirm_sensitive: boolean;
  require_confirm_general: boolean;
}

interface ReferralSource {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const DEFAULTS: SalonSettings = {
  name: '', phone: '', email: '', address: '', city: '', slogan: '',
  logo_url: '', theme_primary_color: '#E31C23', theme_secondary_color: '#111827',
  loyalty_points_per_ugx: 10, loyalty_threshold: 1000, referral_points_reward: 50,
  birthday_discount_percent: 0,
  birthday_sms_template: DEFAULT_BIRTHDAY_TEMPLATE,
  referral_sms_enabled: true,
  birthday_sms_enabled: true,
  require_confirm_sensitive: false,
  require_confirm_general: false,
};

export default function SettingsPage() {
  const { user } = useUser();
  const [tab, setTab]           = useState<Tab>('general');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();
  const [form, setForm]         = useState<SalonSettings>(DEFAULTS);

  // SMS state
  const [smsTemplate, setSmsTemplate] = useState('');
  const [smsSaving, setSmsSaving]     = useState(false);
  const [testPhone, setTestPhone]     = useState('');

  // WhatsApp state
  const [waForm, setWaForm] = useState({
    phone_number: '', phone_number_id: '', access_token: '', verify_token: '',
  });
  const [waStatus, setWaStatus]           = useState<string | null>(null);
  const [waTokenSet, setWaTokenSet]       = useState(false);
  const [waCustomDomain, setWaCustomDomain] = useState('');
  const [waSubdomain, setWaSubdomain]     = useState('');
  const [waSaving, setWaSaving]           = useState(false);
  const [testText, setTestText]       = useState('');
  const [sending, setSending]         = useState(false);
  const [smsLoaded, setSmsLoaded]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [sources, setSources]         = useState<ReferralSource[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource]   = useState(false);

  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const { expanded, toggle } = useSidebar();
  const smsChars = useMemo(() => smsTemplate.length, [smsTemplate]);
  const brandColor = form.theme_primary_color || '#E31C23';

  // Branch state (owner only)
  const [branches, setBranches]               = useState<Branch[]>([]);
  const [branchesLoaded, setBranchesLoaded]   = useState(false);
  const [branchLoading, setBranchLoading]     = useState(false);
  const [showBranchForm, setShowBranchForm]   = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm]           = useState(emptyBranchForm);
  const [savingBranch, setSavingBranch]       = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setBranchLoading(true);
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setBranchLoading(false);
      setBranchesLoaded(true);
    }
  }, []);

  const openBranchCreate = () => {
    setEditingBranchId(null);
    setBranchForm(emptyBranchForm);
    setShowBranchForm(true);
  };

  const openBranchEdit = (b: Branch) => {
    setEditingBranchId(b.id);
    setBranchForm({ name: b.name, address: b.address || '', phone: b.phone || '', email: b.email || '' });
    setShowBranchForm(true);
  };

  const handleBranchSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim()) { toast.error('Branch name is required'); return; }
    setSavingBranch(true);
    try {
      const url    = editingBranchId ? `/api/branches/${editingBranchId}` : '/api/branches';
      const method = editingBranchId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    branchForm.name.trim(),
          address: branchForm.address.trim() || null,
          phone:   branchForm.phone.trim()   || null,
          email:   branchForm.email.trim()   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save branch'); return; }
      toast.success(editingBranchId ? 'Branch updated' : 'Branch created');
      setShowBranchForm(false);
      loadBranches();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleBranchToggle = (branch: Branch) => run(`branch:${branch.id}`, () => guardAction('sensitive', async () => {
    const res = await fetch(`/api/branches/${branch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !branch.is_active }),
    });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
    toast.success(branch.is_active ? 'Branch deactivated' : 'Branch activated');
    loadBranches();
  }));

  const handleBranchDelete = async (branch: Branch) => {
    if (!confirm(`Delete "${branch.name}"? Historical data will be preserved.`)) return;
    await guardAction('sensitive', async () => {
    setDeletingBranchId(branch.id);
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.staff_count || data.booking_count) {
          if (confirm(data.error + '\n\nForce delete anyway?')) {
            const res2 = await fetch(`/api/branches/${branch.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true }),
            });
            if (res2.ok) { toast.success('Branch deleted'); loadBranches(); }
            else { const d2 = await res2.json(); toast.error(d2.error || 'Failed'); }
          }
          return;
        }
        toast.error(data.error || 'Failed to delete branch');
        return;
      }
      toast.success('Branch deleted');
      loadBranches();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setDeletingBranchId(null);
    }
    });
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { if (tab === 'sms' && !smsLoaded) loadSmsTemplate(); }, [tab]);
  useEffect(() => { if (tab === 'referral' && !sourcesLoaded) loadSources(); }, [tab]);
  useEffect(() => { if (tab === 'branches' && !branchesLoaded) loadBranches(); }, [tab, branchesLoaded, loadBranches]);
  useEffect(() => { if (tab === 'whatsapp') loadWaSettings(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setForm({
        name:                   data.name                   ?? '',
        phone:                  data.phone                  ?? '',
        email:                  data.email                  ?? '',
        address:                data.address                ?? '',
        city:                   data.city                   ?? '',
        slogan:                 data.slogan                 ?? '',
        logo_url:               data.logo_url               ?? '',
        theme_primary_color:    data.theme_primary_color    ?? '#E31C23',
        theme_secondary_color:  data.theme_secondary_color  ?? '#111827',
        loyalty_points_per_ugx:   data.loyalty_points_per_ugx   ?? 10,
        loyalty_threshold:         data.loyalty_threshold         ?? 1000,
        referral_points_reward:       data.referral_points_reward       ?? 50,
        birthday_discount_percent:     data.birthday_discount_percent     ?? 0,
        birthday_sms_template:         data.birthday_sms_template         ?? DEFAULT_BIRTHDAY_TEMPLATE,
        referral_sms_enabled:          data.referral_sms_enabled          ?? true,
        birthday_sms_enabled:          data.birthday_sms_enabled          ?? true,
        require_confirm_sensitive:     data.require_confirm_sensitive     ?? false,
        require_confirm_general:       data.require_confirm_general       ?? false,
      });
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadSmsTemplate = async () => {
    try {
      const res = await fetch('/api/sms/template');
      const data = await res.json();
      setSmsTemplate(data.template || '');
      setTestText(data.template || '');
      setSmsLoaded(true);
    } catch {
      toast.error('Failed to load SMS template');
    }
  };

  const loadWaSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/whatsapp');
      const data = await res.json();
      setWaForm(f => ({
        ...f,
        phone_number:    data.whatsapp_phone_number    || '',
        phone_number_id: data.whatsapp_phone_number_id || '',
        verify_token:    data.whatsapp_verify_token    || '',
      }));
      setWaStatus(data.whatsapp_status || null);
      setWaTokenSet(Boolean(data.access_token_set));
      setWaCustomDomain(data.custom_domain || '');
      setWaSubdomain(data.subdomain || '');
    } catch {
      toast.error('Failed to load WhatsApp settings');
    }
  }, []);

  const saveWaSettings = async () => {
    setWaSaving(true);
    try {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waForm),
      });
      if (!res.ok) throw new Error();
      toast.success('WhatsApp settings saved');
      setWaForm(f => ({ ...f, access_token: '' }));
      await loadWaSettings();
    } catch {
      toast.error('Failed to save WhatsApp settings');
    } finally {
      setWaSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!form.name.trim()) { toast.error('Salon name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Settings saved — reload the page to see branding changes');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveSmsTemplate = async () => {
    setSmsSaving(true);
    try {
      const res = await fetch('/api/sms/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: smsTemplate }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('SMS template saved');
      setTestText(smsTemplate);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save template');
    } finally {
      setSmsSaving(false);
    }
  };

  const loadSources = async () => {
    try {
      const res = await fetch('/api/referral-sources');
      if (res.ok) setSources(await res.json());
      setSourcesLoaded(true);
    } catch {
      toast.error('Failed to load referral sources');
    }
  };

  const addSource = async () => {
    if (!newSourceName.trim()) return;
    setAddingSource(true);
    try {
      const res = await fetch('/api/referral-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSourceName.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      setNewSourceName('');
      await loadSources();
      toast.success('Source added');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const res = await fetch(`/api/referral-sources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSources(prev => prev.filter(s => s.id !== id));
      toast.success('Source removed');
    } catch {
      toast.error('Failed to remove source');
    }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim() || !testText.trim()) { toast.error('Enter a phone number and message'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone, text: testText }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Test SMS sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('logo_url', data.logo_url);
      toast.success('Logo uploaded successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const set = (key: keyof SalonSettings, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading settings…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Settings" />

      <div className="container mx-auto p-6 max-w-3xl">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.filter(t => !t.ownerOnly || user?.role === 'owner').map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                tab === t.key
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── GENERAL TAB ───────────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Salon Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salon Name *</label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Posh Nailcare"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slogan / Tagline</label>
                  <input
                    value={form.slogan}
                    onChange={e => set('slogan', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Beauty Redefined"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. Kampala"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="e.g. 123 Kampala Road"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Contact Details</h2>
              <p className="text-sm text-gray-500 mb-4">These appear on receipts sent to clients.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="+256 700 000 000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="hello@yoursalon.com"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Loyalty Program</h2>
              <p className="text-sm text-gray-500 mb-4">Control how points are earned and redeemed.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points per 1,000 UGX</label>
                  <NumberInput
                    min={1}
                    value={form.loyalty_points_per_ugx}
                    onChange={e => set('loyalty_points_per_ugx', Number(e.target.value))}
                    disabled={!canEdit}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points needed for reward</label>
                  <NumberInput
                    min={1}
                    value={form.loyalty_threshold}
                    onChange={e => set('loyalty_threshold', Number(e.target.value))}
                    disabled={!canEdit}
                    className="input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Display Preferences</h2>
              <p className="text-sm text-gray-500 mb-4">Personal preferences saved to your browser only.</p>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Expanded sidebar</p>
                  <p className="text-xs text-gray-500 mt-0.5">Show labels next to navigation icons</p>
                </div>
                <button
                  onClick={toggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    expanded ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={expanded}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      expanded ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {canEdit && (
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}

        {/* ── BRANDING TAB ─────────────────────────────────────────── */}
        {tab === 'branding' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Logo</h2>
              <p className="text-sm text-gray-500 mb-4">Upload your salon logo. It appears on receipts and the login page.</p>

              <div className="flex items-start gap-5">
                {/* Preview box */}
                <div
                  className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
                  onClick={() => canEdit && fileInputRef.current?.click()}
                  title={canEdit ? 'Click to upload logo' : undefined}
                >
                  {uploading ? (
                    <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-1 text-white"
                      style={{ backgroundColor: form.theme_primary_color }}
                    >
                      <span className="text-2xl font-bold">{(form.name || 'S').charAt(0).toUpperCase()}</span>
                      {canEdit && <span className="text-[10px] opacity-75">Upload</span>}
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  {/* File upload */}
                  {canEdit && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {uploading ? 'Uploading…' : 'Upload Image'}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, SVG or GIF · max 2 MB</p>
                    </div>
                  )}

                  {form.logo_url && canEdit && (
                    <button
                      type="button"
                      onClick={() => set('logo_url', '')}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Brand Colors</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.theme_primary_color}
                      onChange={e => set('theme_primary_color', e.target.value)}
                      disabled={!canEdit}
                      className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                    />
                    <input
                      value={form.theme_primary_color}
                      onChange={e => set('theme_primary_color', e.target.value)}
                      disabled={!canEdit}
                      className="input flex-1 font-mono uppercase"
                      placeholder="#E31C23"
                      maxLength={7}
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: form.theme_primary_color }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.theme_secondary_color}
                      onChange={e => set('theme_secondary_color', e.target.value)}
                      disabled={!canEdit}
                      className="w-12 h-10 rounded cursor-pointer border border-gray-300"
                    />
                    <input
                      value={form.theme_secondary_color}
                      onChange={e => set('theme_secondary_color', e.target.value)}
                      disabled={!canEdit}
                      className="input flex-1 font-mono uppercase"
                      placeholder="#111827"
                      maxLength={7}
                    />
                  </div>
                  <div
                    className="mt-2 h-8 rounded-lg"
                    style={{ backgroundColor: form.theme_secondary_color }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Color changes take effect after the page is reloaded.</p>
            </div>

            {canEdit && (
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        )}

        {/* ── REFERRAL TAB ─────────────────────────────────────────── */}
        {tab === 'referral' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Referral Reward</h2>
              <p className="text-sm text-gray-500 mb-4">
                When a new client signs up referred by an existing client, the referrer automatically
                receives this many loyalty points. SMS notification is controlled below.
              </p>
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points per successful referral</label>
                  <NumberInput
                    min={0}
                    value={form.referral_points_reward}
                    onChange={e => set('referral_points_reward', Number(e.target.value))}
                    disabled={!canEdit}
                    className="input w-full"
                    placeholder="50"
                  />
                </div>
              </div>
              {canEdit && (
                <div className="mt-4">
                  <button onClick={saveSettings} disabled={saving} className="btn-primary text-sm">
                    {saving ? 'Saving…' : 'Save Reward Setting'}
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Referral SMS Notifications</h2>
                  <p className="text-sm text-gray-500 mt-0.5">When enabled, the referrer automatically receives an SMS when they earn referral points. Points are always awarded regardless of this setting.</p>
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    SMS delivery currently supports Airtel numbers only.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setForm(prev => ({ ...prev, referral_sms_enabled: !prev.referral_sms_enabled }))}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${form.referral_sms_enabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.referral_sms_enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {canEdit && (
                <div className="mt-4">
                  <button onClick={saveSettings} disabled={saving} className="btn-primary text-sm">
                    {saving ? 'Saving…' : 'Save Notification Setting'}
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Discovery Sources</h2>
              <p className="text-sm text-gray-500 mb-4">
                Manage the options staff see when asking &quot;How did you hear about us?&quot;
              </p>

              {!sourcesLoaded ? (
                <div className="text-sm text-gray-400 py-4 text-center">Loading…</div>
              ) : (
                <div className="space-y-2 mb-4">
                  {sources.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No sources yet.</p>
                  )}
                  {sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-900">{s.name}</span>
                      {canEdit && (
                        <button
                          onClick={() => deleteSource(s.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="flex gap-2">
                  <input
                    value={newSourceName}
                    onChange={e => setNewSourceName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSource()}
                    placeholder="e.g. WhatsApp"
                    className="input flex-1"
                  />
                  <button
                    onClick={addSource}
                    disabled={addingSource || !newSourceName.trim()}
                    className="btn-primary text-sm px-4 disabled:opacity-50"
                  >
                    {addingSource ? 'Adding…' : 'Add Source'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BIRTHDAY TAB ────────────────────────────────────────── */}
        {tab === 'birthday' && (
          <div className="space-y-6">
            <div className="card bg-amber-50 border border-amber-200">
              <div className="flex gap-3">
                <span className="text-2xl">🎂</span>
                <div>
                  <p className="font-medium text-amber-900">Birthday Wishes System</p>
                  <p className="text-sm text-amber-700 mt-1">Configure the default message and discount sent to clients on their birthday. Staff can customise each message from the <strong>Birthday Alerts</strong> page.</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Default Birthday SMS Template</h2>
              <p className="text-sm text-gray-500 mb-3">Pre-fills the message when staff click “Send Birthday Wish”. Staff can still edit it before sending.</p>
              <textarea
                value={form.birthday_sms_template}
                onChange={e => setForm(prev => ({ ...prev, birthday_sms_template: e.target.value }))}
                disabled={!canEdit}
                rows={5}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono resize-y"
                placeholder={DEFAULT_BIRTHDAY_TEMPLATE}
              />
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Insert variable</p>
                <div className="flex flex-wrap gap-2">
                  {BIRTHDAY_VARS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, birthday_sms_template: `${prev.birthday_sms_template}${prev.birthday_sms_template.endsWith(' ') || !prev.birthday_sms_template ? '' : ' '}${v}` }))}
                      className="px-2 py-1 text-xs bg-amber-100 border border-amber-200 rounded hover:bg-amber-200 text-amber-800"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, birthday_sms_template: DEFAULT_BIRTHDAY_TEMPLATE }))}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Reset to default
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Default Birthday Discount</h2>
              <p className="text-sm text-gray-500 mb-3">Pre-filled discount percentage when staff choose to include a birthday offer. Set to 0 to disable discounts by default.</p>
              <div className="flex items-center gap-3">
                <NumberInput
                  min="0"
                  max="100"
                  value={form.birthday_discount_percent}
                  onChange={e => setForm(prev => ({ ...prev, birthday_discount_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  disabled={!canEdit}
                  className="input w-28 text-center text-lg font-bold"
                />
                <span className="text-gray-500 font-medium">% off</span>
                <span className="text-xs text-gray-400">(0 = no default discount)</span>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Birthday SMS Notifications</h2>
                  <p className="text-sm text-gray-500 mt-0.5">When enabled, staff can send birthday wish SMS from the Birthday Alerts page.</p>
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    SMS delivery currently supports Airtel numbers only.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setForm(prev => ({ ...prev, birthday_sms_enabled: !prev.birthday_sms_enabled }))}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${form.birthday_sms_enabled ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.birthday_sms_enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {canEdit && (
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Birthday Settings'}
              </button>
            )}
          </div>
        )}

        {/* ── BRANCHES TAB ────────────────────────────────────────── */}
        {tab === 'branches' && user?.role === 'owner' && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Branch Management</h2>
                <p className="text-sm text-gray-500 mt-0.5">Manage your salon locations. Each branch has isolated data.</p>
              </div>
              <button
                onClick={openBranchCreate}
                className="btn-primary flex items-center gap-1.5 !min-h-0 !py-1 !px-2 !text-xs sm:!py-1.5 sm:!px-2.5 md:!py-2 md:!px-4 md:!text-sm md:gap-2 shrink-0"
              >
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Branch</span>
                <span className="sm:hidden">New Branch</span>
              </button>
            </div>

            {/* Create / Edit form */}
            {showBranchForm && (
              <div className="card">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                  {editingBranchId ? 'Edit Branch' : 'Create New Branch'}
                </h3>
                <form onSubmit={handleBranchSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                      <input
                        type="text"
                        value={branchForm.name}
                        onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Downtown Branch"
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={branchForm.phone}
                        onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+256 700 000 000"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={branchForm.address}
                        onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))}
                        placeholder="123 Main Street, Kampala"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={branchForm.email}
                        onChange={e => setBranchForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="branch@salon.com"
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowBranchForm(false)}
                      className="btn-secondary !min-h-0 !py-2 !px-4 !text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingBranch}
                      className="btn-primary !min-h-0 !py-2 !px-4 !text-sm disabled:opacity-50"
                    >
                      {savingBranch ? 'Saving…' : editingBranchId ? 'Save Changes' : 'Create Branch'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Branch list */}
            {branchLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="font-medium">No branches yet</p>
                <p className="text-sm mt-1">Create your first branch to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {branches.map(branch => (
                  <div
                    key={branch.id}
                    className={`card transition-all ${!branch.is_active ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm">{branch.name}</h3>
                          {branch.is_default && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">Default</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${branch.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {branch.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {branch.address && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {branch.address}
                            </span>
                          )}
                          {branch.phone && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {branch.phone}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-4">
                          <span className="text-xs text-gray-400"><span className="font-medium text-gray-600">{branch.active_staff_count}</span> staff</span>
                          <span className="text-xs text-gray-400"><span className="font-medium text-gray-600">{branch.active_worker_count}</span> stylists</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openBranchEdit(branch)}
                          className="p-1.5 text-gray-400 rounded-lg transition-colors hover:bg-gray-100"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = brandColor; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          title="Edit branch"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          disabled={isPending(`branch:${branch.id}`)}
                          onClick={() => handleBranchToggle(branch)}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${branch.is_active ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                          title={branch.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {branch.is_active ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        {!branch.is_default && (
                          <button
                            onClick={() => handleBranchDelete(branch)}
                            disabled={deletingBranchId === branch.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                            title="Delete branch"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Info box */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">How branches work</p>
              <ul className="space-y-1 text-gray-500 text-xs list-disc list-inside">
                <li>Each staff member is assigned to one branch and only sees data from their branch.</li>
                <li>As owner you can view all branches or switch branch context from the sidebar.</li>
                <li>Services and clients are shared across all branches.</li>
                <li>Bookings, visits, staff, and stylists are isolated per branch.</li>
                <li>Deleting a branch archives it — historical data is never lost.</li>
                <li>The <strong>Default</strong> branch cannot be deleted. Records from all-branches admins are automatically assigned to it.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── SMS TAB ───────────────────────────────────────────────── */}
        {tab === 'sms' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-gray-900">Receipt SMS Template</h2>
                <span className={`text-xs font-medium ${smsChars > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                  {smsChars} / 160 chars{smsChars > 160 ? ` — will send as ${Math.ceil(smsChars / 153)} messages` : ''}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Sent to clients after checkout. Use variables below to personalise the message.
              </p>
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                SMS delivery currently supports <strong className="font-semibold">Airtel numbers only</strong>. Messages to other networks will not be delivered.
              </div>
              <textarea
                value={smsTemplate}
                onChange={e => setSmsTemplate(e.target.value)}
                disabled={!canEdit}
                rows={7}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono resize-y"
                placeholder="Thank you {clientName} for visiting {salonName}…"
              />
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Insert variable</p>
                <div className="flex flex-wrap gap-2">
                  {SMS_VARS.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSmsTemplate(prev => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${v}`)}
                      className="px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {canEdit && (
                <div className="mt-4">
                  <button onClick={saveSmsTemplate} disabled={smsSaving} className="btn-primary text-sm">
                    {smsSaving ? 'Saving…' : 'Save Template'}
                  </button>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Send Test SMS</h2>
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Phone</label>
                  <input
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="+256 700 000 000"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-y"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  SMS delivers to <strong className="font-semibold">Airtel numbers only</strong>. Messages to other networks will not be delivered.
                </div>
                <button onClick={sendTestSms} disabled={sending} className="btn-secondary text-sm w-fit">
                  {sending ? 'Sending…' : 'Send Test SMS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── WHATSAPP TAB ─────────────────────────────────────────── */}
        {tab === 'whatsapp' && (
          <div className="space-y-6">

            {/* Webhook URL card */}
            <div className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.123 1.532 5.856L.054 23.447a.5.5 0 00.499.553h.063l5.761-1.51A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.807 9.807 0 01-5.031-1.386l-.36-.214-3.733.979.998-3.647-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">WhatsApp Business Integration</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Connect your WhatsApp Business account to send receipts and booking confirmations.</p>
                </div>
              </div>

              {waCustomDomain || waSubdomain ? (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-600 mb-1">Your Webhook URL <span className="text-gray-400">(paste this in Meta Business Manager)</span></p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 break-all">
                      {waCustomDomain
                        ? `https://system.${waCustomDomain}/hooks/whatsapp`
                        : `https://system-${waSubdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'blueoxgroup.eu'}/hooks/whatsapp`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        const url = waCustomDomain
                          ? `https://system.${waCustomDomain}/hooks/whatsapp`
                          : `https://system-${waSubdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'blueoxgroup.eu'}/hooks/whatsapp`;
                        navigator.clipboard.writeText(url);
                        toast.success('Copied');
                      }}
                      className="shrink-0 px-3 py-2 text-xs btn-secondary"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              {waStatus === 'configured' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  WhatsApp is configured and active.
                </div>
              )}
            </div>

            {/* Credentials form */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-gray-900">API Credentials</h2>
              <p className="text-sm text-gray-500 -mt-2">Find these in your Meta App → WhatsApp → API Setup.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Phone Number</label>
                <input
                  type="tel"
                  value={waForm.phone_number}
                  onChange={e => setWaForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="+256 700 123 456"
                  disabled={!canEdit}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={waForm.phone_number_id}
                  onChange={e => setWaForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  placeholder="123456789012345"
                  disabled={!canEdit}
                  className="input w-full font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">The numeric ID next to your number in Meta → WhatsApp → API Setup.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permanent Access Token
                  {waTokenSet && <span className="ml-2 text-xs text-green-600 font-normal">● Already saved</span>}
                </label>
                <input
                  type="password"
                  value={waForm.access_token}
                  onChange={e => setWaForm(f => ({ ...f, access_token: e.target.value }))}
                  placeholder={waTokenSet ? 'Leave blank to keep existing token' : 'EAAxxxxxxxxxxxxxxxx…'}
                  disabled={!canEdit}
                  className="input w-full font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">Generate a System User token in Meta Business Settings with <strong>whatsapp_business_messaging</strong> permission.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
                <input
                  type="text"
                  value={waForm.verify_token}
                  onChange={e => setWaForm(f => ({ ...f, verify_token: e.target.value }))}
                  placeholder="my-secret-verify-token"
                  disabled={!canEdit}
                  className="input w-full font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">A string you choose — enter the same value when configuring the webhook in Meta Business Manager.</p>
              </div>

              {canEdit && (
                <button onClick={saveWaSettings} disabled={waSaving} className="btn-primary">
                  {waSaving ? 'Saving…' : 'Save WhatsApp Settings'}
                </button>
              )}
            </div>

            {/* Setup guide */}
            <div className="card bg-blue-50 border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Setup checklist</h3>
              <ol className="text-xs text-blue-800 space-y-1.5 list-decimal list-inside">
                <li>In Meta Business Manager, add your WhatsApp Business phone number.</li>
                <li>Go to your Meta App → WhatsApp → API Setup, copy the <strong>Phone Number ID</strong>.</li>
                <li>In Meta Business Settings → System Users, create a system user and generate a <strong>permanent token</strong> with <em>whatsapp_business_messaging</em> permission.</li>
                <li>Paste both values above and choose a <strong>Verify Token</strong> (any string you like).</li>
                <li>Copy your Webhook URL above, then go to Meta App → WhatsApp → Configuration and click <strong>Edit</strong>.</li>
                <li>Paste the webhook URL, enter the same Verify Token, and subscribe to the <strong>messages</strong> field.</li>
                <li>Click Verify — Meta will call your endpoint and it will respond automatically.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ──────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Action Confirmation</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                When enabled, staff must enter their own PIN or password before performing certain actions. After a successful confirmation, they have a <strong>2-minute grace period</strong> before being asked again.
              </p>

              <div className="space-y-5">
                {/* Sensitive actions toggle */}
                <div className="flex items-start justify-between gap-4 pb-5 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Admin &amp; Manager actions</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Require confirmation for destructive or restricted operations — deleting clients, voiding sales, deactivating accounts, removing staff, and similar admin-only actions.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setForm(prev => ({ ...prev, require_confirm_sensitive: !prev.require_confirm_sensitive }))}
                    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${form.require_confirm_sensitive ? 'bg-amber-500' : 'bg-gray-300'} disabled:opacity-50`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.require_confirm_sensitive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* General actions toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">General edit actions</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Require confirmation for everyday edit operations that all staff can perform — editing client profiles, updating service details, and similar actions.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setForm(prev => ({ ...prev, require_confirm_general: !prev.require_confirm_general }))}
                    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${form.require_confirm_general ? 'bg-amber-500' : 'bg-gray-300'} disabled:opacity-50`}
                  >
                    <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.require_confirm_general ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {canEdit && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => run('save-security', () => guardAction('sensitive', async () => {
                      setSaving(true);
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(form),
                        });
                        if (!res.ok) throw new Error('Failed to save');
                        toast.success('Security settings saved');
                      } finally {
                        setSaving(false);
                      }
                    }))}
                    disabled={saving || isPending('save-security')}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {isPending('save-security') ? 'Saving…' : 'Save Security Settings'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 space-y-1.5">
              <p className="font-semibold">How it works</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
                <li>Each user enters <strong>their own</strong> PIN or password — not a shared code</li>
                <li>A 2-minute grace period means they are not asked repeatedly for quick successive actions</li>
                <li>If a user has both a PIN and password set, either will be accepted</li>
                <li>These settings apply salon-wide to all users</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      {SecurityModal}
    </div>
  );
}
