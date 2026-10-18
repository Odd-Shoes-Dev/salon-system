import { normalizePhoneNumber } from '@/lib/esms';
import type {
  SmsProvider,
  SmsBalance,
  SmsStats,
  SmsMessage,
  SmsTransaction,
  MessagesParams,
  MessagesResult,
  TransactionsResult,
  TopupResult,
  SendResult,
} from '../types';

const BASE_URL = 'https://app.sms.ug/api/';

// sms.ug — the only provider here that can reach MTN numbers. Their content
// filter rejects messages containing the words "code", "OTP", or "passcode"
// (keyword match, confirmed by testing — not a semantic OTP detector), so
// callers sending anything code-like need to word around those words.
export class SmsUgProvider implements SmsProvider {
  private readonly apiKey = process.env.SMSUG_API_KEY ?? '';

  async sendMessage(to: string, text: string): Promise<SendResult> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Salon Notification',
        message: text,
        contacts: [normalizePhoneNumber(to)],
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'success') {
      console.error('[sms.ug] sendMessage failed', res.status, data);
      throw new Error(data?.message ?? `sms.ug send failed (HTTP ${res.status})`);
    }

    return { id: data.token ?? '', status: 'sent' };
  }

  // sms.ug's documented API only covers sending — no balance/history/topup
  // endpoints exist yet, so these are stubs rather than real account data.
  async getBalance(): Promise<SmsBalance> {
    return { balance: 0, currency: 'UGX' };
  }

  async getStats(): Promise<SmsStats> {
    return { delivery_rate: 0, total_sent: 0, total_failed: 0 };
  }

  async getMessages(_params?: MessagesParams): Promise<MessagesResult> {
    return { messages: [] as SmsMessage[], total: 0, page: 0, limit: 0 };
  }

  async getTransactions(_params?: { page?: number; limit?: number }): Promise<TransactionsResult> {
    return { transactions: [] as SmsTransaction[], total: 0 };
  }

  async initiateTopup(): Promise<TopupResult> {
    throw new Error('Top-up not supported via API. Please top up from the sms.ug dashboard.');
  }
}
