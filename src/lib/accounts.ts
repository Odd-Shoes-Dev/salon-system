import { sql } from '@/lib/db';

type BalanceCheck =
  | { ok: true; account: { id: string; name: string; balance: number } }
  | { ok: false; status: number; error: string };

// Shared guard for every flow that pays money out of an account (advances,
// expenses, purchases, loan repayments, transfers): confirms the account
// exists, is active, and actually has enough in it, so accounts can't be
// silently driven negative by anything other than a deliberate overdraft.
export async function checkAccountBalance(accountId: string, salonId: string, amount: number): Promise<BalanceCheck> {
  const [account] = await sql`
    SELECT id, name, balance, is_active FROM account_balances
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

  return { ok: true, account: { id: account.id, name: account.name, balance } };
}
