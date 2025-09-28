import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, username, email } = req.body

  if (!userId || !username || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Check if service key exists
    if (!supabaseServiceKey || supabaseServiceKey === 'undefined') {
      console.error('Service role key not configured')
      // Fallback: Return success without creating profile
      return res.status(200).json({
        success: true,
        warning: 'Profile creation skipped - service key not configured',
        data: { id: userId, username, email }
      })
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // First check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile) {
      console.log('Profile already exists for user:', userId)
      return res.status(200).json({ success: true, data: existingProfile })
    }

    // Wait a bit for auth user to be created
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Insert user profile with upsert to avoid conflicts
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        username: username,
        email: email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (error) {
      console.error('Profile creation error:', error)
      // Don't fail the signup process
      return res.status(200).json({
        success: true,
        warning: `Profile creation failed: ${error.message}`,
        data: { id: userId, username, email }
      })
    }

    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    console.error('Server error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}