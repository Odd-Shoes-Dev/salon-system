'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSalon } from '@/contexts/SalonContext';

export interface TransactionSummaryData {
  receiptNumber: string;
  clientName: string;
  clientPhone: string;
  services: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  pointsEarned: number;
  paymentMethod: string;
  workerName?: string;
  date?: string;
}

interface TransactionSummaryModalProps {
  transaction: TransactionSummaryData;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}

export function TransactionSummaryModal({
  transaction,
  onClose,
  formatCurrency,
}: TransactionSummaryModalProps) {
  const { salon } = useSalon();
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  const brandColor = salon?.theme_primary_color || '#E31C23';

  const printReceipt = () => {
    const receiptDate = transaction.date
      ? new Date(transaction.date).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

    const servicesRows = transaction.services
      .map(
        s =>
          `<tr>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0">${s.name}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:center">${s.quantity}</td>
            <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${formatCurrency(s.unitPrice * s.quantity)}</td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${transaction.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; width: 300px; margin: 0 auto; padding: 16px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
    .logo { font-size: 18px; font-weight: bold; color: ${brandColor}; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 4px; border-bottom: 2px solid #ccc; font-size: 11px; text-transform: uppercase; }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3) { text-align: right; }
    .total-row td { padding: 8px 4px 4px; font-weight: bold; font-size: 14px; }
    .total-row td:last-child { text-align: right; }
    .points { text-align: center; margin-top: 10px; font-size: 12px; color: #555; }
    .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #888; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div class="center" style="margin-bottom:12px">
    ${salon?.logo_url
      ? `<img src="${salon.logo_url}" alt="${salon?.name ?? 'Salon'}" style="max-height:64px;max-width:180px;object-fit:contain;margin:0 auto 8px;display:block;" />`
      : `<div style="width:56px;height:56px;border-radius:50%;background:${brandColor};color:#fff;font-size:24px;font-weight:bold;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;line-height:56px;">${(salon?.name ?? 'S').charAt(0).toUpperCase()}</div>`
    }
    <div class="logo">${salon?.name ?? 'Salon'}</div>
    ${salon?.address ? `<div style="font-size:11px;color:#555;margin-top:2px">${salon.address}</div>` : ''}
    ${salon?.phone ? `<div style="font-size:11px;color:#555">${salon.phone}</div>` : ''}
  </div>
  <hr class="divider" />
  <div style="margin-bottom:8px;font-size:12px">
    <div><span class="bold">Receipt:</span> ${transaction.receiptNumber}</div>
    <div><span class="bold">Date:</span> ${receiptDate}</div>
    <div><span class="bold">Client:</span> ${transaction.clientName}</div>
    ${transaction.clientPhone ? `<div><span class="bold">Phone:</span> ${transaction.clientPhone}</div>` : ''}
    ${transaction.workerName ? `<div><span class="bold">Served by:</span> ${transaction.workerName}</div>` : ''}
  </div>
  <hr class="divider" />
  <table>
    <thead><tr><th>Service</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>${servicesRows}</tbody>
    <tr class="total-row">
      <td colspan="2">TOTAL</td>
      <td>${formatCurrency(transaction.total)}</td>
    </tr>
  </table>
  <hr class="divider" />
  <div style="text-align:center;font-size:12px;margin-top:6px">
    <span class="bold">Payment:</span> ${formatPaymentMethod(transaction.paymentMethod)}
  </div>
  ${transaction.pointsEarned > 0 ? `<div class="points">&#9733; ${transaction.pointsEarned} loyalty points earned</div>` : ''}
  <div class="footer">Thank you for visiting ${salon?.name ?? 'us'}!<br/>Please come again.</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const formatPaymentMethod = (paymentMethod: string) => {
    if (paymentMethod === 'mtn_mobile_money') return 'MTN Mobile Money';
    if (paymentMethod === 'airtel_money') return 'Airtel Money';
    if (paymentMethod === 'cash') return 'Cash';
    return paymentMethod;
  };

  const handleNotifyCustomer = async () => {
    if (!transaction.clientPhone) {
      toast.error('Customer phone number is missing');
      return;
    }

    setNotifying(true);

    const servicesText = transaction.services
      .map((service) => `${service.name} x${service.quantity}`)
      .join(', ');

    const fallbackText = `Thank you ${transaction.clientName} for visiting ${salon?.name || 'our salon'}. Receipt: ${transaction.receiptNumber}. Services: ${servicesText}. Total: ${formatCurrency(transaction.total)}. Points earned: ${transaction.pointsEarned}.`;

    const renderTemplate = (template: string) => {
      const map: Record<string, string> = {
        salonName: salon?.name || 'Salon',
        clientName: transaction.clientName,
        services: servicesText,
        total: transaction.total.toLocaleString(),
        pointsEarned: String(transaction.pointsEarned),
        totalPoints: '-',
        receiptNumber: transaction.receiptNumber,
        paymentMethod: formatPaymentMethod(transaction.paymentMethod),
      };

      return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key: string) => map[key] ?? '');
    };

    try {
      let text = fallbackText;

      const templateResponse = await fetch('/api/sms/template');
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        if (templateData?.template) {
          text = renderTemplate(templateData.template);
        }
      }

      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: transaction.clientPhone,
          text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send SMS');
      }

      setNotified(true);
      toast.success('Customer notified successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send SMS');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b">
          <h3 className="text-lg font-semibold">Transaction Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Customer Name</p>
              <p className="font-semibold text-gray-900">{transaction.clientName}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Phone Number</p>
              <p className="font-semibold text-gray-900">{transaction.clientPhone}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Receipt Number</p>
              <p className="font-semibold text-gray-900">{transaction.receiptNumber}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase mb-1">Payment Method</p>
              <p className="font-semibold text-gray-900">{formatPaymentMethod(transaction.paymentMethod)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Services Provided</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {transaction.services.map((service, index) => (
                <div key={`${service.name}-${index}`} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-600">Qty: {service.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(service.unitPrice * service.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="font-medium text-gray-700">Points Earned</p>
            <p className="text-lg font-bold text-brand-primary">+{transaction.pointsEarned}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-lg font-semibold text-gray-900">Total</p>
            <p className="text-2xl font-bold text-brand-primary">{formatCurrency(transaction.total)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pt-4 border-t bg-gray-50">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleNotifyCustomer}
              disabled={notifying || notified}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
              style={{ backgroundColor: brandColor }}
            >
              {notifying ? 'Sending...' : notified ? 'Notified ✓' : 'Notify via SMS'}
            </button>
            <button
              type="button"
              onClick={printReceipt}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white bg-white text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white bg-gray-100 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
