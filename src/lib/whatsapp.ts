// WhatsApp messaging utilities for Blue Ox Platform
// Dynamic salon branding

export interface WhatsAppMessage {
  to: string; // Phone number with country code
  message: string;
}

export interface ReceiptData {
  receiptNumber?: string;
  salonName: string;
  salonPhone: string;
  salonAddress?: string;
  clientName: string;
  clientPhone?: string;
  services: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  total: number;
  paymentMethod?: string;
  pointsEarned: number;
  totalPoints: number;
  pointsToNextReward?: number;
}

// Generate WhatsApp receipt message with salon branding
export function generateReceiptMessage(data: ReceiptData): string {
  const servicesList = data.services
    .map(s => `• ${s.name} - UGX ${s.price.toLocaleString()}`)
    .join('\n');

  const rewardMessage = (data.pointsToNextReward ?? 0) > 0
    ? `${data.pointsToNextReward} points until next reward!`
    : `You've earned a FREE service! Ask staff to redeem.`;

  return `*${data.salonName}*

Thank you for visiting, ${data.clientName}!

*Services:*
${servicesList}

*Total:* UGX ${data.total.toLocaleString()}

*Loyalty Points:*
Points Earned: +${data.pointsEarned}
Total Points: ${data.totalPoints}
${rewardMessage}

See you again!

Phone: ${data.salonPhone}${data.salonAddress ? `\nAddress: ${data.salonAddress}` : ''}

_Powered by Blue Ox_`;
}

// Send WhatsApp message (Demo mode)
export async function sendWhatsAppMessage(data: WhatsAppMessage): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  // DEMO MODE: Just log and return success
  // In production, integrate with WhatsApp Business Cloud API or Twilio
  
  console.log('WhatsApp Message (DEMO MODE):');
  console.log(`To: ${data.to}`);
  console.log(`Message: ${data.message}`);
  console.log('---');

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // For demo, always return success
  return {
    success: true,
    messageId: `demo_${Date.now()}`,
  };
}

// Send receipt via WhatsApp
export async function sendReceipt(receiptData: ReceiptData): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!receiptData.clientPhone) {
    return {
      success: false,
      error: 'Client phone number is required',
    };
  }

  const message = generateReceiptMessage(receiptData);
  
  const result = await sendWhatsAppMessage({
    to: receiptData.clientPhone,
    message,
  });

  return result;
}

// Production WhatsApp API integration (for reference)
export async function sendWhatsAppProduction(data: WhatsAppMessage): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  // TODO: Implement actual WhatsApp Business Cloud API
  // const apiKey = process.env.WHATSAPP_API_KEY;
  // const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  
  try {
    // Example with WhatsApp Cloud API:
    // const response = await fetch(
    //   `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Bearer ${apiKey}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       messaging_product: 'whatsapp',
    //       to: data.to,
    //       type: 'text',
    //       text: { body: data.message },
    //     }),
    //   }
    // );
    
    // return { success: true, messageId: response.messages[0].id };
    
    return { success: false, error: 'Production API not implemented yet' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
