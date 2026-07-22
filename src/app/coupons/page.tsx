'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SalonHeader } from '@/components/SalonBranding';
import { PageHeader, NumberInput, SearchInput, SearchableSelect } from '@/components/ui';
import { useUser } from '@/contexts/UserContext';
import { useSalon } from '@/contexts/SalonContext';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useModalEsc } from '@/contexts/EscContext';

interface CouponGroup {
  id: string;
  name: string;
  value: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  created_by_name: string | null;
  coupon_count: number;
  active_count: number;
  used_count: number;
}

interface Coupon {
  id: string;
  code: string;
  value: number;
  remaining_value: number;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  note: string | null;
  issued_to: string | null;
  expires_at: string | null;
  dispatched_at: string | null;
  group_name: string | null;
  issued_by_name: string | null;
  created_at: string;
  redemptions: { id: string; amount_used: number; remaining_after: number; redeemed_at: string }[];
}

const fmt = (n: number) => `UGX ${Number(n).toLocaleString('en-UG')}`;
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  dispatched: 'bg-blue-50 text-blue-700',
  used: 'bg-gray-100 text-gray-500',
  expired: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
};

function displayStatus(c: Coupon) {
  return c.status === 'active' && c.dispatched_at ? 'dispatched' : c.status;
}

export default function CouponsPage() {
  const { user } = useUser();
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#6366f1';
  const canManage = user && ['owner', 'admin', 'manager'].includes(user.role);

  const [groups, setGroups]     = useState<CouponGroup[]>([]);
  const [coupons, setCoupons]   = useState<Coupon[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [statusFilter, setStatusFilter]   = useState('active');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Modals
  const [showGroupModal, setShowGroupModal]     = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [expandedCoupon, setExpandedCoupon]     = useState<string | null>(null);

  // Group form
  const [groupForm, setGroupForm] = useState({ name: '', value: '', note: '' });
  const [savingGroup, setSavingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Coupon edit — declared before useModalEsc to avoid temporal dead zone
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editCouponForm, setEditCouponForm] = useState({ note: '', issued_to: '', expires_at: '' });

  useModalEsc(showGroupModal, () => { setShowGroupModal(false); setEditingGroupId(null); });
  useModalEsc(showGenerateModal, () => setShowGenerateModal(false));
  useModalEsc(!!editingCoupon, () => setEditingCoupon(null));

  // Generate form
  const [genForm, setGenForm] = useState({
    group_id: '',
    value: '',
    count: '1',
    note: '',
    issued_to: '',
    expires_at: '',
  });
  const [generating, setGenerating] = useState(false);

  // Clients for dispatch recipient search
  const [dispatchClients, setDispatchClients] = useState<{ id: string; name: string; phone: string }[]>([]);
  useEffect(() => {
    fetch('/api/clients').then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setDispatchClients(data);
      else if (Array.isArray(data.data)) setDispatchClients(data.data);
    });
  }, []);

  // Dispatch (mark as given) state
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchName, setDispatchName]   = useState('');
  const [dispatching, setDispatching]     = useState(false);

  // Three-dot menu + cancel confirmation state (coupons)
  const [menuOpenId, setMenuOpenId]           = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpenId]);

  // Three-dot menu for groups
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!groupMenuId) return;
    const close = () => setGroupMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [groupMenuId]);

  const { run, isPending } = useAsyncAction();

  const loadGroups = useCallback(async () => {
    const res = await fetch('/api/coupons/groups');
    if (res.ok) setGroups(await res.json());
  }, []);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (selectedGroup) qs.set('group_id', selectedGroup);
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (search.trim()) qs.set('search', search.trim());
      const res = await fetch(`/api/coupons?${qs}`);
      if (res.ok) setCoupons(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, statusFilter, search]);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const openEditGroup = (g: CouponGroup) => {
    setGroupForm({ name: g.name, value: String(g.value), note: g.note || '' });
    setEditingGroupId(g.id);
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Name is required'); return; }
    if (!groupForm.value || Number(groupForm.value) <= 0) { toast.error('Value must be greater than 0'); return; }
    setSavingGroup(true);
    try {
      const url    = editingGroupId ? `/api/coupons/groups/${editingGroupId}` : '/api/coupons/groups';
      const method = editingGroupId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupForm.name, value: Number(groupForm.value), note: groupForm.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(editingGroupId ? 'Group updated' : 'Group created');
      setShowGroupModal(false);
      setGroupForm({ name: '', value: '', note: '' });
      setEditingGroupId(null);
      loadGroups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const saveEditCoupon = async () => {
    if (!editingCoupon) return;
    try {
      const res = await fetch(`/api/coupons/${editingCoupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCouponForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Coupon updated');
      setEditingCoupon(null);
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const generate = async () => {
    if (!genForm.group_id && (!genForm.value || Number(genForm.value) <= 0)) {
      toast.error('Select a group or enter a value'); return;
    }
    setGenerating(true);
    try {
      const body: any = {
        count: Number(genForm.count) || 1,
        note: genForm.note || undefined,
        issued_to: genForm.issued_to || undefined,
        expires_at: genForm.expires_at || undefined,
      };
      if (genForm.group_id) body.group_id = genForm.group_id;
      else body.value = Number(genForm.value);

      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const count = Array.isArray(data) ? data.length : 1;
      toast.success(`${count} coupon${count > 1 ? 's' : ''} generated`);
      setShowGenerateModal(false);
      setGenForm({ group_id: '', value: '', count: '1', note: '', issued_to: '', expires_at: '' });
      loadCoupons();
      loadGroups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const cancelCoupon = (coupon: Coupon) => {
    run(`cancel:${coupon.id}`, async () => {
      const res = await fetch(`/api/coupons/${coupon.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Coupon cancelled');
      loadCoupons();
      loadGroups();
    });
  };

  const dispatchCoupon = async (coupon: Coupon) => {
    setDispatching(true);
    try {
      const res = await fetch(`/api/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issued_to: dispatchName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Coupon marked as given');
      setDispatchingId(null);
      setDispatchName('');
      loadCoupons();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDispatching(false);
    }
  };

  const deleteGroup = (group: CouponGroup) => {
    run(`del-group:${group.id}`, async () => {
      const res = await fetch(`/api/coupons/groups/${group.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Group deleted');
      if (selectedGroup === group.id) setSelectedGroup(null);
      loadGroups();
    });
  };

  // When group_id selected for generate, pre-fill count and clear custom value
  const onGenGroupChange = (gid: string) => {
    setGenForm(f => ({ ...f, group_id: gid, value: '' }));
  };

  const activeGroups = groups.filter(g => g.is_active);
  const selectedGroupObj = groups.find(g => g.id === selectedGroup);

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <PageHeader
          title="Coupons"
          subtitle="Generate, manage, and track coupon redemptions"
          action={canManage ? (
            <div className="flex gap-2">
              <button onClick={() => setShowGroupModal(true)} className="btn-secondary text-sm">+ New Group</button>
              <button onClick={() => setShowGenerateModal(true)} className="btn-primary text-sm">Generate Coupons</button>
            </div>
          ) : undefined}
        />

        <div className="grid lg:grid-cols-4 gap-6">
          {/* ── Groups sidebar ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-3">Groups</p>
            <button
              onClick={() => setSelectedGroup(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${!selectedGroup ? 'font-semibold text-white shadow-sm' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
              style={!selectedGroup ? { backgroundColor: brandColor } : {}}
            >
              All Coupons
            </button>
            {activeGroups.map(g => (
              <div
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedGroup(g.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${selectedGroup === g.id ? 'font-semibold text-white shadow-sm' : 'text-gray-700 hover:bg-white hover:shadow-sm'}`}
                style={selectedGroup === g.id ? { backgroundColor: brandColor } : {}}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{g.name}</span>
                  {canManage && (
                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setGroupMenuId(groupMenuId === g.id ? null : g.id)}
                        className={`p-0.5 rounded hover:bg-black/10 ${selectedGroup === g.id ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {groupMenuId === g.id && (
                        <div className="absolute right-0 top-6 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36">
                          <button
                            onClick={() => { setGroupMenuId(null); openEditGroup(g); }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                          >Edit group</button>
                          <button
                            onClick={() => { setGroupMenuId(null); deleteGroup(g); }}
                            disabled={isPending(`del-group:${g.id}`)}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >Delete group</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={`flex items-center gap-2 text-xs mt-0.5 ${selectedGroup === g.id ? 'text-white/70' : 'text-gray-400'}`}>
                  <span>{fmt(g.value)} each</span>
                  <span>· {g.active_count}/{g.coupon_count}</span>
                </div>
              </div>
            ))}
            {activeGroups.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-2 italic">No groups yet</p>
            )}
          </div>

          {/* ── Coupons table ── */}
          <div className="lg:col-span-3 space-y-4">
            {selectedGroupObj && (
              <div className="card p-4 flex items-center justify-between gap-4 bg-brand-primary/5 border border-brand-primary/20">
                <div>
                  <p className="font-semibold text-gray-900">{selectedGroupObj.name}</p>
                  <p className="text-sm text-gray-500">{fmt(selectedGroupObj.value)} per coupon · {selectedGroupObj.active_count} active · {selectedGroupObj.used_count} used</p>
                  {selectedGroupObj.note && <p className="text-xs text-gray-400 mt-0.5">{selectedGroupObj.note}</p>}
                </div>
                {canManage && (
                  <button
                    onClick={() => { setGenForm(f => ({ ...f, group_id: selectedGroupObj.id, value: '', count: '1' })); setShowGenerateModal(true); }}
                    className="btn-primary text-sm shrink-0"
                  >
                    + Generate More
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search code, note, recipient…" className="flex-1 min-w-48" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm">
                <option value="all">All statuses</option>
                <option value="active">Active (not given)</option>
                <option value="dispatched">Dispatched (given out)</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-gray-400">Loading…</div>
              ) : coupons.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  No coupons found.
                  {canManage && <button onClick={() => setShowGenerateModal(true)} className="block mx-auto mt-3 btn-primary text-sm">Generate First Coupon</button>}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Issued To</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                      {canManage && <th className="py-3 px-4" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {coupons.map(c => (
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedCoupon(expandedCoupon === c.id ? null : c.id)}>
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold text-gray-900 tracking-wider">{c.code}</span>
                            {c.group_name && <div className="text-xs text-gray-400 mt-0.5">{c.group_name}</div>}
                            {c.note && <div className="text-xs text-gray-400 mt-0.5 italic">{c.note}</div>}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{fmt(c.value)}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900">{fmt(c.remaining_value)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[displayStatus(c)] || ''}`}>
                              {displayStatus(c).charAt(0).toUpperCase() + displayStatus(c).slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{c.issued_to || '—'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          {canManage && (
                            <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                              {c.status === 'active' && (
                                <div className="flex items-center justify-end gap-2">
                                  {/* Dispatch flow (undispatched only) */}
                                  {!c.dispatched_at && (
                                    dispatchingId === c.id ? (
                                      <>
                                        <SearchableSelect
                                          options={dispatchClients.map(cl => ({ value: cl.name, label: cl.phone ? `${cl.name} — ${cl.phone}` : cl.name }))}
                                          value={dispatchName}
                                          onChange={setDispatchName}
                                          placeholder="Search client…"
                                          className="w-48 text-xs"
                                        />
                                        <button
                                          onClick={() => dispatchCoupon(c)}
                                          disabled={dispatching}
                                          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 cursor-pointer"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => { setDispatchingId(null); setDispatchName(''); }}
                                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </>
                                    ) : confirmCancelId !== c.id && (
                                      <button
                                        onClick={() => { setDispatchingId(c.id); setDispatchName(c.issued_to || ''); }}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                      >
                                        Mark as Given
                                      </button>
                                    )
                                  )}

                                  {/* Cancel confirmation */}
                                  {confirmCancelId === c.id ? (
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-500">Cancel this coupon?</span>
                                      <button
                                        onClick={() => { cancelCoupon(c); setConfirmCancelId(null); }}
                                        className="text-red-600 font-semibold hover:text-red-800 cursor-pointer"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setConfirmCancelId(null)}
                                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : dispatchingId !== c.id && (
                                    /* Three-dot menu */
                                    <div
                                      className="relative"
                                      onMouseDown={e => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                                        className="text-gray-400 hover:text-gray-700 px-1 py-0.5 rounded hover:bg-gray-100 cursor-pointer text-base leading-none"
                                        title="More options"
                                      >
                                        ···
                                      </button>
                                      {menuOpenId === c.id && (
                                        <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36">
                                          <button
                                            onClick={() => { setMenuOpenId(null); setEditingCoupon(c); setEditCouponForm({ note: c.note || '', issued_to: c.issued_to || '', expires_at: c.expires_at ? String(c.expires_at).slice(0, 10) : '' }); }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => { setMenuOpenId(null); setConfirmCancelId(c.id); }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                                          >
                                            Cancel coupon
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                        {expandedCoupon === c.id && (c.redemptions.length > 0 || c.dispatched_at) && (
                          <tr key={`${c.id}-expanded`}>
                            <td colSpan={canManage ? 7 : 6} className="bg-gray-50 px-8 py-3 space-y-3">
                              {c.dispatched_at && (
                                <div>
                                  <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">Given Out</p>
                                  <p className="text-xs text-gray-600">
                                    {new Date(c.dispatched_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    {c.issued_to && <span className="ml-2 text-gray-500">→ {c.issued_to}</span>}
                                  </p>
                                </div>
                              )}
                              {c.redemptions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Redemption History</p>
                                  <div className="space-y-1">
                                    {c.redemptions.map(r => (
                                      <div key={r.id} className="flex items-center gap-4 text-xs text-gray-600">
                                        <span>{new Date(r.redeemed_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <span className="text-red-600 font-medium">−{fmt(r.amount_used)}</span>
                                        <span className="text-gray-400">→ {fmt(r.remaining_after)} remaining</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) { setShowGroupModal(false); setEditingGroupId(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{editingGroupId ? 'Edit Group' : 'New Coupon Group'}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Name <span className="text-red-500">*</span></label>
              <input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} className="input w-full" placeholder="e.g. Christmas 2025, VIP Clients" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value per Coupon (UGX) <span className="text-red-500">*</span></label>
              <NumberInput min={1} value={groupForm.value} onChange={e => setGroupForm(f => ({ ...f, value: e.target.value }))} className="input w-full" placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note / Reason <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={groupForm.note} onChange={e => setGroupForm(f => ({ ...f, note: e.target.value }))} className="input w-full" placeholder="e.g. Holiday promotion" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowGroupModal(false); setEditingGroupId(null); }} className="flex-1 btn-secondary text-sm">Cancel</button>
              <button onClick={saveGroup} disabled={savingGroup} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {savingGroup ? 'Saving…' : editingGroupId ? 'Save Changes' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Coupon Modal ── */}
      {editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setEditingCoupon(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Edit Coupon</h3>
              <span className="font-mono text-sm text-gray-400 tracking-wider">{editingCoupon.code}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issued To</label>
              <input value={editCouponForm.issued_to} onChange={e => setEditCouponForm(f => ({ ...f, issued_to: e.target.value }))} className="input w-full" placeholder="Client name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires On</label>
              <input type="date" value={editCouponForm.expires_at} onChange={e => setEditCouponForm(f => ({ ...f, expires_at: e.target.value }))} className="input w-full" />
              {editCouponForm.expires_at && (
                <button type="button" onClick={() => setEditCouponForm(f => ({ ...f, expires_at: '' }))} className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">Remove expiry</button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <input value={editCouponForm.note} onChange={e => setEditCouponForm(f => ({ ...f, note: e.target.value }))} className="input w-full" placeholder="e.g. Birthday gift" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingCoupon(null)} className="flex-1 btn-secondary text-sm">Cancel</button>
              <button onClick={saveEditCoupon} className="flex-1 btn-primary text-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Coupons Modal ── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) setShowGenerateModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Generate Coupons</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={genForm.group_id} onChange={e => onGenGroupChange(e.target.value)} className="input w-full">
                <option value="">— Standalone coupon —</option>
                {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({fmt(g.value)} each)</option>)}
              </select>
            </div>

            {!genForm.group_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (UGX) <span className="text-red-500">*</span></label>
                <NumberInput min={1} value={genForm.value} onChange={e => setGenForm(f => ({ ...f, value: e.target.value }))} className="input w-full" placeholder="e.g. 30000" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <NumberInput min={1} max={500} value={genForm.count} onChange={e => setGenForm(f => ({ ...f, count: e.target.value }))} className="input w-full" placeholder="1" />
              <p className="text-xs text-gray-400 mt-1">Max 500 per batch</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issued To <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={genForm.issued_to} onChange={e => setGenForm(f => ({ ...f, issued_to: e.target.value }))} className="input w-full" placeholder="Client name (if single)" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires On <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" min={new Date().toISOString().split('T')[0]} value={genForm.expires_at} onChange={e => setGenForm(f => ({ ...f, expires_at: e.target.value }))} className="input w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={genForm.note} onChange={e => setGenForm(f => ({ ...f, note: e.target.value }))} className="input w-full" placeholder="e.g. Birthday gift" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowGenerateModal(false)} className="flex-1 btn-secondary text-sm">Cancel</button>
              <button onClick={generate} disabled={generating} className="flex-1 btn-primary text-sm disabled:opacity-50">
                {generating ? 'Generating…' : `Generate ${Number(genForm.count) > 1 ? `${genForm.count} Coupons` : 'Coupon'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
