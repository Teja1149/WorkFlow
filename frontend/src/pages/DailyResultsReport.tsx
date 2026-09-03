import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  RefreshCw,
  Search,
  User,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getDailyResultsReport } from '../features/daily-targets/daily-target.service'
import { getEmployees } from '../features/employees/employee.service'
import { getProjects } from '../features/projects/project.service'
import HealthBadge from '../components/ui/HealthBadge'

type PresetRange = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'ALL'

function getPresetDates(preset: PresetRange) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (preset === 'TODAY') {
    return { from: todayStr, to: todayStr }
  }

  if (preset === 'LAST_7_DAYS') {
    const d = new Date(now)
    d.setDate(now.getDate() - 7)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'LAST_30_DAYS') {
    const d = new Date(now)
    d.setDate(now.getDate() - 30)
    return { from: d.toISOString().split('T')[0], to: todayStr }
  }

  if (preset === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: firstDay.toISOString().split('T')[0], to: todayStr }
  }

  return { from: '', to: '' }
}

const REASON_LABELS: Record<string, string> = {
  COMPLETED: 'Completed On Time',
  CLIENT_WAITING: 'Client Waiting',
  DEPENDENCY: 'Dependency / Blocked',
  TECHNICAL_ISSUE: 'Technical Issue',
  APPROVAL_PENDING: 'Approval Pending',
  SCOPE_CHANGED: 'Scope Changed',
  MEETING_OVERLOAD: 'Meeting Overload',
  PERSONAL_EMERGENCY: 'Personal Emergency',
  NORMAL_DELAY: 'Normal Delay',
  UNSPECIFIED: 'Unspecified',
}

export default function DailyResultsReport() {
  const { accessToken } = useAuth()

  const [preset, setPreset] = useState<PresetRange>('LAST_30_DAYS')
  const [fromDate, setFromDate] = useState(() => getPresetDates('LAST_30_DAYS').from)
  const [toDate, setToDate] = useState(() => getPresetDates('LAST_30_DAYS').to)

  const [employeeId, setEmployeeId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [employees, setEmployees] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Detail Drawer State (Step 205)
  const [selectedResult, setSelectedResult] = useState<any | null>(null)

  // Load initial reference data
  useEffect(() => {
    if (!accessToken) return
    async function loadRefs() {
      try {
        const [empData, projData] = await Promise.all([
          getEmployees(accessToken!).catch(() => []),
          getProjects(accessToken!).catch(() => []),
        ])
        setEmployees(empData || [])
        setProjects(projData || [])
      } catch {}
    }
    loadRefs()
  }, [accessToken])

  // Load daily results
  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const data = await getDailyResultsReport(accessToken, {
        from: fromDate || undefined,
        to: toDate || undefined,
        employeeId: employeeId || undefined,
        projectId: projectId || undefined,
        status: statusFilter || undefined,
        reason: reasonFilter || undefined,
      })
      setResults(data || [])
    } catch (err: any) {
      setError(err.message || 'Unable to load daily results report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken, fromDate, toDate, employeeId, projectId, statusFilter, reasonFilter])

  function handlePresetChange(p: PresetRange) {
    setPreset(p)
    const { from, to } = getPresetDates(p)
    setFromDate(from)
    setToDate(to)
  }

  // Client-side text search filter
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return results
    const term = searchTerm.toLowerCase()
    return results.filter((r) => {
      const title = (r.title || '').toLowerCase()
      const empName = `${r.employee?.first_name || ''} ${r.employee?.last_name || ''}`.toLowerCase()
      const projName = (r.projects?.name || '').toLowerCase()
      const notes = (r.result_note || '').toLowerCase()
      return title.includes(term) || empName.includes(term) || projName.includes(term) || notes.includes(term)
    })
  }, [results, searchTerm])

  // Step 206 — Export CSV
  function handleExportCSV() {
    if (filteredResults.length === 0) return

    const headers = [
      'Date',
      'Employee',
      'Employee ID',
      'Project',
      'Module',
      'Milestone',
      'Sprint',
      'Target Title',
      'Unit',
      'Target Value',
      'Actual Value',
      'Achievement %',
      'Status',
      'Health',
      'Reason',
      'Notes',
      'Carry Forward',
    ]

    const rows = filteredResults.map((r) => [
      r.target_date,
      `"${r.employee?.first_name || ''} ${r.employee?.last_name || ''}"`,
      `"${r.employee?.employee_id || ''}"`,
      `"${r.projects?.name || 'General'}"`,
      `"${r.project_modules?.name || ''}"`,
      `"${r.project_milestones?.name || ''}"`,
      `"${r.sprints?.name || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.unit || 'ITEMS',
      r.target_value,
      r.actual_value,
      r.achievement_percent,
      r.status,
      r.health,
      `"${REASON_LABELS[r.result_reason] || r.result_reason || ''}"`,
      `"${(r.result_note || '').replace(/"/g, '""')}"`,
      r.carry_forward_value || 0,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `daily_results_${fromDate || 'all'}_to_${toDate || 'today'}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER (Step 202) */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              OFFICIAL HISTORICAL AUDIT
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              DAILY RESULTS
            </h1>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Historical record of employee targets, results, delays and carry-forward work.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Step 206 — Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={filteredResults.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* FILTERS (Step 203) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Preset Selector */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(
                [
                  ['TODAY', 'Today'],
                  ['LAST_7_DAYS', 'Last 7 Days'],
                  ['LAST_30_DAYS', 'Last 30 Days'],
                  ['THIS_MONTH', 'This Month'],
                  ['ALL', 'All Time'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    preset === key
                      ? 'bg-[#801424] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search target, employee, project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#801424]"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 pt-2 border-t border-slate-100 text-xs">
            {/* From Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Date From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setPreset('ALL')
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Date To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setPreset('ALL')
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              />
            </div>

            {/* Employee */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Employee
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name || ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Result / Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Result Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              >
                <option value="">All Results</option>
                <option value="COMPLETED">Completed</option>
                <option value="PARTIAL">Partial</option>
                <option value="MISSED">Missed</option>
                <option value="OPEN">Open</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">
                Reason
              </label>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none"
              >
                <option value="">All Reasons</option>
                {Object.entries(REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* RESULTS TABLE (Step 204) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Showing <strong className="text-slate-900">{filteredResults.length}</strong> historical results
            </span>
            <span className="text-slate-400">Click any row to inspect complete result details</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Target Deliverable</th>
                  <th className="py-3 px-4 text-center">Result</th>
                  <th className="py-3 px-4 text-center">Achievement</th>
                  <th className="py-3 px-4 text-center">Health</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Loading daily results...
                    </td>
                  </tr>
                ) : filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                      No daily results found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((row) => {
                    const actual = Number(row.actual_value || 0)
                    const target = Number(row.target_value || 0)
                    const achievement = Number(row.achievement_percent || 0)
                    const reason = row.result_reason
                      ? REASON_LABELS[row.result_reason] || row.result_reason.replaceAll('_', ' ')
                      : '—'

                    return (
                      <tr
                        key={row.id || `${row.target_id}_${row.target_date}`}
                        onClick={() => setSelectedResult(row)}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {row.target_date}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">
                            {row.employee?.first_name} {row.employee?.last_name || ''}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {row.employee?.employee_id || ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {row.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {row.projects?.name || 'General Operations'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 whitespace-nowrap">
                          {actual} / {target} {row.unit}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-extrabold text-[#801424]">
                            {achievement}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <HealthBadge health={row.health || 'GREEN'} />
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`rounded px-2 py-0.5 font-bold uppercase text-[10px] ${
                              row.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'PARTIAL'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {reason}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <ChevronRight size={14} className="text-slate-400 inline" />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* STEP 205 — RESULT DETAIL DRAWER / MODAL */}
      {selectedResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setSelectedResult(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  DAILY TARGET RESULT
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedResult.target_date}
                </h3>
              </div>

              <button
                onClick={() => setSelectedResult(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Employee Information */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  EMPLOYEE
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {selectedResult.employee?.first_name} {selectedResult.employee?.last_name || ''}
                </p>
                <p className="text-slate-500 font-mono text-[11px]">
                  {selectedResult.employee?.employee_id || selectedResult.employee?.email}
                </p>
              </div>

              {/* Target & Context */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  TARGET DELIVERABLE
                </span>
                <h4 className="text-base font-bold text-slate-900">
                  {selectedResult.title}
                </h4>
                <div className="flex flex-wrap gap-2 text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold">
                    {selectedResult.projects?.name || 'General Operations'}
                  </span>
                  {selectedResult.project_modules?.name && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                      Module: {selectedResult.project_modules.name}
                    </span>
                  )}
                  {selectedResult.project_milestones?.name && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                      Milestone: {selectedResult.project_milestones.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Result & Achievement */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="rounded-xl bg-slate-50 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Target</span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {selectedResult.target_value} {selectedResult.unit}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Actual</span>
                  <p className="text-base font-extrabold mt-1">
                    {selectedResult.actual_value} {selectedResult.unit}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 text-[#801424]">
                  <span className="text-[10px] font-bold uppercase text-[#801424] block">Achievement</span>
                  <p className="text-base font-extrabold mt-1">
                    {selectedResult.achievement_percent}%
                  </p>
                </div>
              </div>

              {/* Status & Health */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Status</span>
                  <span className="font-bold text-slate-900">{selectedResult.status}</span>
                </div>
                <HealthBadge health={selectedResult.health || 'GREEN'} />
              </div>

              {/* Reason for shortfall */}
              {selectedResult.result_reason && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 font-mono">
                    REASON FOR DELAY / SHORTFALL
                  </span>
                  <p className="font-bold text-orange-900">
                    {REASON_LABELS[selectedResult.result_reason] || selectedResult.result_reason}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedResult.result_note && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    EMPLOYEE / MANAGER NOTES
                  </span>
                  <p className="text-slate-700 italic">
                    "{selectedResult.result_note}"
                  </p>
                </div>
              )}

              {/* Carry Forward */}
              {Number(selectedResult.carry_forward_value || 0) > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase font-mono text-amber-800">
                    CARRY FORWARD
                  </span>
                  <p className="font-bold">
                    {selectedResult.carry_forward_value} {selectedResult.unit} carried forward to next working day
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
