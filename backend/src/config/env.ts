import 'dotenv/config'

const required = (
  name: string,
): string => {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    )
  }

  return value
}

export const env = {
  PORT: Number(
    process.env.PORT || 5000,
  ),

  SUPABASE_URL:
    required('SUPABASE_URL'),

  SUPABASE_ANON_KEY:
    required('SUPABASE_ANON_KEY'),

  SUPABASE_SERVICE_ROLE_KEY:
    required(
      'SUPABASE_SERVICE_ROLE_KEY',
    ),
}
