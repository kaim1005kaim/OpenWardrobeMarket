import { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('Webhook secret not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  // Verify webhook signature
  const signature = req.headers['x-supabase-signature'] as string
  const body = JSON.stringify(req.body)

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Process webhook event
  const { type, table, record, old_record } = req.body

  try {
    switch (type) {
      case 'INSERT':
        console.log(`New record in ${table}:`, record)
        // Handle new record
        break

      case 'UPDATE':
        console.log(`Updated record in ${table}:`, record)
        // Handle updated record
        break

      case 'DELETE':
        console.log(`Deleted record in ${table}:`, old_record)
        // Handle deleted record
        break
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return res.status(500).json({ error: 'Processing failed' })
  }
}