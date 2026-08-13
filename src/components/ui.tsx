'use client';

/**
 * Shared UI primitives used across all app pages.
 * Import from '@/components/ui'.
 */

import { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { localDateStr } from '@/lib/utils';

// ─── useHiddenCards ────────────────────────────────────────────────────────────
// Reusable hook for hiding/revealing money stat cards with localStorage persistence.
export function useHiddenCards<K extends string>(storageKey: string, keys: readonly K[]) {
  const [hidden, setHidden] = useState<Set<K>>(() => new Set(keys));
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setHidden(new Set(JSON.parse(saved) as K[]));
  }, [storageKey]);
  const allHidden = hidden.size === keys.length;
  const toggle = (key: K) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };
  const toggleAll = () => {
    const next = allHidden ? new Set<K>() : new Set(keys);
    setHidden(next);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
  };
  return { hidden, allHidden, toggle, toggleAll, isHidden: (k: K) => hidden.has(k) };
}

// ─── PageHeader ────────────────────────────────────────────────────────────────
// Standardises the title + subtitle + optional action button row at the top of
// list pages (Clients, Services, Staff, Add-ons, etc.).

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex gap-2">{action}</div>}
    </div>
  );
}

// ─── PeriodSelector ────────────────────────────────────────────────────────────
// The branded pill-group period switcher (Today / This Week / This Month /
// Custom…). Used on Dashboard, Expenses, Reports, Bookings, Workers.

export function PeriodSelector({
  periods,
  value,
  onChange,
  label,
}: {
  periods: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { salon } = useSalon();
  const brandColor = salon?.theme_primary_color || '#E31C23';

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-500 mb-2">{label}</label>
      )}
      <div className="inline-flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
        {periods.map(p => {
          const active = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              style={active ? { backgroundColor: brandColor, color: '#fff' } : {}}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                active ? 'shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DateRangePicker ───────────────────────────────────────────────────────────
// The From / To date input pair that appears when "Custom" period is selected.

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const today = localDateStr();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={from}
          max={to || today}
          onChange={e => onFromChange(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={to}
          min={from || undefined}
          max={today}
          onChange={e => onToChange(e.target.value)}
          className="input"
        />
      </div>
    </div>
  );
}

// ─── SearchInput ───────────────────────────────────────────────────────────────
// Text input with a magnifier icon, used on list pages for client-side search.

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input w-full"
        style={{ paddingLeft: '2.5rem' }}
      />
    </div>
  );
}

// ─── NumberInput ───────────────────────────────────────────────────────────────
// Drop-in replacement for <input type="number"> that prevents accidental scroll
// wheel changes by blurring the input on wheel events.

export function NumberInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="number"
      className={className}
      onWheel={e => e.currentTarget.blur()}
    />
  );
}

// ─── SearchableSelect ──────────────────────────────────────────────────────────
// Combobox-style select with live search filtering. Accepts flat options array
// of { value, label } pairs. Designed for dropdowns with many items.

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  className = '',
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );
  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        className="input w-full pr-8"
        placeholder={placeholder}
        value={open ? search : selectedLabel}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        readOnly={!open}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(o => (
            <button
              key={o.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                value === o.value ? 'font-medium text-blue-600 bg-blue-50' : 'text-gray-700'
              }`}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
                setSearch('');
              }}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No options match</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
// Summary stat card with optional accent border, optional icon, and optional
// centred layout (for birthday-style stacked value/label cards).
//
// accent   — Tailwind border classes e.g. 'border-l-4 border-green-500'
// center   — stack value above label, centred (birthdays / accounts strip)
// valueColor — override the value text colour (e.g. 'text-green-600')
// icon     — small SVG ReactNode shown on the right for non-centred cards

export function StatCard({
  label,
  value,
  icon,
  accent,
  center,
  valueColor,
  className,
  hidden,
  onToggle,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  center?: boolean;
  valueColor?: string;
  className?: string;
  hidden?: boolean;
  onToggle?: () => void;
}) {
  const masked = <span className="select-none tracking-widest">***</span>;
  const displayValue = hidden ? masked : value;

  const eyeBtn = onToggle ? (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className="p-0.5 rounded text-gray-300 hover:text-gray-500 transition-colors shrink-0"
      title={hidden ? 'Show value' : 'Hide value'}
    >
      {hidden ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  ) : null;

  return (
    <div className={`card ${accent ?? ''} ${className ?? ''}`}>
      {center ? (
        <div className="text-center">
          <div className="flex justify-end">{eyeBtn}</div>
          <p className={`text-2xl font-bold ${valueColor ?? 'text-gray-900'}`}>{displayValue}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm text-gray-500">{label}</p>
              {eyeBtn}
            </div>
            <p className={`font-bold mt-1 ${valueColor ?? 'text-gray-900 text-xl sm:text-2xl'}`}>
              {displayValue}
            </p>
          </div>
          {icon && (
            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center shrink-0 text-brand-primary">
              {icon}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
