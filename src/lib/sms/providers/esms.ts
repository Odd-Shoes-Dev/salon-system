import { toGsm7Safe, normalizePhoneNumber } from '@/lib/esms';
import type {
  SmsProvider, SendResult, SmsBalance, SmsMessage, SmsStatus,
  SmsStats, SmsTransaction, MessagesParams, MessagesResult,
  TransactionsResult, TopupResult,
} from '../types';

const BASE = 'https://sms.esmsafrica.io/api';

function getHeaders() {
  const key = process.env.ESMS_API_KEY;
  if (!key) throw new Error('Missing ESMS_API_KEY environment variable');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: getHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.reason || data.message || `eSMS error ${res.status}`);
  return data;
}

function normalizeStatus(s: string): SmsStatus {
  const map: Record<string, SmsStatus> = {
    delivered: 'delivered',
    failed:    'failed',
    queued:    'queued',
    submitted: 'submitted',
    scheduled: 'scheduled',
    dripping:  'sending',
  };
  return map[s] ?? 'queued';
}

function normalizeMessage(m: any): SmsMessage {
  return {
    id:           String(m.id),
    phone:        m.phone ?? '',
    text:         m.text  ?? '',
    status:       normalizeStatus(m.status),
    error_code:   m.error_code ?? null,
    segments:     Number(m.segments  ?? 1),
    cost:         Number(m.cost      ?? 0),
    currency:     m.currency ?? 'USD',
    sent_at:      m.created_at,
    delivered_at: m.delivered_at ?? null,
  };
}

export class EsmsProvider implements SmsProvider {
  async sendMessage(to: string, text: string): Promise<SendResult> {
    const data = await apiFetch('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        to:   normalizePhoneNumber(to),
        text: toGsm7Safe(text),
      }),
    });
    return { id: String(data.messageId ?? data.id ?? ''), status: data.status ?? 'queued' };
  }

  async getBalance(): Promise<SmsBalance> {
    const data = await apiFetch('/balance');
    return { balance: Number(data.balance), currency: data.currency ?? 'USD' };
  }

  async getMessages(params: MessagesParams = {}): Promise<MessagesResult> {
    const qs = new URLSearchParams({
      page:  String(params.page  ?? 0),
      limit: String(params.limit ?? 25),
    });
    if (params.status) qs.set('status', params.status);
    const data = await apiFetch(`/messages?${qs}`);
    return {
      messages: (data.messages ?? []).map(normalizeMessage),
      total:    data.total ?? 0,
      page:     data.page  ?? 0,
      limit:    data.limit ?? 25,
    };
  }

  async getStats(): Promise<SmsStats> {
    const data = await apiFetch('/messages/stats');
    return {
      delivery_rate: Number(data.delivery_rate ?? data.deliveryRate ?? 0),
      total_sent:    Number(data.total_sent    ?? data.totalSent    ?? data.total  ?? 0),
      total_failed:  Number(data.total_failed  ?? data.totalFailed  ?? data.failed ?? 0),
    };
  }

  async getTransactions(params: { page?: number; limit?: number } = {}): Promise<TransactionsResult> {
    const qs = new URLSearchParams({
      page:  String(params.page  ?? 0),
      limit: String(params.limit ?? 20),
    });
    const data = await apiFetch(`/balance/transactions?${qs}`);
    const transactions: SmsTransaction[] = (data.transactions ?? []).map((tx: any) => ({
      id:            tx.id,
      type:          tx.type,
      amount:        Number(tx.amount),
      balance_after: Number(tx.balance_after),
      currency:      tx.currency    ?? 'USD',
      description:   tx.description ?? '',
      created_at:    tx.created_at,
    }));
    return { transactions, total: data.total ?? 0 };
  }

  async initiateTopup(): Promise<TopupResult> {
    const data = await apiFetch('/balance/topup', { method: 'POST' });
    return { checkout_url: data.checkout_url, message: data.message };
  }
}
