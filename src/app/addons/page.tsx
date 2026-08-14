'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader, NumberInput } from '@/components/ui';
import { PageGroupTabs, SERVICE_TABS } from '@/components/PageGroupTabs';
import { useUser } from '@/contexts/UserContext';
import { useModalEsc } from '@/contexts/EscContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

interface Addon {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

const fmt = (n: number) => 'UGX ' + Number(n).toLocaleString('en-UG');

export default function AddonsPage() {
  const router  = useRouter();
  const { user } = useUser();
  const canEdit = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const { run, isPending } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const [addons,   setAddons]   = useState<Addon[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Modal state
  const [modal,  setModal]  = useState<null | 'create' | Addon>(null);
  useModalEsc(modal !== null, () => setModal(null));
  const [form,   setForm]   = useState({ name: '', price: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/addons');
      if (res.status === 401) { router.push('/login'); return; }
      if (res.ok) setAddons(await res.json());
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setForm({ name: '', price: '', description: '' });
      setModal('create');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const openCreate = () => {
    setForm({ name: '', price: '', description: '' });
    setModal('create');
  };

  const openEdit = (addon: Addon) => {
    setForm({ name: addon.name, price: String(addon.price), description: addon.description || '' });
    setModal(addon);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price (0 or more)'); return; }

    setSaving(true);
    try {
      const isEdit = modal && modal !== 'create';
      const url    = isEdit ? `/api/addons/${(modal as Addon).id}` : '/api/addons';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), price, description: form.description.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(isEdit ? 'Add-on updated' : 'Add-on created');
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (addon: Addon) => run(`toggle:${addon.id}`, async () => {
    const res = await fetch(`/api/addons/${addon.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !addon.is_active }),
    });
    if (!res.ok) throw new Error();
    setAddons(prev => prev.map(a => a.id === addon.id ? { ...a, is_active: !a.is_active } : a));
  });

  const remove = async (addon: Addon) => {
    if (!confirm(`Remove "${addon.name}"?`)) return;
    await guardAction('sensitive', async () => {
      setDeleting(addon.id);
      try {
        const res = await fetch(`/api/addons/${addon.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (data._action === 'deactivated') {
          toast.success('Add-on deactivated (it has existing records)');
        } else {
          toast.success('Add-on deleted');
        }
        load();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setDeleting(null);
      }
    });
  };

  const active   = addons.filter(a => a.is_active);
  const inactive = addons.filter(a => !a.is_active);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Add-ons" />
      <PageGroupTabs tabs={SERVICE_TABS} />
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        <PageHeader
          title="Add-ons & Extras"
          subtitle="Optional extras staff can attach to any service at checkout"
          action={canEdit ? (
            <button onClick={openCreate} className="btn-primary text-sm">+ New Add-on</button>
          ) : undefined}
        />

        {/* Active add-ons */}
        {loading ? (
          <div className="card text-center py-10 text-gray-400">Loading…</div>
        ) : active.length === 0 ? (
          <div className="card text-center py-14">
            <p className="text-4xl mb-3">✨</p>
            <p className="font-semibold text-gray-700">No add-ons yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Examples: Extra Jelly, Deep Conditioning, Scalp Massage, Beard Trim…</p>
            {canEdit && <button onClick={openCreate} className="btn-primary text-sm">Create First Add-on</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {active.map(addon => (
              <div key={addon.id} className="card flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{addon.name}</p>
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Active</span>
                  </div>
                  {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                  <p className="text-lg font-bold text-brand-primary mt-1">{fmt(addon.price)}</p>
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(addon)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Edit</button>
                    <button disabled={isPending(`toggle:${addon.id}`)} onClick={() => toggleActive(addon)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 disabled:opacity-50">{isPending(`toggle:${addon.id}`) ? 'Updating…' : 'Disable'}</button>
                    <button onClick={() => remove(addon)} disabled={deleting === addon.id} className="text-xs px-2.5 py-1 border border-red-100 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Inactive add-ons */}
        {inactive.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-400 mb-3">Disabled Add-ons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inactive.map(addon => (
                <div key={addon.id} className="card opacity-60 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-700 text-sm">{addon.name}</p>
                    <p className="text-sm text-gray-500">{fmt(addon.price)}</p>
                  </div>
                  {canEdit && (
                    <button disabled={isPending(`toggle:${addon.id}`)} onClick={() => toggleActive(addon)} className="text-xs px-2.5 py-1 border border-green-200 rounded-lg hover:bg-green-50 text-green-600 shrink-0 disabled:opacity-50">{isPending(`toggle:${addon.id}`) ? 'Updating…' : 'Enable'}</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{modal === 'create' ? 'New Add-on' : 'Edit Add-on'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input w-full" placeholder="e.g. Extra Jelly, Scalp Massage…" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (UGX) <span className="text-red-500">*</span></label>
              <NumberInput min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="input w-full" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input w-full" placeholder="Brief description…" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {saving ? 'Saving…' : modal === 'create' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {SecurityModal}
    </div>
  );
}
