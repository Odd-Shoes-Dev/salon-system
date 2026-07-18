'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { SearchInput } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSecurityConfirm } from '@/hooks/useSecurityConfirm';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  item_count: number;
}

const BLANK: Omit<Supplier, 'id' | 'item_count' | 'is_active'> = {
  name: '', contact_person: '', phone: '', email: '', address: '', notes: '',
};

export default function SuppliersPage() {
  const { user } = useUser();
  const canAdmin = ['owner', 'admin'].includes(user?.role || '');
  const { run } = useAsyncAction();
  const { guardAction, SecurityModal } = useSecurityConfirm();

  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Supplier | null>(null);
  const [form, setForm]               = useState(BLANK);
  const [saving, setSaving]           = useState(false);
  const [openMenuId, setOpenMenuId]   = useState<string | null>(null);
  const [menuPos, setMenuPos]         = useState<{ top: number; right: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const url    = editing ? `/api/inventory/suppliers/${editing.id}` : '/api/inventory/suppliers';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, is_active: true }) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editing ? 'Supplier updated' : 'Supplier added');
      setShowModal(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s: Supplier) => {
    try {
      const res = await fetch(`/api/inventory/suppliers/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, is_active: !s.is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(s.is_active ? 'Supplier deactivated' : 'Supplier activated');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = (s: Supplier) => {
    if (s.item_count > 0) {
      toast.error(`Cannot delete — ${s.item_count} item${s.item_count > 1 ? 's' : ''} linked to this supplier. Deactivate instead.`);
      return;
    }
    run(`del:${s.id}`, () => guardAction('sensitive', async () => {
      const res = await fetch(`/api/inventory/suppliers/${s.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Supplier removed');
      load();
    }));
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Suppliers" />

      <div className="container mx-auto p-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/inventory" className="hover:text-gray-600 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Inventory
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-700 font-medium">Suppliers</span>
        </div>

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage product manufacturers and suppliers</p>
          </div>
          {canAdmin && (
            <button onClick={openAdd} className="btn-primary shrink-0">+ Add Supplier</button>
          )}
        </div>

        {/* Search */}
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, contact or phone…" className="max-w-sm" />

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              {suppliers.length === 0 ? (
                <>
                  <p className="text-lg font-medium mb-1">No suppliers yet</p>
                  <p className="text-sm mb-4">Add your first supplier to start linking stock items to their source.</p>
                  {canAdmin && <button onClick={openAdd} className="btn-primary text-sm">Add First Supplier</button>}
                </>
              ) : (
                <p>No suppliers match "{search}"</p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {canAdmin && <th className="py-3 px-4" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      {s.address && <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.address}</p>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{s.contact_person || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-4 text-gray-600">{s.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-4 text-gray-600">{s.email || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold">
                        {s.item_count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canAdmin && (
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <button
                            onClick={e => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                              setOpenMenuId(openMenuId === s.id ? null : s.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Supplier Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company / Supplier Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. OPI Products Inc." autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} className="input w-full" placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input w-full" placeholder="+256 …" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input w-full" placeholder="orders@supplier.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input w-full" placeholder="Street, City" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input w-full resize-none" rows={2} placeholder="Payment terms, delivery schedule, etc." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Row action menu ── */}
      {openMenuId && menuPos && (() => {
        const s = filtered.find(x => x.id === openMenuId);
        if (!s) return null;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
            <div className="fixed z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-xl py-1" style={{ top: menuPos.top, right: menuPos.right }}>
              <button onClick={() => { openEdit(s); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button onClick={() => { toggleActive(s); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.is_active ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
                </svg>
                {s.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { remove(s); setOpenMenuId(null); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </>
        );
      })()}

      {SecurityModal}
    </div>
  );
}
