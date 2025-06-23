'use client';

import { useState } from 'react';

export default function TestWhatsAppPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  const testWhatsAppConfig = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-whatsapp');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const sendTemplateMessage = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber || undefined,
          templateName: 'hello_world',
          languageCode: 'en_US'
        }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testWebhookVerification = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/webhook2?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=test');
      const data = await response.text();
      setResult({ status: response.status, data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testWebhookStatus = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/webhook-status');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testWebhookEcho = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/webhook-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: 'webhook_echo_test',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">WhatsApp API Test Page</h1>
      
      <div className="space-y-8">
        {/* Configuration Test */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">1. Test WhatsApp Configuration</h2>
          <p className="text-gray-600 mb-4">
            Check if your WhatsApp API configuration is correct.
          </p>
          <button
            onClick={testWhatsAppConfig}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Configuration'}
          </button>
        </div>

        {/* Send Template Message */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">2. Send Template Message</h2>
          <p className="text-gray-600 mb-4">
            Send a test template message to verify the WhatsApp API connection.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (optional - will use default if empty)
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="34612345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={sendTemplateMessage}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Template Message'}
            </button>
          </div>
        </div>

        {/* Webhook Test */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">3. Test Webhook Verification</h2>
          <p className="text-gray-600 mb-4">
            Test if the webhook endpoint is accessible and responding correctly.
          </p>
          <button
            onClick={testWebhookVerification}
            disabled={loading}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Webhook'}
          </button>
        </div>

        {/* Webhook Status Test */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">4. Test Webhook Status</h2>
          <p className="text-gray-600 mb-4">
            Check webhook configuration and test endpoint accessibility.
          </p>
          <div className="space-y-2">
            <button
              onClick={testWebhookStatus}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded disabled:opacity-50 mr-2"
            >
              {loading ? 'Testing...' : 'Check Status'}
            </button>
            <button
              onClick={testWebhookEcho}
              disabled={loading}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Echo'}
            </button>
          </div>
        </div>

        {/* Results */}
        {(result || error) && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                <strong>Error:</strong> {error}
              </div>
            )}
            {result && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Debugging Information */}
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">Debugging Information</h2>
          <div className="space-y-2 text-sm text-yellow-700">
            <p><strong>Webhook URL:</strong> https://skedy.io/api/webhook2</p>
            <p><strong>Test Endpoint:</strong> https://skedy.io/api/test-whatsapp</p>
            <p><strong>Vercel Logs:</strong> Check your Vercel dashboard for function logs</p>
            <p><strong>Environment Variables:</strong> Make sure WHATSAPP_PERMANENT_TOKEN is set</p>
            <p><strong>Meta Configuration:</strong> Verify webhook URL in Meta Business Suite</p>
          </div>
        </div>
      </div>
    </div>
  );
} 