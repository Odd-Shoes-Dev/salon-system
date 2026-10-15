import type { SmsProvider, SendResult } from './types';
import { EsmsProvider } from './providers/esms';
import { AfricasTalkingProvider } from './providers/africastalking';
import { SmsUgProvider } from './providers/smsug';

function createDefaultProvider(): SmsProvider {
  const name = (process.env.SMS_PROVIDER ?? 'esms').toLowerCase();
  switch (name) {
    case 'esms':
      return new EsmsProvider();
    case 'africastalking':
      return new AfricasTalkingProvider();
    default:
      throw new Error(`Unknown SMS provider: "${name}". Set SMS_PROVIDER in your environment.`);
  }
}

// Uganda MTN prefixes (076/077/078/079). Anything else (070/071/072/073/074/075,
// or a non-Uganda number) uses the default provider — safe fallback, since
// that's the provider already known to work for non-MTN traffic.
function isMtnNumber(phone: string): boolean {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('256')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  const prefix = digits.slice(0, 2);
  return ['76', '77', '78', '79'].includes(prefix);
}

const defaultProvider = createDefaultProvider();
const smsUgProvider = new SmsUgProvider();

// sms.ug is the only provider that can reach MTN — route by recipient
// network for sendMessage, but keep account-level operations (balance,
// history, stats, topup) on the default provider, since sms.ug's send-only
// API doesn't expose those and those operations aren't per-recipient anyway.
export const smsProvider: SmsProvider = {
  sendMessage(to: string, text: string): Promise<SendResult> {
    return isMtnNumber(to) ? smsUgProvider.sendMessage(to, text) : defaultProvider.sendMessage(to, text);
  },
  getBalance:      () => defaultProvider.getBalance(),
  getMessages:     (params) => defaultProvider.getMessages(params),
  getStats:        () => defaultProvider.getStats(),
  getTransactions: (params) => defaultProvider.getTransactions(params),
  initiateTopup:   () => defaultProvider.initiateTopup(),
};

export type {
  SmsProvider,
  SmsMessage,
  SmsBalance,
  SmsStats,
  SmsTransaction,
  SmsStatus,
  MessagesParams,
  MessagesResult,
  TransactionsResult,
  TopupResult,
  SendResult,
} from './types';
