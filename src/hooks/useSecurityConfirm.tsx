'use client';

import { useState, useCallback } from 'react';
import { useSalon } from '@/contexts/SalonContext';
import { useUser } from '@/contexts/UserContext';

export type ConfirmLevel = 'sensitive' | 'general';

// Module-level grace period — shared across all hook instances in the session.
// After a successful confirm, subsequent actions skip the modal for 2 minutes.
let lastConfirmedAt: number | null = null;
const GRACE_MS = 2 * 60 * 1000;

function isWithinGrace() {
  return lastConfirmedAt !== null && Date.now() - lastConfirmedAt < GRACE_MS;
}

export function useSecurityConfirm() {
  const { salon } = useSalon();
  const { user } = useUser();

  const [pendingResolve, setPendingResolve] = useState<((confirmed: boolean) => void) | null>(null);
  const [credential, setCredential] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const isEnabled = useCallback((level: ConfirmLevel): boolean => {
    if (level === 'sensitive') return salon?.require_confirm_sensitive === true;
    if (level === 'general') return salon?.require_confirm_general === true;
    return false;
  }, [salon]);

  const guardAction = useCallback(async (level: ConfirmLevel, action: () => Promise<void>) => {
    if (!isEnabled(level) || isWithinGrace()) {
      await action();
      return;
    }

    const confirmed = await new Promise<boolean>(resolve => {
      setCredential('');
      setError('');
      setPendingResolve(() => resolve);
    });

    if (confirmed) {
      lastConfirmedAt = Date.now();
      await action();
    }
  }, [isEnabled]);

  const handleVerify = async () => {
    if (!credential.trim()) {
      setError('Please enter your PIN or password');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (res.ok) {
        pendingResolve?.(true);
        setPendingResolve(null);
      } else {
        const d = await res.json();
        setError(d.error || 'Incorrect PIN or password');
      }
    } catch {
      setError('Verification failed, please try again');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = useCallback(() => {
    pendingResolve?.(false);
    setPendingResolve(null);
    setCredential('');
    setError('');
  }, [pendingResolve]);

  const SecurityModal = pendingResolve ? (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Confirm Your Identity</h3>
            <p className="text-sm text-gray-500">This action requires verification</p>
          </div>
        </div>

        {user && (
          <p className="text-sm text-gray-600 mb-4">
            Confirming as <span className="font-semibold text-gray-900">{user.name}</span>
          </p>
        )}

        <input
          type="password"
          value={credential}
          onChange={e => { setCredential(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && !verifying && handleVerify()}
          placeholder="Enter your PIN or password"
          autoFocus
          className={`w-full px-4 py-2.5 border rounded-lg text-sm mb-1 focus:ring-2 focus:outline-none transition-colors ${
            error ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-brand-primary/30'
          }`}
        />

        {error && (
          <p className="text-sm text-red-600 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {!error && <div className="mb-3" />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || !credential.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'hsl(var(--brand-primary))' }}
          >
            {verifying ? 'Verifying…' : 'Confirm'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Once confirmed, you have 2 minutes before being asked again
        </p>
      </div>
    </div>
  ) : null;

  return { guardAction, SecurityModal };
}
