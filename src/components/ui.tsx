'use client';

/**
 * Shared UI primitives used across all app pages.
 * Import from '@/components/ui'.
 */

import { useSalon } from '@/contexts/SalonContext';

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
  const today = new Date().toISOString().split('T')[0];
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
        className="input w-full pl-10"
      />
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
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  center?: boolean;
  valueColor?: string;
  className?: string;
}) {
  return (
    <div className={`card ${accent ?? ''} ${className ?? ''}`}>
      {center ? (
        <div className="text-center">
          <p className={`text-2xl font-bold ${valueColor ?? 'text-gray-900'}`}>{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`font-bold mt-1 ${valueColor ?? 'text-gray-900 text-xl sm:text-2xl'}`}>
              {value}
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
