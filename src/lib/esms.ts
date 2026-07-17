// Utilities for SMS message formatting and phone normalisation.
// Provider-specific API calls live in src/lib/sms/ — do not add them here.

export interface SmsTemplateVariables {
  salonName: string;
  clientName: string;
  services: string;
  total: string;
  pointsEarned: string;
  totalPoints: string;
  receiptNumber: string;
  paymentMethod: string;
}

// Strip characters outside the GSM-7 character set so messages use standard
// encoding (160 chars/segment). Emojis and fancy Unicode force UCS-2 mode
// (70 chars/segment) which many African carrier gateways reject outright.
export function toGsm7Safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/€/g, 'EUR')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E\n\r]/g, '');
}

export function normalizePhoneNumber(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.startsWith('0') && digitsOnly.length >= 10) {
    return `+256${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.length >= 9) {
    return `+${digitsOnly}`;
  }
  return trimmed;
}

export function renderSmsTemplate(template: string, vars: SmsTemplateVariables): string {
  return template
    .replaceAll('{salonName}', vars.salonName)
    .replaceAll('{clientName}', vars.clientName)
    .replaceAll('{services}', vars.services)
    .replaceAll('{total}', vars.total)
    .replaceAll('{pointsEarned}', vars.pointsEarned)
    .replaceAll('{totalPoints}', vars.totalPoints)
    .replaceAll('{receiptNumber}', vars.receiptNumber)
    .replaceAll('{paymentMethod}', vars.paymentMethod);
}

export function getDefaultReceiptSmsTemplate(): string {
  return (
    'Hi {clientName}, thank you for visiting {salonName}! Services: {services}. Total: UGX {total} ({paymentMethod}), receipt {receiptNumber}. Points: {pointsEarned}. See you soon!'
  );
}
