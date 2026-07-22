export interface WhatsAppMessage {
  to: string;
  message: string;
}

export interface ReceiptData {
  receiptNumber?: string;
  salonName: string;
  salonPhone: string;
  salonAddress?: string;
  clientName: string;
  clientPhone?: string;
  services: Array<{ name: string; price: number; quantity?: number }>;
  total: number;
  paymentMethod?: string;
  pointsEarned: number;
  totalPoints: number;
  pointsToNextReward?: number;
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
}

export function generateReceiptMessage(data: ReceiptData): string {
  const method = data.paymentMethod || 'Cash';
  return `Hello ${data.clientName}. Thank you for visiting ${data.salonName}. Your ${method} payment of UGX ${data.total.toLocaleString()} has been received with receipt ${data.receiptNumber || 'N/A'}. You have also earned ${data.pointsEarned} points redeemable on your next visit.\n\nThank you and see you again soon!`;
}

export async function sendWhatsAppMessage(
  data: WhatsAppMessage,
  credentials?: WhatsAppCredentials,
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!credentials?.phoneNumberId || !credentials?.accessToken) {
    // Demo / not configured — log only
    console.log('[WhatsApp DEMO] To:', data.to, '| Message:', data.message);
    return { success: true, messageId: `demo_${Date.now()}` };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: data.to,
          type: 'text',
          text: { body: data.message },
        }),
      },
    );

    const json = await res.json();

    if (!res.ok) {
      console.error('[WhatsApp] API error:', json);
      return { success: false, error: json?.error?.message ?? 'WhatsApp API error' };
    }

    return { success: true, messageId: json?.messages?.[0]?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendReceipt(
  receiptData: ReceiptData,
  credentials?: WhatsAppCredentials,
): Promise<{ success: boolean; error?: string }> {
  if (!receiptData.clientPhone) {
    return { success: false, error: 'Client phone number is required' };
  }

  const message = generateReceiptMessage(receiptData);
  return sendWhatsAppMessage({ to: receiptData.clientPhone, message }, credentials);
}
