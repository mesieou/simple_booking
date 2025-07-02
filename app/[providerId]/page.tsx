'use client';

import { useProvider } from '../context/ProviderContext';
import { useEffect, useState } from 'react';
import ProviderTitle from '../context/ProviderTitle';
import { use } from 'react';
import { getEnvironmentBrowserClient } from '@/lib/database/supabase/environment';
import { useFormContext } from '@/lib/rename-categorise-better/utils/FormContext';
import { useRouter } from 'next/navigation';

// Child component to handle context and redirection
const ContinueButtonWithContext = ({ providerId, businessId }: { providerId: string, businessId: string | null }) => {
  const { setData } = useFormContext();
  const router = useRouter();
  const handleContinue = () => {
    if (providerId && businessId) {
      setData(prev => ({
        ...prev,
        userid: providerId,
        businessid: businessId,
      }));
      router.push(`/${providerId}/booking/locations`);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' && providerId && businessId) {
      setData(prev => ({
        ...prev,
        userid: providerId,
        businessid: businessId,
      }));
      router.push(`/${providerId}/booking/locations`);
    }
  };
  return (
    <button
      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      tabIndex={0}
      aria-label="Continue to booking"
      onClick={handleContinue}
      disabled={!providerId || !businessId}
      onKeyDown={handleKeyDown}
    >
      Continue
    </button>
  );
};

export default function ProviderPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { setProviderId } = useProvider();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const { setData } = useFormContext();

  // Desempaquetar la promesa de params
  const { providerId } = use(params);

  useEffect(() => {
    setProviderId(providerId);
  }, [providerId, setProviderId]);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/provider/${providerId}/slots?date=${date}`);
        if (!res.ok) throw new Error('Error fetching slots');
        const data = await res.json();
        setSlots(data);
      } catch (err: any) {
        setError(err.message || 'Error fetching slots');
      }
      setLoading(false);
    };
    if (providerId && date) fetchSlots();
  }, [providerId, date]);

  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!providerId) return;
      const supabase = getEnvironmentBrowserClient();
      // Find the user and get the businessId
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('businessId')
        .eq('id', providerId)
        .single();
      if (userError || !user?.businessId) {
        setBusinessId(null);
        setBusinessName(null);
        return;
      }
      setBusinessId(user.businessId);
      // Find the business name and if it is mobile
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('name, mobile')
        .eq('id', user.businessId)
        .single();
      if (businessError || !business?.name) {
        setBusinessName(null);
        return;
      }
      setBusinessName(business.name);
      setData(prev => ({
        ...prev,
        isBusinessMobile: !!business.mobile,
      }));
    };
    fetchBusinessData();
  }, [providerId, setData]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <ProviderTitle providerId={providerId} />
        {/* Show businessId and businessName below ProviderId */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-300" tabIndex={0} aria-label="Business ID">
            <span className="font-semibold">Business ID:</span> {businessId ?? 'Not available'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300" tabIndex={0} aria-label="Business name">
            <span className="font-semibold">Business name:</span> {businessName ?? 'Not available'}
          </div>
          {/* Continue button with context */}
          <ContinueButtonWithContext providerId={providerId} businessId={businessId} />
        </div>
        <h1 className="text-2xl font-bold mb-4">
          Select a booking option
        </h1>
        {/* Input to select a date */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1" htmlFor="date">Date:</label>
          <input
            id="date"
            type="date"
            className="border rounded px-2 py-1"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        {/* Here you can add links to the different booking sections */}
        <div className="mt-6 text-stone-950">
          <h2 className="text-lg font-semibold mb-2">Available slots (JSON):</h2>
          {loading && <div className="text-blue-500">Loading...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && (
            <pre className="bg-gray-100 text-xs p-3 rounded overflow-x-auto max-h-96">
              {JSON.stringify(slots, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
} 