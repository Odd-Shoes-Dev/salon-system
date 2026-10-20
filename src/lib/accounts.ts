import { sql } from '@/lib/db';

type BalanceCheck =
  | { ok: true; account: { id: string; name: string; type: string; balance: number } }
  | { ok: false; status: number; error: string };

// Shared guard for every flow that pays money out of an account (advances,
// expenses, purchases, loan repayments, transfers): confirms the account
// exists, is active, and actually has enough in it, so accounts can't be
// silently driven negative by anything other than a deliberate overdraft.
export async function checkAccountBalance(accountId: string, salonId: string, amount: number): Promise<BalanceCheck> {
  const [account] = await sql`
    SELECT id, name, type, balance, is_active FROM account_balances
    WHERE id = ${accountId} AND salon_id = ${salonId}`;

  if (!account) return { ok: false, status: 404, error: 'Account not found' };
  if (!account.is_active) return { ok: false, status: 400, error: 'Account is inactive' };

  const balance = Number(account.balance || 0);
  if (amount > balance) {
    return {
      ok: false,
      status: 400,
      error: `Insufficient balance. ${account.name} has ${balance.toLocaleString('en-UG')} UGX available.`,
    };
  }

  return { ok: true, account: { id: account.id, name: account.name, type: account.type, balance } };
}

// Resolves which account a payment coming IN (a sale, a balance payment)
// lands on. No balance floor applies here — money arriving can never drive
// an account negative. If accountId is given (the caller picked a specific
// account, e.g. a bank account beyond the three system ones), use it
// directly; otherwise fall back to the salon's system account matching
// paymentMethod (cash/mtn_mobile_money/airtel_money) — the original,
// unchanged behavior.
export async function resolveInflowAccount(
  salonId: string,
  paymentMethod: string,
  accountId?: string | null
): Promise<{ id: string; type: string } | null> {
  if (accountId) {
    const [account] = await sql`
      SELECT id, type FROM accounts
      WHERE id = ${accountId} AND salon_id = ${salonId} AND is_active = true`;
    return account ? { id: account.id, type: account.type } : null;
  }
  const [account] = await sql`
    SELECT id, type FROM accounts
    WHERE salon_id = ${salonId} AND type = ${paymentMethod} AND is_system = true`;
  return account ? { id: account.id, type: account.type } : null;
}

// The payment_method text stored on visits/expenses — when a specific
// account was chosen, label it by that account's type (a generic "expense"
// system account displays as "bank") rather than echoing back whatever the
// caller sent.
export function labelForAccountType(type: string): string {
  return type === 'expense' ? 'bank' : type;
}
