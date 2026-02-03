'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Client, LoyaltyTier } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { SalonHeader } from '@/components/SalonBranding';
import { useUser } from '@/contexts/UserContext';

export default function LoyaltyOverviewPage() {
  const router = useRouter();
  const { user } = useUser();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-900">Loading loyalty data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SalonHeader title="Loyalty Program">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            Dashboard
          </Link>
          <Link href="/pos" className="btn-primary text-sm px-3 py-2">
            Open POS
          </Link>
        </div>
      </SalonHeader>

      <div className="container mx-auto p-4 md:p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-600 mb-1">Total Members</p>
            <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
          </div>

          <div className="card border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">Eligible for Rewards</p>
            <p className="text-3xl font-bold text-gray-900">{eligibleCount}</p>
          </div>

          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-600 mb-1">Total Points</p>
            <p className="text-3xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
          </div>

          <div className="card border-l-4 border-brand-primary">
            <p className="text-sm text-gray-600 mb-1">Avg Points/Client</p>
            <p className="text-3xl font-bold text-gray-900">{avgPoints}</p>
          </div>
        </div>

        {/* Loyalty Tiers */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Loyalty Tiers</h2>
          
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
                    className="border-2 border-brand-primary rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-900">{tier.name}</h3>
                      <span className="bg-brand-primary text-white text-xs px-2 py-1 rounded">
                        {tier.points_required} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{tier.reward_description}</p>
                    <p className="text-sm font-semibold text-brand-primary">
                      {clientsInTier} client{clientsInTier !== 1 ? 's' : ''} qualified
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Client List */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900">Client Points</h2>
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  filter === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({clients.length})
              </button>
              <button
                onClick={() => setFilter('eligible')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  filter === 'eligible'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Eligible ({eligibleCount})
              </button>
              <button
                onClick={() => setFilter('high-points')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  filter === 'high-points'
                    ? 'bg-brand-primary text-white'
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
                    className="border border-gray-200 rounded-lg p-4 hover:border-brand-primary hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold text-lg">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{client.name}</h3>
                          <p className="text-sm text-gray-600">{client.phone}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand-primary">
                          {client.loyalty_points}
                        </p>
                        <p className="text-xs text-gray-600">points</p>
                      </div>
                    </div>

                    {/* Rewards Status */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {eligibleRewards.length > 0 ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                          <span className="font-semibold text-sm">
                            {eligibleRewards.length} reward{eligibleRewards.length !== 1 ? 's' : ''} available
                          </span>
                        </div>
                      ) : nextTier ? (
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
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
                        <p className="font-semibold text-gray-900">{client.total_visits}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Spent</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(client.total_spent)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Last Visit</p>
                        <p className="font-semibold text-gray-900">
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
