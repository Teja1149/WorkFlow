import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  Clock,
  Globe,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
} from 'lucide-react'

import { useAuth } from '../features/auth/AuthContext'
import {
  getOrganizationWorkSettings,
  updateOrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import type { OrganizationWorkSettings } from '../features/organization-settings/organization-setting.service'

const DAYS = [
  { id: 1, name: 'Mon' },
  { id: 2, name: 'Tue' },
  { id: 3, name: 'Wed' },
  { id: 4, name: 'Thu' },
  { id: 5, name: 'Fri' },
  { id: 6, name: 'Sat' },
  { id: 7, name: 'Sun' },
]

export default function OrganizationSettings() {
  const { accessToken, profile } = useAuth()
  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [workdayStart, setWorkdayStart] = useState('09:00')
  const [workdayEnd, setWorkdayEnd] = useState('18:00')
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [carryForwardTime, setCarryForwardTime] = useState('18:00')
  const [warningMinutes, setWarningMinutes] = useState(120)
  const [atRiskMinutes, setAtRiskMinutes] = useState(60)
  const [criticalCarryCount, setCriticalCarryCount] = useState(2)

  async function load() {
    if (!accessToken) return

    setLoading(true)
    setError('')

    try {
      const data = await getOrganizationWorkSettings(accessToken)
      setTimezone(data.timezone || 'Asia/Kolkata')
      setWorkdayStart(data.workday_start || '09:00')
      setWorkdayEnd(data.workday_end || '18:00')
      setWorkingDays(data.working_days || [1, 2, 3, 4, 5])
      setCarryForwardTime(data.carry_forward_time || '18:00')
      setWarningMinutes(data.warning_minutes || 120)
      setAtRiskMinutes(data.at_risk_minutes || 60)
      setCriticalCarryCount(data.critical_carry_forward_count || 2)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load organization work settings.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken])

  function toggleDay(dayId: number) {
    if (!isAdmin) return
    setWorkingDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((d) => d !== dayId)
        : [...prev, dayId].sort(),
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !isAdmin) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateOrganizationWorkSettings(accessToken, {
        timezone,
        workday_start: workdayStart,
        workday_end: workdayEnd,
        working_days: workingDays,
        carry_forward_time: carryForwardTime,
        warning_minutes: Number(warningMinutes),
        at_risk_minutes: Number(atRiskMinutes),
        critical_carry_forward_count: Number(criticalCarryCount),
      })

      setSuccess('Organization work execution settings saved successfully!')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update organization settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">
            Loading organization work settings...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-slate-500">Configuration</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-zinc-800" />
            Work Execution Settings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Configure company-wide working hours, carry-forward automation rules, and health escalation thresholds.
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Read-Only View: Only Administrators can modify organization execution settings.</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* General Working Hours */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-slate-500" />
              Timezone & Workday Hours
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Company Timezone
                </label>
                <select
                  disabled={!isAdmin}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC (Universal)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Carry Forward Automation Cutoff Time
                </label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={carryForwardTime}
                  onChange={(e) => setCarryForwardTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Workday Start
                </label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={workdayStart}
                  onChange={(e) => setWorkdayStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Workday End
                </label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={workdayEnd}
                  onChange={(e) => setWorkdayEnd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Working Days Checkboxes */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-3">
                Working Days
              </label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((day) => {
                  const checked = workingDays.includes(day.id)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => toggleDay(day.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                        checked
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{day.name}</span>
                      {checked && <Check size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Health Thresholds */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-500" />
              Health Escalation & Warning Thresholds
            </h2>

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  AMBER Warning (Minutes before deadline)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={warningMinutes}
                  onChange={(e) => setWarningMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
                <p className="mt-1 text-[11px] text-slate-400">Default: 120 mins (2 hrs)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  ORANGE At-Risk (Minutes before deadline)
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={atRiskMinutes}
                  onChange={(e) => setAtRiskMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
                <p className="mt-1 text-[11px] text-slate-400">Default: 60 mins (1 hr)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Critical Carry-Forward Count
                </label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={criticalCarryCount}
                  onChange={(e) => setCriticalCarryCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm bg-white outline-none focus:border-zinc-800 disabled:bg-slate-50"
                />
                <p className="mt-1 text-[11px] text-slate-400">Escalates to CRITICAL after N carry-forwards</p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer shadow-md"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
