export interface SmsBalance {
  balance: number;
  currency: string;
}

export type SmsStatus = 'queued' | 'submitted' | 'scheduled' | 'sending' | 'delivered' | 'failed';

export interface SmsMessage {
  id: string;
  phone: string;
  text: string;
  status: SmsStatus;
  error_code: string | null;
  segments: number;
  cost: number;
  currency: string;
  sent_at: string;
  delivered_at: string | null;
}

export interface SmsStats {
  delivery_rate: number;
  total_sent: number;
  total_failed: number;
}

export interface SmsTransaction {
  id: string | number;
  type: 'credit' | 'sms_charge' | 'manual_credit' | 'manual_debit' | 'refund';
  amount: number;
  balance_after: number;
  currency: string;
  description: string;
  created_at: string;
}

export interface MessagesParams {
  status?: string;
  page?: number;
  limit?: number;
}

export interface MessagesResult {
  messages: SmsMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionsResult {
  transactions: SmsTransaction[];
  total: number;
}

export interface TopupResult {
  checkout_url: string;
  message?: string;
}

export interface SendResult {
  id: string;
  status: string;
}

export interface SmsProvider {
  sendMessage(to: string, text: string): Promise<SendResult>;
  getBalance(): Promise<SmsBalance>;
  getMessages(params?: MessagesParams): Promise<MessagesResult>;
  getStats(): Promise<SmsStats>;
  getTransactions(params?: { page?: number; limit?: number }): Promise<TransactionsResult>;
  initiateTopup(): Promise<TopupResult>;
}
