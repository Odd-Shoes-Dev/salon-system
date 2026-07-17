import https from 'node:https';
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

function request(
  method: string,
  path: string,
  headers: Record<string, string | number>,
  body?: string,
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'api.africastalking.com', path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk: string) => { raw += chunk; });
        res.on('end', () => {
          let data: any = {};
          try { data = JSON.parse(raw); } catch { data = { _raw: raw }; }
          resolve({ status: res.statusCode ?? 0, data });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export class AfricasTalkingProvider implements SmsProvider {
  private readonly apiKey   = process.env.AT_API_KEY   ?? '';
  private readonly username = process.env.AT_USERNAME  ?? '';
  private readonly senderId = process.env.AT_SENDER_ID ?? '';

  async sendMessage(to: string, text: string): Promise<SendResult> {
    const payload: Record<string, any> = {
      username:     this.username,
      phoneNumbers: [to],
      message:      text,
    };
    if (this.senderId) payload.senderId = this.senderId;

    const body = JSON.stringify(payload);
    const { status, data } = await request(
      'POST',
      '/version1/messaging/bulk',
      {
        apiKey:           this.apiKey,
        Accept:           'application/json',
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      body,
    );

    if (status !== 201) {
      console.error('[AT] sendMessage failed', status, data);
      throw new Error(data?.SMSMessageData?.Message ?? data?._raw ?? `Send failed (HTTP ${status})`);
    }

    const recipient = data?.SMSMessageData?.Recipients?.[0];
    const statusCode = Number(recipient?.statusCode ?? 500);
    if (statusCode >= 400) throw new Error(recipient?.status ?? 'Send failed');

    return { id: recipient?.messageId ?? '', status: recipient?.status ?? 'sent' };
  }

  async getBalance(): Promise<SmsBalance> {
    const { status, data } = await request(
      'GET',
      `/version1/user?username=${encodeURIComponent(this.username)}`,
      {
        apiKey: this.apiKey,
        Accept: 'application/json',
      },
    );

    if (status !== 200) {
      console.error('[AT] getBalance failed', status, data);
      throw new Error(data?.errorMessage ?? data?._raw ?? `AT error ${status}`);
    }

    // Response: { userData: { balance: "UGX 285.3763" } }
    const raw: string = data?.userData?.balance ?? '0';
    const parts = raw.trim().split(' ');
    const currency = parts.length >= 2 ? parts[0] : 'USD';
    const balance  = parseFloat(parts[parts.length - 1] ?? '0');
    return { balance: isNaN(balance) ? 0 : balance, currency };
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
    throw new Error("Top-up not supported via API. Please top up at account.africastalking.com.");
  }
}
