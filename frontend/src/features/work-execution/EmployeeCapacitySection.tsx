import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  RefreshCw,
  UserCheck,
  Zap,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { updateWorkItem } from '../work-items/work-item.service'
import {
  getEmployeeCapacity,
  type EmployeeCapacityData,
} from './employee-capacity.service'

function statusBadgeClass(status: string) {
  switch (status) {
    case 'OVERLOADED':
      return 'bg-red-100 text-red-800 border-red-300 font-bold'
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300 font-bold'
    case 'NORMAL':
      return 'bg-blue-100 text-blue-800 border-blue-300 font-semibold'
    case 'AVAILABLE':
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold'
  }
}

export default function EmployeeCapacitySection() {
  const { accessToken } = useAuth()
  const [capacityList, setCapacityList] = useState<EmployeeCapacityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    if (!accessToken) return
    setLoading(true)
    setError('')

    try {
      const data = await getEmployeeCapacity(accessToken)
      setCapacityList(data || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load capacity data.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [accessToken])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
        <RefreshCw className="mx-auto h-5 w-5 animate-spin text-slate-400 mb-2" />
        Loading employee capacity metrics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        {error}
      </div>
    )
  }

  // Find overloaded employees for Smart Reassignment Recommendations (Step 138)
  const overloadedEmployees = capacityList.filter(
    (c) => c.workloadStatus === 'OVERLOADED' || c.utilizationPercent > 100,
  )

  // Potential available candidates for redistribution
  const availableCandidates = capacityList
    .filter(
      (c) => c.workloadStatus === 'AVAILABLE' || c.workloadStatus === 'NORMAL',
    )
    .sort((a, b) => a.utilizationPercent - b.utilizationPercent)

  return (
    <div className="space-y-6">
      {/* EMPLOYEE CAPACITY DASHBOARD (Step 137) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-slate-700" />
            <div>
              <h3 className="font-bold text-slate-900 tracking-tight text-base uppercase">
                Employee Capacity
              </h3>
              <p className="text-xs text-slate-500">
                Daily workload utilization based on assigned estimated effort vs capacity
              </p>
            </div>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {capacityList.length === 0 ? (
          <p className="text-xs text-slate-500">No active employees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Remaining</th>
                  <th className="py-2.5 px-3">Utilization</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {capacityList.map((c) => {
                  const empName = `${c.employee.first_name} ${c.employee.last_name || ''}`.trim()

                  return (
                    <tr key={c.employee.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {empName}
                        {c.employee.employee_id && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            {c.employee.employee_id}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {c.dailyCapacityHours}h
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {c.estimatedRemainingHours}h
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 w-9">
                            {c.utilizationPercent}%
                          </span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                c.utilizationPercent > 100
                                  ? 'bg-red-600'
                                  : c.utilizationPercent > 85
                                  ? 'bg-orange-500'
                                  : c.utilizationPercent > 50
                                  ? 'bg-blue-600'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${Math.min(100, c.utilizationPercent)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] uppercase ${statusBadgeClass(
                            c.workloadStatus,
                          )}`}
                        >
                          {c.workloadStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SMART REASSIGNMENT RECOMMENDATIONS (Step 138) */}
      {overloadedEmployees.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-900">
            <Zap className="h-5 w-5 text-amber-600" />
            <h3 className="font-bold tracking-tight text-base">
              Smart Reassignment Recommendations
            </h3>
          </div>

          <div className="space-y-4">
            {overloadedEmployees.map((emp) => {
              const empName = `${emp.employee.first_name} ${emp.employee.last_name || ''}`.trim()
              const excessHours = (
                emp.estimatedRemainingHours - emp.dailyCapacityHours
              ).toFixed(1)

              return (
                <div
                  key={emp.employee.id}
                  className="rounded-xl border border-amber-200 bg-white p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      {empName} is overloaded by {excessHours} hours.
                    </p>
                    <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      {emp.utilizationPercent}% Utilization
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                    Suggested Redistribution:
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Work Items that can be redistributed */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1">
                      <p className="font-bold text-slate-900">
                        {emp.assignedItems?.[0]?.title || 'Active Task'}
                      </p>
                      <p className="text-slate-500">
                        Estimated remaining:{' '}
                        <span className="font-bold text-slate-700">
                          {emp.assignedItems?.[0]?.estimatedRemainingHours || 3}h
                        </span>
                      </p>
                      <p className="text-slate-500">
                        Current Assignee:{' '}
                        <span className="font-bold text-slate-700">{empName}</span>
                      </p>
                    </div>

                    {/* Potential Candidate recommendations */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5">
                      <p className="font-bold text-slate-900 flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Potential candidates:
                      </p>
                      {availableCandidates.length === 0 ? (
                        <p className="text-slate-500 italic">No available candidates currently.</p>
                      ) : (
                        availableCandidates.slice(0, 3).map((cand) => (
                          <div
                            key={cand.employee.id}
                            className="flex items-center justify-between text-slate-700 font-medium py-0.5"
                          >
                            <span>
                              {cand.employee.first_name} {cand.employee.last_name || ''}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                                {cand.utilizationPercent}% ({cand.workloadStatus})
                              </span>
                              {emp.assignedItems?.[0] && (
                                <button
                                  onClick={async () => {
                                    const task = emp.assignedItems![0]
                                    const candName = `${cand.employee.first_name} ${cand.employee.last_name || ''}`.trim()
                                    if (
                                      !confirm(
                                        `Reassign "${task.title}" from ${empName} to ${candName} for workload balancing?`,
                                      )
                                    )
                                      return
                                    try {
                                      await updateWorkItem(accessToken!, task.id, {
                                        assigned_to: cand.employee.id,
                                        assignment_reason: 'Workload balancing',
                                      })
                                      await load()
                                    } catch (err) {
                                      alert(
                                        err instanceof Error ? err.message : 'Reassignment failed.',
                                      )
                                    }
                                  }}
                                  className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-800 cursor-pointer shadow-xs"
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
