import {
  supabase,
  supabaseAdmin,
} from '../../lib/supabase.js'

export async function login(
  email: string,
  password: string,
) {
  const {
    data,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(
      'Invalid email or password.',
    )
  }

  if (!data.session || !data.user) {
    throw new Error(
      'Unable to create session.',
    )
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error(
      'Employee profile not found.',
    )
  }

  if (profile.status !== 'ACTIVE') {
    throw new Error(
      'Your account is not active.',
    )
  }

  return {
    user: profile,
    session: data.session,
  }
}

export async function getProfile(
  userId: string,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) {
    throw new Error(
      'Employee profile not found.',
    )
  }

  return data
}
