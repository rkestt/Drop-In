import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54421'

async function checkSupabaseRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`)
    return res.status === 200
  } catch {
    return false
  }
}

const isSupabaseRunning = await checkSupabaseRunning()

describe.skipIf(!isSupabaseRunning)('Migration integration tests', () => {
  // Default anon key for Supabase CLI local dev
  const supabase = createClient(
    SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  )

  it('get_public_profile RPC exists and returns public fields', async () => {
    const { data, error } = await supabase.rpc('get_public_profile', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    // Should return empty array for non-existent user
    expect(data).toEqual([])
  })

  it('get_public_profiles RPC exists and returns public fields', async () => {
    const { data, error } = await supabase.rpc('get_public_profiles', {
      p_user_ids: ['00000000-0000-0000-0000-000000000000'],
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data).toEqual([])
  })

  it('get_lobby_participants RPC exists and returns user_id + nickname', async () => {
    const { data, error } = await supabase.rpc('get_lobby_participants', {
      p_lobby_id: '00000000-0000-0000-0000-000000000000',
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data).toEqual([])
  })

  it('get_lobby_counts RPC exists', async () => {
    const { data, error } = await supabase.rpc('get_lobby_counts', {
      p_lobby_ids: ['00000000-0000-0000-0000-000000000000'],
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data).toEqual([])
  })

  it('is_user_in_lobby RPC exists', async () => {
    const { data, error } = await supabase.rpc('is_user_in_lobby', {
      p_lobby_id: '00000000-0000-0000-0000-000000000000',
    })

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data).toBe(false)
  })

  it('public_lobby_participants view is accessible', async () => {
    const { data, error } = await supabase
      .from('public_lobby_participants')
      .select('*')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})
