'use client';

import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

// Promise-based, styled replacement for window.confirm() — same shape as
// useSecurityConfirm's guardAction so call sites read the same way:
//   if (!await confirm({ title, message })) return;
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [pendingResolve, setPendingResolve] = useState<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setOptions(opts);
      setPendingResolve(() => resolve);
    });
  }, []);

  const handleCancel = useCallback(() => {
    pendingResolve?.(false);
    setPendingResolve(null);
    setOptions(null);
  }, [pendingResolve]);

  const handleConfirm = useCallback(() => {
    pendingResolve?.(true);
    setPendingResolve(null);
    setOptions(null);
  }, [pendingResolve]);

  const ConfirmModal = options ? (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-2">{options.title}</h3>
        <p className="text-sm text-gray-600 mb-5">{options.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            autoFocus
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 ${options.danger ? 'bg-red-600' : ''}`}
            style={options.danger ? undefined : { backgroundColor: 'hsl(var(--brand-primary))' }}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmModal };
}
