import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  FolderKanban,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  User,
  X,
  Layers,
  Save,
  UserCheck,
  PauseCircle,
  PlayCircle,
  Plus,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  getWorkUpdates,
  addWorkUpdate,
  updateWorkItemStatus,
  updateWorkItem,
  type WorkItem,
  type AddWorkUpdateInput,
} from './work-item.service'
import { WORK_STATUS, getWorkStatusConfig } from './work-status'
import type { DailyTarget } from '../daily-targets/daily-target.types'
import {
  updateDailyTarget,
  updateDailyTargetResult,
} from '../daily-targets/daily-target.service'
import { getEmployees } from '../employees/employee.service'
import { getProjects, type Project } from '../projects/project.service'
import { getWorkTypes } from '../work-types/work-type.service'
import type { WorkTypeField, WorkFieldType } from '../work-types/work-type.types'
import { StructuredWorkUpdateCard } from './work-update-parser'
import HealthBadge from '../../components/ui/HealthBadge'

type Employee = any
type WorkType = any

interface Props {
  work: WorkItem
  linkedTarget?: DailyTarget | null
  onClose: () => void
  onChanged: () => Promise<void>
}

export function DynamicWorkField({
  field,
  value,
  onChange,
}: {
  field: any
  value: any
  onChange: (value: any) => void
}) {
  const common =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium outline-none focus:border-[#801424]'

  const fieldType = (field.type || 'TEXT').toUpperCase()

  if (fieldType === 'LONG_TEXT' || fieldType === 'PARAGRAPH') {
    return (
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {field.label}
          {field.required && <span className="text-rose-600"> *</span>}
        </label>

        <textarea
          value={value || ''}
          required={field.required}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={common}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      </div>
    )
  }

  if (
    fieldType === 'NUMBER' ||
    fieldType === 'DECIMAL' ||
    fieldType === 'HOURS'
  ) {
    return (
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {field.label}
          {field.required && <span className="text-rose-600"> *</span>}
        </label>

        <input
          type="number"
          step={fieldType === 'DECIMAL' ? '0.01' : '1'}
          min="0"
          value={value ?? ''}
          required={field.required}
          onChange={(e) =>
            onChange(
              e.target.value === ''
                ? ''
                : Number(e.target.value),
            )
          }
          className={common}
        />

        {field.counts_toward_target && (
          <p className="mt-1 text-[10px] font-semibold text-[#801424]">
            ✓ Counts toward target
          </p>
        )}
      </div>
    )
  }

  if (fieldType === 'BOOLEAN') {
    return (
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[#801424] h-4 w-4 rounded"
        />
        <span>{field.label}</span>
      </label>
    )
  }

  if (fieldType === 'SELECT') {
    return (
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {field.label}
          {field.required && <span className="text-rose-600"> *</span>}
        </label>

        <select
          value={value || ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
          className={common}
        >
          <option value="">Select...</option>
          {(field.options || []).map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">
        {field.label}
        {field.required && <span className="text-rose-600"> *</span>}
      </label>

      <input
        value={value || ''}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
        className={common}
        placeholder={`Enter ${field.label.toLowerCase()}...`}
      />
    </div>
  )
}

export default function WorkDetailsDrawer({
  work,
  linkedTarget,
  onClose,
  onChanged,
}: Props) {
  const { accessToken, profile } = useAuth()
  const [updates, setUpdates] = useState<any[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Metadata dropdowns
  const [employees, setEmployees] = useState<Employee[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])

  // Manage Work Fields (Admin/Manager)
  const [assignedTo, setAssignedTo] = useState(work.assigned_to || '')
  const [projectId, setProjectId] = useState(work.project_id || '')
  const [workTypeId, setWorkTypeId] = useState(
    work.work_type_id || (work as any).work_types?.id || '',
  )
  const [targetValue, setTargetValue] = useState<number | string>(
    work.target_quantity ?? (work as any).quantity_target ?? linkedTarget?.target_value ?? 10,
  )
  const [scheduleMode, setScheduleMode] = useState<'AUTOMATIC' | 'MILESTONE' | 'MANUAL'>(
    'AUTOMATIC',
  )
  const [deadline, setDeadline] = useState(work.deadline || '')
  const [isPaused, setIsPaused] = useState(false)

  // Dynamic Report Field Values
  const [reportValues, setReportValues] = useState<Record<string, any>>({})

  // Send Back modal state
  const [showSendBackModal, setShowSendBackModal] = useState(false)
  const [sendBackNote, setSendBackNote] = useState('')

  const isOwnWork = work.assigned_to === profile?.id
  const isManagerOrAdmin =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  const statusConfig = getWorkStatusConfig(work.status)
  const unit = work.quantity_unit || linkedTarget?.unit || (work as any).unit || (work.work_types as any)?.unit || 'Items'

  // Resolve dynamic fields from work_types
  const activeFields = useMemo(() => {
    const wt =
      work.work_types ||
      (work as any).work_type ||
      workTypes.find((w) => w.id === (workTypeId || work.work_type_id))

    if (wt?.fields && Array.isArray(wt.fields) && wt.fields.length > 0) {
      return [...wt.fields].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    }

    if (wt?.report_fields && Array.isArray(wt.report_fields) && wt.report_fields.length > 0) {
      return wt.report_fields.map((rf: any, idx: number) => ({
        id: rf.key || `field_${idx}`,
        key: rf.key,
        label: rf.label,
        type: (rf.type || 'NUMBER').toUpperCase(),
        required: Boolean(rf.required),
        counts_toward_target: Boolean(rf.counts_toward_target),
        options: rf.options,
        order: rf.display_order ?? idx,
      }))
    }

    // Default fields fallback with Step 21 structured questions
    return [
      {
        id: 'videos_completed',
        key: 'videos_completed',
        label: 'Completed Output (Units/Items)',
        type: 'NUMBER' as WorkFieldType,
        required: false,
        counts_toward_target: true,
        order: 1,
      },
      {
        id: 'completed_today',
        key: 'completed_today',
        label: 'What did you complete today?',
        type: 'LONG_TEXT' as WorkFieldType,
        required: false,
        counts_toward_target: false,
        order: 2,
      },
      {
        id: 'working_on_now',
        key: 'working_on_now',
        label: 'What are you working on now?',
        type: 'LONG_TEXT' as WorkFieldType,
        required: false,
        counts_toward_target: false,
        order: 3,
      },
      {
        id: 'blocker',
        key: 'blocker',
        label: 'Any blockers? (Required if marking blocked)',
        type: 'LONG_TEXT' as WorkFieldType,
        required: false,
        counts_toward_target: false,
        order: 4,
      },
    ]
  }, [work, workTypes, workTypeId])

  // Initialize default report values
  useEffect(() => {
    const initial: Record<string, any> = {}
    const initialActual = linkedTarget?.actual_value ?? (work.status === 'DONE' ? targetValue : 0)

    for (const f of activeFields) {
      if (f.counts_toward_target) {
        initial[f.key] = initialActual || 0
      } else if (f.type === 'NUMBER' || f.type === 'DECIMAL' || f.type === 'HOURS') {
        initial[f.key] = 0
      } else if (f.type === 'BOOLEAN') {
        initial[f.key] = false
      } else {
        initial[f.key] = ''
      }
    }
    setReportValues(initial)
  }, [activeFields, linkedTarget, work.status, targetValue])

  // Automatic calculation of actual output from target-counting fields
  const actualValue = useMemo(() => {
    const targetFields = activeFields.filter((field: any) => field.counts_toward_target)
    if (targetFields.length > 0) {
      return targetFields.reduce(
        (total: number, field: any) => total + Number(reportValues[field.key] || 0),
        0,
      )
    }
    return Number(reportValues.videos_completed || reportValues.completed || reportValues.actual_value || 0)
  }, [activeFields, reportValues])

  const targetNum = Number(linkedTarget?.target_value ?? targetValue ?? 1)
  const remaining = Math.max(0, targetNum - actualValue)
  const achievement =
    targetNum > 0 ? Math.min(100, Math.round((actualValue / targetNum) * 100)) : 0

  // Can Complete rule: actual reaches target (or no target set)
  const canComplete =
    !linkedTarget || Number(linkedTarget.actual_value ?? actualValue ?? 0) >= targetNum

  useEffect(() => {
    async function loadData() {
      if (!accessToken) return
      setLoadingUpdates(true)
      try {
        const [upRes, empRes, projRes, wtRes] = await Promise.all([
          getWorkUpdates(accessToken, work.id).catch(() => []),
          isManagerOrAdmin ? getEmployees(accessToken).catch(() => []) : Promise.resolve([]),
          isManagerOrAdmin ? getProjects(accessToken).catch(() => []) : Promise.resolve([]),
          isManagerOrAdmin ? getWorkTypes(accessToken).catch(() => []) : Promise.resolve([]),
        ])
        setUpdates(Array.isArray(upRes) ? upRes : [])
        setEmployees(Array.isArray(empRes) ? empRes : [])
        setProjects(Array.isArray(projRes) ? projRes : [])
        setWorkTypes(Array.isArray(wtRes) ? wtRes : [])
      } catch (err) {
        console.error('Failed to load drawer data:', err)
      } finally {
        setLoadingUpdates(false)
      }
    }
    loadData()
  }, [accessToken, work.id, isManagerOrAdmin])

  // STATUS TRANSITION (Clean 4-state flow: TODO -> IN_PROGRESS -> DONE / BLOCKED)
  async function handleStatusTransition(
    nextStatus:
      | 'TODO'
      | 'IN_PROGRESS'
      | 'BLOCKED'
      | 'DONE',
  ) {
    if (!accessToken) return

    const blockerDetails = String(
      reportValues.blocker ||
      reportValues.notes ||
      reportValues.comment ||
      '',
    ).trim()

    if (
      nextStatus === 'BLOCKED' &&
      !blockerDetails
    ) {
      setError(
        'Please enter the blocker details before marking this work as blocked.',
      )
      return
    }

    setSubmitting(true)
    setError('')
    setSuccessMsg('')

    try {
      await updateWorkItemStatus(
        accessToken,
        work.id,
        nextStatus,
        nextStatus === 'BLOCKED'
          ? blockerDetails
          : undefined,
      )

      setSuccessMsg(
        `✓ Status updated to ${
          getWorkStatusConfig(nextStatus).label
        }`,
      )

      await onChanged()
    } catch (err: any) {
      setError(
        err?.message ||
        'Status transition failed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // SAVE CHANGES (Admin/Manager Manage Work)
  async function handleSaveChanges(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!accessToken) return

    setSubmitting(true)
    setError('')
    setSuccessMsg('')

    try {
      await updateWorkItem(accessToken, work.id, {
        assigned_to: assignedTo || null,
        work_type_id: workTypeId || null,
        deadline: deadline || null,
        assignment_reason:
          assignedTo !== work.assigned_to ? 'Reassigned via Work Planner' : undefined,
      } as any)

      if (linkedTarget) {
        await updateDailyTarget(accessToken, linkedTarget.id, {
          employee_id: assignedTo || undefined,
          target_value: Number(targetValue) || 1,
          deadline_date: deadline || undefined,
        })
      }

      setSuccessMsg('✓ Work plan and assignment updated successfully.')
      await onChanged()
    } catch (err: any) {
      setError(err?.message || 'Failed to update work.')
    } finally {
      setSubmitting(false)
    }
  }

  // REASSIGN WORK
  async function handleReassign(newEmpId: string) {
    setAssignedTo(newEmpId)
    if (!accessToken) return
    setSubmitting(true)
    try {
      await updateWorkItem(accessToken, work.id, {
        assigned_to: newEmpId,
        assignment_reason: 'Reassigned via Work Planner',
      })
      if (linkedTarget) {
        await updateDailyTarget(accessToken, linkedTarget.id, {
          employee_id: newEmpId || undefined,
          deadline_date: deadline || undefined,
        })
      }
      setSuccessMsg('✓ Work reassigned successfully.')
      await onChanged()
    } catch (err: any) {
      setError(err?.message || 'Reassignment failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // PAUSE / RESUME SCHEDULE
  function togglePauseSchedule() {
    setIsPaused((prev) => !prev)
    setSuccessMsg(
      !isPaused
        ? '⏸ Schedule Paused. No new daily work will be generated.'
        : '▶ Schedule Resumed.',
    )
  }

  // SEND BACK (Correction mechanism)
  async function handleSendBack() {
    if (!accessToken) return
    const note = sendBackNote.trim()
    if (!note) {
      setError('A reason is required when sending work back.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateWorkItemStatus(
        accessToken,
        work.id,
        'IN_PROGRESS',
        note,
        'SEND_BACK',
      )

      setShowSendBackModal(false)
      setSendBackNote('')
      setSuccessMsg('✓ Work sent back for correction.')
      await onChanged()
    } catch (err: any) {
      setError(err?.message || 'Failed to send back.')
    } finally {
      setSubmitting(false)
    }
  }

  // SAVE UPDATE (Progress report while in progress)
  async function handleSaveUpdate() {
    if (!accessToken) return
    setSubmitting(true)
    setError('')
    setSuccessMsg('')

    try {
      const notesVal = reportValues.notes || reportValues.comment || ''
      const blockerVal = reportValues.blocker || ''

      const summaryText = `Completed ${actualValue} / ${targetNum} ${unit}.${
        notesVal ? ` Notes: ${notesVal}` : ''
      }${blockerVal ? ` Blocker: ${blockerVal}` : ''}`

      // 1. Post work update with actual report values
      await addWorkUpdate(accessToken, work.id, {
        update_text: summaryText,
        report_data: reportValues,
        actual_value: actualValue,
      })

      // 2. Update Daily Target
      if (linkedTarget) {
        await updateDailyTargetResult(accessToken, linkedTarget.id, {
          actual_value: actualValue,
          result_note: summaryText,
        })
      }

      // 3. Update Work Item with completed quantity & progress
      await updateWorkItem(accessToken, work.id, {
        completed_quantity: actualValue,
      })

      // 4. Status update if starting from TODO
      if (work.status === 'TODO') {
        await updateWorkItemStatus(accessToken, work.id, 'IN_PROGRESS')
      }

      setSuccessMsg('✓ Progress update saved.')
      await onChanged()
    } catch (err: any) {
      setError(err?.message || 'Failed to save update.')
    } finally {
      setSubmitting(false)
    }
  }

  // COMPLETE WORK (Atomic completion: save report -> update target -> mark DONE)
  async function handleCompleteWork() {
    if (!accessToken) return
    setSubmitting(true)
    setError('')

    try {
      const targetQty = work.target_quantity ? Number(work.target_quantity) : targetNum
      const completionQty = Math.max(targetQty, actualValue || 1)
      const notesVal = reportValues.notes || reportValues.comment || ''
      const blockerVal = reportValues.blocker || ''
      const summaryText = `Completed ${completionQty} / ${targetQty} ${unit}.${
        notesVal ? ` Notes: ${notesVal}` : ''
      }${blockerVal ? ` Blocker: ${blockerVal}` : ''}`

      // 1. Save linked target with full actual output
      if (linkedTarget) {
        await updateDailyTargetResult(accessToken, linkedTarget.id, {
          actual_value: completionQty,
          result_note: summaryText.trim() || undefined,
        })
      }

      // 2. Save work update
      await addWorkUpdate(accessToken, work.id, {
        update_text: summaryText,
        report_data: reportValues,
        actual_value: completionQty,
      })

<<<<<<< HEAD
      // 3. Update completed quantity on work item
      await updateWorkItem(accessToken, work.id, {
        completed_quantity: work.target_quantity ? Number(work.target_quantity) : actualValue,
=======
      // 3. Update completed quantity on work item & mark DONE
      await updateWorkItem(accessToken, work.id, {
        completed_quantity: completionQty,
        status: 'DONE',
>>>>>>> 4047dda (Deploy V2 with work tracking, targets, deadlines and manager access)
      })

      // 4. Mark work item DONE
      await updateWorkItemStatus(accessToken, work.id, 'DONE')

      setSuccessMsg('🎉 Work completed successfully!')
      await onChanged()
      setTimeout(onClose, 800)
    } catch (err: any) {
      setError(err?.message || 'Unable to complete work.')
    } finally {
      setSubmitting(false)
    }
  }

  // Assignee display name
  const currentAssigneeName = useMemo(() => {
    const emp = employees.find((e) => e.id === (assignedTo || work.assigned_to))
    if (emp) {
      return (
        emp.display_name ||
        `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
        emp.email
      )
    }
    return (
      (work as any).employee?.first_name
        ? `${(work as any).employee.first_name} ${(work as any).employee.last_name || ''}`.trim()
        : 'Assigned Worker'
    )
  }, [employees, assignedTo, work])

  const projectName =
    projects.find((p) => p.id === (projectId || work.project_id))?.name ||
    work.projects?.name ||
    'General Project'

  const workTypeName =
    workTypes.find((w) => w.id === (workTypeId || work.work_type_id))?.name ||
    work.work_types?.name ||
    'Standard Work'

  const latestUpdate = updates[0] || null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-xl bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slideInRight text-xs">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded-md bg-[#801424] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                  {workTypeName.toUpperCase()}
                </span>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {projectName}
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {currentAssigneeName}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 font-bold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* SECTION: TODAY'S TARGET */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                  <Target size={13} />
                  TODAY'S TARGET
                </span>
                <span className="text-xs font-black text-[#801424]">
                  {achievement}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target</span>
                  <span className="text-base font-black text-slate-900">
                    {targetNum} <span className="text-[10px] font-semibold text-slate-400">{unit}</span>
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Completed</span>
                  <span className="text-base font-black text-emerald-700">
                    {actualValue} <span className="text-[10px] font-semibold text-emerald-400">{unit}</span>
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">Pending</span>
                  <span className="text-base font-black text-rose-700">
                    {remaining} <span className="text-[10px] font-semibold text-rose-400">{unit}</span>
                  </span>
                </div>
              </div>

              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#801424] rounded-full transition-all"
                  style={{ width: `${achievement}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase font-mono text-[10px]">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] ${statusConfig.badge}`}>
                    {statusConfig.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase font-mono text-[10px]">Health:</span>
                  <HealthBadge health={linkedTarget?.health || ((work as any).health ?? 'GREEN')} />
                </div>
              </div>
            </div>

            {/* SECTION: QUANTITY PACING TRACKER */}
            {work.pacing?.enabled && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                    <Clock size={13} />
                    DEADLINE PACING INTELLIGENCE
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                      work.pacing.status === 'OVERDUE'
                        ? 'bg-red-600 text-white'
                        : work.pacing.status === 'BEHIND'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : work.pacing.status === 'WORKLOAD_INCREASING' || work.pacing.status === 'AT_RISK'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : work.pacing.status === 'AHEAD'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : work.pacing.status === 'SCHEDULED'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-teal-100 text-teal-800 border border-teal-200'
                    }`}
                  >
                    {work.pacing.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Target Qty</span>
                    <span className="text-sm font-black text-slate-900">
                      {work.pacing.targetQuantity} <span className="text-[9px] text-slate-400">{work.quantity_unit || 'items'}</span>
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Expected Now</span>
                    <span className="text-sm font-black text-slate-900">
                      {work.pacing.expectedQuantity} <span className="text-[9px] text-slate-400">{work.quantity_unit || 'items'}</span>
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Required/Day</span>
                    <span className="text-sm font-black text-rose-700">
                      {work.pacing.requiredPerDay} <span className="text-[9px] text-slate-400">/day</span>
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Days Left</span>
                    <span className="text-sm font-black text-slate-900">
                      {work.pacing.remainingDays} <span className="text-[9px] text-slate-400">days</span>
                    </span>
                  </div>
                </div>

                {work.pacing.recommendedPaceText ? (
                  <p className="text-[11px] font-semibold text-slate-700 bg-white/80 rounded-xl p-2 border border-slate-200/60">
                    🎯 Recommended Pace: {work.pacing.recommendedPaceText}
                  </p>
                ) : work.pacing.recommendedIntervalDays ? (
                  <p className="text-[11px] font-semibold text-slate-700 bg-white/80 rounded-xl p-2 border border-slate-200/60">
                    🎯 Recommended Pace: 1 {work.quantity_unit || 'item'} every {work.pacing.recommendedIntervalDays} days over {work.pacing.totalDays} total days.
                  </p>
                ) : null}
              </div>
            )}

            {/* IF ADMIN/MANAGER MANAGE VIEW */}
            {isManagerOrAdmin && !isOwnWork && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
                    ASSIGNMENT & TARGET
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Employee
                      </label>
                      <select
                        value={assignedTo}
                        onChange={(e) => handleReassign(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#801424]"
                      >
                        <option value="">Select Employee...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.display_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Overall Target ({unit})
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={targetValue}
                          onChange={(e) => setTargetValue(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none focus:border-[#801424]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Deadline
                        </label>
                        <input
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                        />
                      </div>
                    </div>

                    {linkedTarget && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-600">
                        <span className="font-bold text-slate-800 block">Today's Daily Target:</span>
                        <span>{linkedTarget.actual_value || 0} / {linkedTarget.target_value} {linkedTarget.unit}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveChanges()}
                        disabled={submitting}
                        className="flex-1 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Save size={13} />
                        <span>Save Changes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePauseSchedule()}
                        className={`px-3 py-2 rounded-xl border font-bold text-xs cursor-pointer flex items-center gap-1 ${
                          isPaused
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-amber-50 border-amber-300 text-amber-900'
                        }`}
                      >
                        {isPaused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                        <span>{isPaused ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSendBackModal(true)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw size={13} />
                        <span>Send Back</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DYNAMIC DAILY REPORT (Identical for Employee and Manager Own Work) */}
            {(isOwnWork || !isManagerOrAdmin) && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#801424]">
                      DAILY REPORT
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {activeFields.length} fields
                    </span>
                  </div>

                  {/* Step 21.9 — Quantity progress update stepper */}
                  {Number(work.target_quantity || 0) > 0 && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800">
                          Completed Quantity ({work.quantity_unit || 'Units'})
                        </label>
                        <span className="text-xs font-black text-[#801424]">
                          {Math.min(100, Math.round((actualValue / Number(work.target_quantity)) * 100))}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = Number(reportValues.videos_completed || reportValues.completed || actualValue || 0)
                            const nextVal = Math.max(0, currentVal - 1)
                            setReportValues((prev) => ({
                              ...prev,
                              videos_completed: nextVal,
                              completed: nextVal,
                              actual_value: nextVal,
                            }))
                          }}
                          className="h-8 w-8 rounded-lg bg-white border border-slate-200 font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer text-sm shadow-2xs"
                        >
                          -
                        </button>
                        <span className="text-base font-black text-slate-900 min-w-16 text-center">
                          {actualValue} / {work.target_quantity} {work.quantity_unit || 'items'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentVal = Number(reportValues.videos_completed || reportValues.completed || actualValue || 0)
                            const nextVal = currentVal + 1
                            setReportValues((prev) => ({
                              ...prev,
                              videos_completed: nextVal,
                              completed: nextVal,
                              actual_value: nextVal,
                            }))
                          }}
                          className="h-8 w-8 rounded-lg bg-[#801424] text-white font-black hover:bg-[#9f1239] flex items-center justify-center cursor-pointer text-sm shadow-2xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {activeFields.map((field: any) => (
                      <DynamicWorkField
                        key={field.id || field.key}
                        field={field}
                        value={reportValues[field.key]}
                        onChange={(val) =>
                          setReportValues((prev) => ({
                            ...prev,
                            [field.key]: val,
                          }))
                        }
                      />
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveUpdate}
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs cursor-pointer transition disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : 'SAVE UPDATE'}
                    </button>
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS: Start Work / Complete Work / Mark Blocked / Resume Work */}
                <div className="pt-1">
                  {work.status === 'TODO' && (
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#801424] px-4 py-3 text-xs font-black text-white hover:bg-[#9f1239] disabled:opacity-50 cursor-pointer shadow-xs transition"
                    >
                      Start Work
                    </button>
                  )}

                  {work.status === 'IN_PROGRESS' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleCompleteWork}
                        disabled={submitting}
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Complete Work</span>
                      </button>

                      <button
                        onClick={() => handleStatusTransition('BLOCKED')}
                        disabled={submitting}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer transition"
                      >
                        Mark Blocked
                      </button>
                    </div>
                  )}

                  {work.status === 'BLOCKED' && (
                    <button
                      onClick={() => handleStatusTransition('IN_PROGRESS')}
                      disabled={submitting}
                      className="w-full rounded-xl bg-[#801424] px-4 py-3 text-xs font-black text-white hover:bg-[#9f1239] disabled:opacity-50 cursor-pointer shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Play size={14} />
                      <span>Resume Work</span>
                    </button>
                  )}

                  {work.status === 'DONE' && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-emerald-800 font-bold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>✓ Completed</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEND BACK MODAL */}
            {showSendBackModal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-2.5">
                <p className="font-bold text-amber-900 text-xs">
                  ↩ What needs to be changed?
                </p>
                <textarea
                  rows={2}
                  value={sendBackNote}
                  onChange={(e) => setSendBackNote(e.target.value)}
                  placeholder="Example: Please fix video intro timing and re-export."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSendBackModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendBack}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded-lg bg-[#801424] text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Send Back
                  </button>
                </div>
              </div>
            )}

            {/* LATEST UPDATES & MEASURABLE OUTPUT */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Activity & Output History
                </span>
                {latestUpdate && (
                  <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                    <span>
                      Completed: {latestUpdate.actual_value ?? actualValue ?? 0} {unit}
                    </span>
                    {linkedTarget && (
                      <span>
                        Target: {linkedTarget.target_value} {linkedTarget.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {updates.map((u) => (
                  <StructuredWorkUpdateCard
                    key={u.id}
                    update={u}
                    unit={unit}
                  />
                ))}
                {updates.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No work updates yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
