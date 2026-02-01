'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Client, LoyaltyTier } from '@/types';
import { formatCurrency } from '@/lib/utils';

export default function LoyaltyOverviewPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'eligible' | 'high-points'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Get salon_id from first client (in production, get from auth context)
      const { data: allClients } = await supabase
        .from('clients')
        .select('*')
        .order('loyalty_points', { ascending: false });

      if (!allClients || allClients.length === 0) {
        setLoading(false);
        return;
      }

      setClients(allClients);

      // Load loyalty tiers
      const { data: tiersData } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .eq('salon_id', allClients[0].salon_id)
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      setTiers(tiersData || []);
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEligibleRewards(client: Client) {
    return tiers.filter(tier => tier.points_required <= client.loyalty_points);
  }

  function getNextTier(client: Client) {
    return tiers.find(tier => tier.points_required > client.loyalty_points);
  }

  const filteredClients = clients.filter((client) => {
    if (filter === 'eligible') {
      return getEligibleRewards(client).length > 0;
    }
    if (filter === 'high-points') {
      return client.loyalty_points >= 500;
    }
    return true;
  });

  const totalPoints = clients.reduce((sum, c) => sum + c.loyalty_points, 0);
  const eligibleCount = clients.filter(c => getEligibleRewards(c).length > 0).length;
  const avgPoints = clients.length > 0 ? Math.round(totalPoints / clients.length) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-4"></div>
          <p className="text-[#2C2C2C]">Loading loyalty data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[#2C2C2C] hover:text-[#D4AF37] mb-4 flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-4xl font-bold text-[#2C2C2C] mb-2">✨ Loyalty Program</h1>
        <p className="text-gray-600">Manage client rewards and loyalty points</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#D4AF37]">
            <p className="text-gray-600 text-sm mb-1">Total Members</p>
            <p className="text-3xl font-bold text-[#2C2C2C]">{clients.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm mb-1">Eligible for Rewards</p>
            <p className="text-3xl font-bold text-[#2C2C2C]">{eligibleCount}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm mb-1">Total Points</p>
            <p className="text-3xl font-bold text-[#2C2C2C]">{totalPoints.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm mb-1">Avg Points/Client</p>
            <p className="text-3xl font-bold text-[#2C2C2C]">{avgPoints}</p>
          </div>
        </div>

        {/* Loyalty Tiers */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-[#2C2C2C] mb-4">Loyalty Tiers</h2>
          
          {tiers.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No loyalty tiers configured</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map((tier) => {
                const clientsInTier = clients.filter(
                  c => c.loyalty_points >= tier.points_required
                ).length;

                return (
                  <div
                    key={tier.id}
                    className="border-2 border-[#D4AF37] rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-[#2C2C2C]">{tier.name}</h3>
                      <span className="bg-[#D4AF37] text-white text-xs px-2 py-1 rounded">
                        {tier.points_required} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{tier.reward_description}</p>
                    <p className="text-sm font-semibold text-[#D4AF37]">
                      {clientsInTier} client{clientsInTier !== 1 ? 's' : ''} qualified
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Client List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#2C2C2C]">Client Points</h2>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-[#D4AF37] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({clients.length})
              </button>
              <button
                onClick={() => setFilter('eligible')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'eligible'
                    ? 'bg-[#D4AF37] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Eligible ({eligibleCount})
              </button>
              <button
                onClick={() => setFilter('high-points')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'high-points'
                    ? 'bg-[#D4AF37] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                High Points
              </button>
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No clients found</p>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client) => {
                const eligibleRewards = getEligibleRewards(client);
                const nextTier = getNextTier(client);

                return (
                  <div
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-[#D4AF37] hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#D4AF37] text-white rounded-full flex items-center justify-center font-bold text-lg">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#2C2C2C]">{client.name}</h3>
                          <p className="text-sm text-gray-600">{client.phone}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#D4AF37]">
                          {client.loyalty_points}
                        </p>
                        <p className="text-xs text-gray-600">points</p>
                      </div>
                    </div>

                    {/* Rewards Status */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {eligibleRewards.length > 0 ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-lg">🎁</span>
                          <span className="font-semibold text-sm">
                            {eligibleRewards.length} reward{eligibleRewards.length !== 1 ? 's' : ''} available
                          </span>
                        </div>
                      ) : nextTier ? (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="text-lg">⭐</span>
                          <span className="text-sm">
                            {nextTier.points_required - client.loyalty_points} points to {nextTier.name}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Keep earning points!</p>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-3 grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-gray-600">Visits</p>
                        <p className="font-semibold text-[#2C2C2C]">{client.total_visits}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Spent</p>
                        <p className="font-semibold text-[#2C2C2C]">{formatCurrency(client.total_spent)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Last Visit</p>
                        <p className="font-semibold text-[#2C2C2C]">
                          {client.last_visit
                            ? new Date(client.last_visit).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
