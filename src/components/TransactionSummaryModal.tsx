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

        <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={handleNotifyCustomer}
            disabled={notifying || notified}
            className="px-5 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {notifying ? 'Sending...' : notified ? 'Customer Notified' : 'Notify Customer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white bg-gray-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
