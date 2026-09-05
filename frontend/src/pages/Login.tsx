import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import LoadingCard from '../components/ui/LoadingCard'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { loginUser, accessToken, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && accessToken && profile) {
      const role = profile.role
      if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
        navigate('/admin-workboard', { replace: true })
      } else {
        navigate('/execution-board', { replace: true })
      }
    }
  }, [loading, accessToken, profile, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <LoadingCard message="Checking workspace session..." />
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const user = await loginUser(email, password)
      const role = user?.role
      if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
        navigate('/admin-workboard', { replace: true })
      } else {
        navigate('/execution-board', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#801424] text-white flex items-center justify-center font-bold shadow-md border border-rose-500/20">
            <Layers size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-wider uppercase">
            WORKFLOW
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Sign in to access your workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200/80 rounded-2xl p-8 space-y-5 shadow-xs"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Email Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 transition font-medium text-slate-900"
              placeholder="employee@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800 transition font-medium text-slate-900"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-3 bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold disabled:opacity-60 transition cursor-pointer shadow-xs"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
