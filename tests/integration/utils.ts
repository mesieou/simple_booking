import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhook2/route';
import { type WebhookAPIBody } from '@/lib/bot-engine/channels/whatsapp/whatsapp-message-logger';

export async function simulateWebhookPost(input: { phone: string; message: string }) {
  const payload: WebhookAPIBody = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'test_entry',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551890570',
                phone_number_id: '15551890570'
              },
              contacts: [
                {
                  profile: { name: 'Test User' },
                  wa_id: input.phone.replace(/[^\d]/g, '')
                }
              ],
              messages: [
                {
                  from: input.phone.replace(/[^\d]/g, ''),
                  id: `test_msg_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: input.message },
                  type: 'text'
                }
              ]
            }
          }
        ]
      }
    ]
  };

  const url = 'http://localhost/api/webhook2';
  const request = new NextRequest(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );

  const res = await POST(request);
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}
