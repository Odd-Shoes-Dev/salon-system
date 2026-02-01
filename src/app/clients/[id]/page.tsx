'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Client, Visit, LoyaltyTier } from '@/types';
import { formatUGX } from '@/lib/utils';

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadClientData();
  }, [params.id]);

  async function loadClientData() {
    try {
      setLoading(true);

      // Load client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', params.id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Load visit history
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          staff:staff_id(name),
          visit_services(
            service_id,
            quantity,
            price,
            service:services(name)
          )
        `)
        .eq('client_id', params.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      // Load loyalty tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('salon_id', clientData.salon_id)
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (tiersError) throw tiersError;
      setLoyaltyTiers(tiersData || []);

    } catch (error) {
      console.error('Error loading client:', error);
      alert('Failed to load client data');
    } finally {
      setLoading(false);
    }
  }

  function getNextTier() {
    if (!client) return null;
    return loyaltyTiers.find(tier => tier.points_required > client.loyalty_points);
  }

  function getAchievedTiers() {
    if (!client) return [];
    return loyaltyTiers.filter(tier => tier.points_required <= client.loyalty_points);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-[#2C2C2C]">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#2C2C2C] mb-4">Client not found</p>
          <button
            onClick={() => router.push('/clients')}
            className="px-6 py-2 bg-[#D4AF37] text-white rounded-lg hover:bg-[#C4A137]"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  const nextTier = getNextTier();
  const achievedTiers = getAchievedTiers();
  const pointsToNext = nextTier ? nextTier.points_required - client.loyalty_points : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => router.push('/pos')}
          className="text-[#2C2C2C] hover:text-[#D4AF37] mb-4 flex items-center gap-2"
        >
          ← Back to POS
        </button>
        <h1 className="text-4xl font-bold text-[#2C2C2C]">Client Profile</h1>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-[#D4AF37]">
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-[#D4AF37] text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold text-[#2C2C2C] mb-1">{client.name}</h2>
              <p className="text-gray-600">{client.phone}</p>
              {client.email && <p className="text-gray-600 text-sm">{client.email}</p>}
            </div>

            <div className="space-y-4">
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">Birthday</p>
                <p className="font-semibold text-[#2C2C2C]">
                  {client.birthday ? new Date(client.birthday).toLocaleDateString() : 'Not set'}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">Total Visits</p>
                <p className="font-semibold text-[#2C2C2C] text-2xl">{client.total_visits}</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="font-semibold text-[#2C2C2C] text-2xl">{formatUGX(client.total_spent)}</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600">Last Visit</p>
                <p className="font-semibold text-[#2C2C2C]">
                  {client.last_visit
                    ? new Date(client.last_visit).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>

              {client.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="text-[#2C2C2C]">{client.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loyalty & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Loyalty Status */}
          <div className="bg-gradient-to-br from-[#D4AF37] to-[#C4A137] rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-2xl font-bold mb-4">✨ Loyalty Status</h3>
            
            <div className="bg-white/20 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg">Current Points</span>
                <span className="text-3xl font-bold">{client.loyalty_points}</span>
              </div>
              
              {nextTier && (
                <>
                  <div className="w-full bg-white/30 rounded-full h-4 mb-2">
                    <div
                      className="bg-white h-4 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (client.loyalty_points / nextTier.points_required) * 100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm">
                    {pointsToNext} points to {nextTier.name}
                  </p>
                </>
              )}
            </div>

            {/* Achieved Tiers */}
            {achievedTiers.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">🎁 Rewards Available:</h4>
                <div className="space-y-2">
                  {achievedTiers.map((tier) => (
                    <div key={tier.id} className="bg-white/20 rounded-lg p-3">
                      <p className="font-semibold">{tier.name}</p>
                      <p className="text-sm">{tier.reward_description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Tier */}
            {nextTier && (
              <div className="bg-white/10 rounded-lg p-3">
                <p className="text-sm mb-1">Next Reward:</p>
                <p className="font-semibold">{nextTier.name}</p>
                <p className="text-sm">{nextTier.reward_description}</p>
              </div>
            )}
          </div>

          {/* Visit History */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-[#2C2C2C] mb-4">Visit History</h3>
            
            {visits.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No visits yet</p>
            ) : (
              <div className="space-y-4">
                {visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-[#D4AF37] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-[#2C2C2C]">
                          {new Date(visit.created_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-gray-600">
                          Receipt: {visit.receipt_number}
                        </p>
                        {visit.staff && (
                          <p className="text-sm text-gray-600">
                            Stylist: {(visit.staff as any).name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#2C2C2C]">
                          {formatUGX(visit.total_amount)}
                        </p>
                        <p className="text-sm text-[#D4AF37] font-semibold">
                          +{visit.points_earned} points
                        </p>
                      </div>
                    </div>

                    {/* Services */}
                    {visit.visit_services && visit.visit_services.length > 0 && (
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <p className="text-sm text-gray-600 mb-2">Services:</p>
                        <div className="space-y-1">
                          {visit.visit_services.map((vs: any) => (
                            <div key={vs.id} className="flex justify-between text-sm">
                              <span>
                                {vs.quantity}x {vs.service?.name || 'Unknown'}
                              </span>
                              <span>{formatUGX(vs.price * vs.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Info */}
                    <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {visit.payment_method.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            visit.payment_status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {visit.payment_status}
                        </span>
                        {visit.whatsapp_sent && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            ✓ WhatsApp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
