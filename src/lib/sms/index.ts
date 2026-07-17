import type { SmsProvider } from './types';
import { EsmsProvider } from './providers/esms';
import { AfricasTalkingProvider } from './providers/africastalking';

function createProvider(): SmsProvider {
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

export const smsProvider: SmsProvider = createProvider();

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
