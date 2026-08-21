import type {
  UserProfile,
} from './auth.types'

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

interface LoginResponse {
  success: boolean
  data: {
    user: UserProfile
    session: {
      access_token: string
      refresh_token: string
      expires_at: number | null
      expires_in: number | null
    }
  }
}

interface ProfileResponse {
  success: boolean
  data: UserProfile
}

export async function login(
  email: string,
  password: string,
) {
  const response =
    await fetch(
      `${API_URL}/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      },
    )

  const result =
    (await response.json()) as
      | LoginResponse
      | { message?: string }

  if (!response.ok || !('data' in result)) {
    throw new Error(
      'message' in result &&
      result.message
        ? result.message
        : 'Login failed.',
    )
  }

  return result.data
}

export async function getProfile(
  token: string,
) {
  const response =
    await fetch(
      `${API_URL}/auth/me`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    )

  const result =
    (await response.json()) as
      | ProfileResponse
      | { message?: string }

  if (!response.ok || !('data' in result)) {
    throw new Error(
      'message' in result &&
      result.message
        ? result.message
        : 'Unable to load profile.',
    )
  }

  return result.data
}
