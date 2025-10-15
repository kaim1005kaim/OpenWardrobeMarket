export const runtime = 'nodejs';
export const revalidate = 0;

import crypto from 'crypto';

export async function POST(request: Request) {
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return Response.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('x-supabase-signature');
  const rawBody = await request.text();

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { type, table, record, old_record } = payload;

  try {
    switch (type) {
      case 'INSERT':
        console.log(`New record in ${table}:`, record);
        break;
      case 'UPDATE':
        console.log(`Updated record in ${table}:`, record);
        break;
      case 'DELETE':
        console.log(`Deleted record in ${table}:`, old_record);
        break;
      default:
        console.log('Unhandled webhook type:', type);
    }

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
}
