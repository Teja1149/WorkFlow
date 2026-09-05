import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  User,
  AlertTriangle,
  Send,
  Target,
  TrendingUp,
  AlertCircle,
  X,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getWorkItem,
  updateWorkItem,
  updateWorkItemStatus,
  getWorkComments,
  addWorkComment,
  getWorkUpdates,
  addWorkUpdate,
  getWorkConcerns,
  addWorkConcern,
  resolveWorkConcern,
  getWorkAssignmentHistory,
  type WorkItem,
  type WorkAssignmentHistory,
} from '../features/work-items/work-item.service'
import { getEmployees } from '../features/employees/employee.service'
import type { UserProfile } from '../features/auth/auth.types'
import { getWorkTypes } from '../features/work-types/work-type.service'
import type { WorkType } from '../features/work-types/work-type.types'
import type {
  WorkComment,
  WorkUpdate,
  WorkConcern,
} from '../features/work-items/work-communication.service'
import WorkDependenciesSection from '../features/work-dependencies/WorkDependenciesSection'
import DeadlineCountdown from '../features/work-execution/DeadlineCountdown'
import {
  getOrganizationWorkSettings,
  type OrganizationWorkSettings,
} from '../features/organization-settings/organization-setting.service'
import { getEmployeeDailyTargets } from '../features/daily-targets/daily-target.service'
import { getProjectTargets } from '../features/project-targets/project-target.service'
import { StructuredWorkUpdateCard } from '../features/work-items/work-update-parser'
import StatusBadge from '../components/ui/StatusBadge'
import HealthBadge from '../components/ui/HealthBadge'

export default function WorkItemDetails() {
  const { id: workItemId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { accessToken, profile } = useAuth()

  const [workItem, setWorkItem] = useState<WorkItem | null>(null)
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [comments, setComments] = useState<WorkComment[]>([])
  const [updates, setUpdates] = useState<WorkUpdate[]>([])
  const [concerns, setConcerns] = useState<WorkConcern[]>([])
  const [settings, setSettings] = useState<OrganizationWorkSettings | null>(null)
  const [linkedDailyTarget, setLinkedDailyTarget] = useState<any | null>(null)
  const [projectTarget, setProjectTarget] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [newComment, setNewComment] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  const [workedToday, setWorkedToday] = useState('')
  const [completedWork, setCompletedWork] = useState('')
  const [blockersNextSteps, setBlockersNextSteps] = useState('')
  const [cumulativeQuantity, setCumulativeQuantity] = useState<number | string>('')
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const [concernText, setConcernText] = useState('')
  const [concernPriority, setConcernPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [showConcernModal, setShowConcernModal] = useState(false)
  const [concernSubmitting, setConcernSubmitting] = useState(false)

  // Reassignment & History state (Steps 143 & 145)
  const [assignmentHistory, setAssignmentHistory] = useState<WorkAssignmentHistory[]>([])
  const [employees, setEmployees] = useState<UserProfile[]>([])
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [reassignEmployeeId, setReassignEmployeeId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignSubmitting, setReassignSubmitting] = useState(false)

  const canManage =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  async function loadAllData() {
    if (!accessToken || !workItemId) return
    setLoading(true)
    setError('')
    try {
      const [item, comList, upList, conList, wtList, histList, empList, workSettings] = await Promise.all([
        getWorkItem(accessToken, workItemId),
        getWorkComments(accessToken, workItemId).catch(() => []),
        getWorkUpdates(accessToken, workItemId).catch(() => []),
        getWorkConcerns(accessToken, workItemId).catch(() => []),
        getWorkTypes(accessToken).catch(() => []),
        getWorkAssignmentHistory(accessToken, workItemId).catch(() => []),
        getEmployees(accessToken).catch(() => []),
        getOrganizationWorkSettings(accessToken).catch(() => null),
      ])

      setWorkTypes(wtList)
      setAssignmentHistory(histList)
      setEmployees(empList)
      setSettings(workSettings)

      setWorkItem(item)

      // Check if there is a daily target linked to this work item
      if (item.assigned_to) {
        try {
          const targets = await getEmployeeDailyTargets(accessToken, item.assigned_to)
          const linked = targets.find((t: any) => t.work_item_id === item.id)
          if (linked) {
            setLinkedDailyTarget(linked)
          }
        } catch {
          // Ignore target load failure
        }
      }

      // Check if there is a project target linked to this work item
      if (item.project_id) {
        try {
          const pTargets = await getProjectTargets(accessToken, item.project_id)
          if (pTargets && pTargets.length > 0) {
            const matched = (item as any).project_target_id
              ? pTargets.find((t: any) => t.id === (item as any).project_target_id) || pTargets[0]
              : pTargets[0]
            setProjectTarget(matched)
          }
        } catch {
          // Ignore project target load failure
        }
      }

      setComments(comList)
      setUpdates(upList)
      setConcerns(conList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load work details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [accessToken, workItemId])

  // Step 414F — Add explicit Start Work action
  async function handleStartWork() {
    if (!accessToken || !workItemId) return
    try {
      await updateWorkItem(accessToken, workItemId, {
        status: 'IN_PROGRESS',
      })
      await loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to start work.')
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !workItemId || !newComment.trim()) return
    setCommentSubmitting(true)
    try {
      const created = await addWorkComment(accessToken, workItemId, { comment: newComment.trim() })
      setComments((prev) => [...prev, created])
      setNewComment('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setCommentSubmitting(false)
    }
  }

  // 3-field Work Update submission (Clean structured storage)
  async function handleAddUpdate(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!accessToken || !workItemId || !workedToday.trim()) return
    if (workItem?.status === 'BLOCKED') {
      alert('This work is currently on hold. Resolve the blocker before posting an update.')
      return
    }
    setUpdateSubmitting(true)
    try {
      const targetQty = Number(workItem?.target_quantity || 0)
      const nextQty = cumulativeQuantity !== '' ? Math.max(0, Number(cumulativeQuantity)) : undefined

      if (targetQty > 0 && nextQty !== undefined) {
        await updateWorkItem(accessToken, workItemId, {
          completed_quantity: nextQty,
        })
      }

      const cleanParts = [
        workedToday.trim(),
        completedWork.trim() ? `Completed: ${completedWork.trim()}` : '',
        blockersNextSteps.trim() ? `Blockers / Next Steps: ${blockersNextSteps.trim()}` : '',
      ].filter(Boolean)

      await addWorkUpdate(accessToken, workItemId, {
        update_text: cleanParts.join('\n\n') || workedToday.trim(),
        report_data: {
          worked_today: workedToday.trim(),
          completed_work: completedWork.trim(),
          blockers_next_steps: blockersNextSteps.trim(),
          actual_value: nextQty,
        },
        actual_value: nextQty,
      })
      setWorkedToday('')
      setCompletedWork('')
      setBlockersNextSteps('')
      setShowUpdateModal(false)
      await loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post update.')
    } finally {
      setUpdateSubmitting(false)
    }
  }

  async function handleAddConcern(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !workItemId || !concernText.trim()) return
    setConcernSubmitting(true)
    try {
      const created = await addWorkConcern(accessToken, workItemId, {
        concern: concernText.trim(),
        priority: concernPriority,
      })
      setConcerns((prev) => [created, ...prev])
      setConcernText('')
      setConcernPriority('MEDIUM')
      setShowConcernModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to report concern.')
    } finally {
      setConcernSubmitting(false)
    }
  }

  async function handleResolveConcern(concernId: string) {
    if (!accessToken || !workItemId) return
    try {
      await resolveWorkConcern(accessToken, workItemId, concernId)
      setConcerns((prev) =>
        prev.map((c) => (c.id === concernId ? { ...c, status: 'RESOLVED' } : c)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve concern.')
    }
  }

  async function handleStatusChange(newStatus: WorkItem['status']) {
    if (!accessToken || !workItemId) return
    try {
      if (newStatus === 'DONE' && workItem?.target_quantity && Number(workItem.target_quantity) > 0) {
        await updateWorkItem(accessToken, workItemId, {
          completed_quantity: Number(workItem.target_quantity),
          status: 'DONE',
        })
      } else {
        const updated = await updateWorkItemStatus(accessToken, workItemId, newStatus)
        setWorkItem((prev) => (prev ? { ...prev, ...updated } : prev))
      }
      await loadAllData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status.')
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading work item details...</div>
  }

  if (!workItem) {
    return (
      <div className="p-8 space-y-4">
        <button
          onClick={() => navigate('/work')}
          className="flex items-center gap-2 text-blue-600 font-semibold text-sm"
        >
          <ArrowLeft size={18} />
          Back to Work Items
        </button>
        <p className="text-slate-500">Work item not found.</p>
      </div>
    )
  }

  const latestProgress = updates.length > 0 ? updates[0].progress_percent : (workItem.status === 'DONE' ? 100 : workItem.status === 'IN_PROGRESS' ? 50 : 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/work')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft size={17} />
        Back to Work Items
      </button>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-7 shadow-xs space-y-6">
        {/* Step 251 — Hierarchical Breadcrumb Header */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 pb-3 border-b border-slate-100">
          {workItem.projects && (
            <button
              onClick={() => navigate(`/projects/${workItem.project_id}`)}
              className="text-[#801424] font-bold hover:underline cursor-pointer"
            >
              {workItem.projects.name} ({workItem.projects.project_key})
            </button>
          )}

          {(workItem.project_modules || workItem.module) && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-medium">
                {(workItem.project_modules || workItem.module)?.name}
              </span>
            </>
          )}

          {(workItem.project_milestones || workItem.milestone) && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-medium">
                {(workItem.project_milestones || workItem.milestone)?.name}
              </span>
            </>
          )}

          {((workItem as any).sprints || (workItem as any).sprint) && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-medium">
                {((workItem as any).sprints || (workItem as any).sprint)?.name}
              </span>
            </>
          )}

          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-bold">
            {workItem.title}
          </span>
        </div>

        {/* Project Target & Daily Target Overviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectTarget && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#801424]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
                    PROJECT OUTPUT TARGET
                  </span>
                </div>
                <HealthBadge health={projectTarget.health || 'GREEN'} />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {projectTarget.name}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {projectTarget.actual_value || 0} / {projectTarget.target_value} {projectTarget.unit || 'Items'} total
                    {Number(projectTarget.target_value) - Number(projectTarget.actual_value || 0) > 0 &&
                      ` · ${Math.max(0, Number(projectTarget.target_value) - Number(projectTarget.actual_value || 0))} remaining`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-extrabold text-slate-900 font-mono">
                    {projectTarget.achievement || 0}%
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Achievement
                  </p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, projectTarget.achievement || 0)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Deadline: {projectTarget.deadline_date || 'No deadline'}</span>
                <span className="font-semibold">{projectTarget.status || 'ACTIVE'}</span>
              </div>
            </div>
          )}

          {linkedDailyTarget && (
            <div className="rounded-2xl border border-[#801424]/20 bg-rose-50/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#801424]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
                    TODAY'S TARGET
                  </span>
                </div>
                <HealthBadge health={linkedDailyTarget.health || 'GREEN'} />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {linkedDailyTarget.title}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {linkedDailyTarget.actual_value || 0} / {linkedDailyTarget.target_value} {linkedDailyTarget.unit} completed
                    {Number(linkedDailyTarget.target_value) - Number(linkedDailyTarget.actual_value || 0) > 0 &&
                      ` · ${Math.max(0, Number(linkedDailyTarget.target_value) - Number(linkedDailyTarget.actual_value || 0))} remaining`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-extrabold text-[#801424] font-mono">
                    {linkedDailyTarget.achievement_percent || 0}%
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                    Achievement
                  </p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#801424] transition-all"
                  style={{ width: `${linkedDailyTarget.achievement_percent || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Deadline: {linkedDailyTarget.deadline_time || 'End of day'}</span>
                <span className="font-semibold">{linkedDailyTarget.status}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                <Briefcase size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{workItem.title}</h1>
                <p className="text-xs text-slate-400 font-mono">ID: {workItem.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                workItem.priority === 'URGENT' || workItem.priority === 'HIGH'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {workItem.priority}
            </span>

            {/* Step 414N — Status & Health Badges */}
            <StatusBadge status={workItem.status} />
            <HealthBadge health={workItem.health || 'GREEN'} />

            {/* Step 509 — State transition buttons */}
            {workItem.status === 'TODO' && (
              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className="rounded-xl bg-[#801424] hover:bg-[#9f1239] px-4 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer transition"
              >
                Start Work
              </button>
            )}

            {workItem.status === 'IN_PROGRESS' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleStatusChange('DONE')}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer transition"
                >
                  <span>Complete Work</span>
                </button>
                <button
                  onClick={() => handleStatusChange('BLOCKED')}
                  className="rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1.5 text-xs font-bold cursor-pointer transition"
                >
                  Put On Hold
                </button>
              </div>
            )}

            {workItem.status === 'BLOCKED' && (
              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className="rounded-xl bg-[#801424] hover:bg-[#9f1239] px-4 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer transition"
              >
                Resume Work
              </button>
            )}

            {workItem.status === 'DONE' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                <span>Completed</span>
              </div>
            )}

            {workItem.status === 'DONE' && canManage && (
              <button
                type="button"
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className="py-1.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs cursor-pointer transition"
              >
                ↩ Send Back for Correction
              </button>
            )}

            {canManage && (
              <select
                value={workItem.status}
                onChange={(e) => handleStatusChange(e.target.value as WorkItem['status'])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-800 outline-none cursor-pointer"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Completed</option>
                <option value="BLOCKED">On Hold</option>
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Work Type:</span>
            {canManage ? (
              <select
                value={workItem.work_type_id || ''}
                onChange={async (e) => {
                  const val = e.target.value || null
                  try {
                    const updated = await updateWorkItem(accessToken!, workItem.id, { work_type_id: val })
                    setWorkItem((prev) => (prev ? { ...prev, ...updated } : prev))
                    await loadAllData()
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to update work type.')
                  }
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800 outline-none focus:border-zinc-800"
              >
                <option value="">No Work Type</option>
                {workTypes
                  .filter((wt) => wt.is_active)
                  .map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name}
                    </option>
                  ))}
              </select>
            ) : (
              <strong className="text-slate-900">
                {(workItem.work_types || workItem.work_type)?.name || 'None'}
              </strong>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Project:</span>
            <strong className="text-slate-900">{workItem.projects?.name || 'Workspace Project'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <User size={15} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Assigned to:</span>
            <strong className="text-slate-900">
              {workItem.assignee
                ? `${workItem.assignee.first_name} ${workItem.assignee.last_name || ''}`
                : 'Unassigned'}
            </strong>
            {canManage && (
              <button
                onClick={() => {
                  setReassignEmployeeId(workItem.assigned_to || '')
                  setReassignReason('')
                  setShowReassignModal(true)
                }}
                className="ml-2 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                Reassign
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Deadline:</span>
            <DeadlineCountdown
              deadline={workItem.deadline}
              deadlineTime={workItem.deadline_time || null}
              timezone={settings?.timezone || 'Asia/Kolkata'}
              workdayEnd={settings?.workday_end || '18:00'}
              health={workItem.health}
            />
          </div>
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h2>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {workItem.description || 'No detailed description provided.'}
        </p>
      </div>

      {/* Progress Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress</h2>
            {workItem.target_quantity && Number(workItem.target_quantity) > 0 ? (
              <div className="mt-1 flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-900">
                  {workItem.completed_quantity || 0} / {workItem.target_quantity} {workItem.quantity_unit || 'Items'} Completed
                </span>
                <span className="text-xs font-bold text-[#801424] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {Math.min(100, Math.round(((Number(workItem.completed_quantity) || 0) / Number(workItem.target_quantity)) * 100))}%
                </span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{latestProgress}%</span>
            )}
          </div>

          <button
            onClick={() => {
              if (workItem.status === 'BLOCKED') {
                alert('This work is currently on hold. Resolve the blocker before posting an update.')
                return
              }
              setCumulativeQuantity(workItem.completed_quantity ?? 0)
              setShowUpdateModal(true)
            }}
            disabled={workItem.status === 'DONE'}
            className="flex items-center gap-2 bg-[#801424] hover:bg-[#9f1239] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <MessageSquare size={14} />
            Update Work
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 transition-all duration-500 rounded-full"
            style={{
              width: `${
                workItem.target_quantity && Number(workItem.target_quantity) > 0
                  ? Math.min(100, Math.round(((Number(workItem.completed_quantity) || 0) / Number(workItem.target_quantity)) * 100))
                  : latestProgress
              }%`,
            }}
          />
        </div>

        {/* Deadline Pacing Intelligence */}
        {workItem.pacing?.enabled && (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <Target size={13} />
                DEADLINE PACING INTELLIGENCE
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                  workItem.pacing.status === 'OVERDUE'
                    ? 'bg-red-600 text-white'
                    : workItem.pacing.status === 'BEHIND'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : workItem.pacing.status === 'WORKLOAD_INCREASING' || workItem.pacing.status === 'AT_RISK'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : workItem.pacing.status === 'AHEAD'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : workItem.pacing.status === 'SCHEDULED'
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                {workItem.pacing.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Target Qty</span>
                <span className="text-sm font-black text-slate-900">
                  {workItem.pacing.targetQuantity} <span className="text-[9px] text-slate-400">{workItem.quantity_unit || 'items'}</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Expected Now</span>
                <span className="text-sm font-black text-slate-900">
                  {workItem.pacing.expectedQuantity} <span className="text-[9px] text-slate-400">{workItem.quantity_unit || 'items'}</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Required/Day</span>
                <span className="text-sm font-black text-rose-700">
                  {workItem.pacing.requiredPerDay} <span className="text-[9px] text-slate-400">/day</span>
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Days Left</span>
                <span className="text-sm font-black text-slate-900">
                  {workItem.pacing.remainingDays} <span className="text-[9px] text-slate-400">days</span>
                </span>
              </div>
            </div>

            {workItem.pacing.recommendedPaceText ? (
              <p className="text-[11px] font-semibold text-slate-700 bg-white/80 rounded-xl p-2.5 border border-slate-200/60">
                🎯 Recommended Pace: {workItem.pacing.recommendedPaceText}
              </p>
            ) : workItem.pacing.recommendedIntervalDays ? (
              <p className="text-[11px] font-semibold text-slate-700 bg-white/80 rounded-xl p-2.5 border border-slate-200/60">
                🎯 Recommended Pace: 1 {workItem.quantity_unit || 'item'} every {workItem.pacing.recommendedIntervalDays} days over {workItem.pacing.totalDays} total days.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Work Updates Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Updates</h2>
          {workItem.status !== 'DONE' && (
            <button
              onClick={() => {
                if (workItem.status === 'BLOCKED') {
                  alert('This work is currently on hold. Resolve the blocker before posting an update.')
                  return
                }
                setShowUpdateModal(true)
              }}
              className="text-xs font-bold text-[#801424] hover:underline cursor-pointer"
            >
              + Update Work
            </button>
          )}
        </div>

        <div className="space-y-3">
          {updates.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No work updates logged yet.
            </div>
          ) : (
            updates.map((u) => (
              <StructuredWorkUpdateCard
                key={u.id}
                update={u}
                unit={workItem.quantity_unit || 'Items'}
              />
            ))
          )}
        </div>

        {workItem.status !== 'DONE' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (workItem.status === 'BLOCKED') {
                  alert('This work is currently on hold. Resolve the blocker before posting an update.')
                  return
                }
                setShowUpdateModal(true)
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#801424] hover:bg-slate-50 text-slate-600 hover:text-[#801424] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Update Work (Answer 3 simple questions)</span>
            </button>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments</h2>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No comments yet. Start the conversation!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {c.user?.first_name} {c.user?.last_name || ''} ({c.user?.role})
                  </span>
                  <span className="text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-700">{c.comment}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddComment} className="flex gap-3 pt-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-zinc-800"
          />
          <button
            type="submit"
            disabled={commentSubmitting || !newComment.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
          >
            <Send size={14} />
            Send
          </button>
        </form>
      </div>

      {/* ASSIGNMENT HISTORY (Step 145) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          ASSIGNMENT HISTORY
        </h2>
        <div className="border-t border-slate-100 pt-3 space-y-3">
          {assignmentHistory.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              {workItem.assignee
                ? `${workItem.assignee.first_name} ${workItem.assignee.last_name || ''} — Assigned ${new Date(workItem.created_at).toLocaleDateString()}`
                : 'No assignment history logged.'}
            </p>
          ) : (
            assignmentHistory.map((hist, idx) => {
              const nextName = hist.next_user
                ? `${hist.next_user.first_name} ${hist.next_user.last_name || ''}`.trim()
                : 'Unassigned'
              const isFirst = idx === 0 && !hist.previous_assignee

              return (
                <div
                  key={hist.id}
                  className="p-3.5 border border-slate-100 rounded-xl bg-slate-50/50 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{nextName}</span>
                    <span className="text-slate-400 text-[11px] font-normal">
                      {new Date(hist.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-500 font-medium text-[11px]">
                    {isFirst ? 'Assigned' : 'Reassigned'}
                  </p>
                  {hist.reason && (
                    <div className="pt-1.5 border-t border-slate-200/60 mt-1">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                        Reason:
                      </span>
                      <p className="text-slate-800 font-medium">{hist.reason}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Work Dependencies & Root Cause Blockers */}
      <WorkDependenciesSection workItem={workItem} />

      {/* Concerns Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Concerns & Blockers</h2>
          <button
            onClick={() => setShowConcernModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition"
          >
            <AlertTriangle size={14} />
            Report Concern
          </button>
        </div>

        <div className="space-y-3">
          {concerns.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No open concerns reported for this item.</p>
          ) : (
            concerns.map((c) => (
              <div
                key={c.id}
                className={`p-4 border rounded-xl space-y-1 text-xs ${
                  c.status === 'OPEN' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {c.reporter?.first_name} {c.reporter?.last_name || ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'OPEN' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.status === 'OPEN' && (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'MANAGER') && (
                      <button
                        onClick={() => handleResolveConcern(c.id)}
                        className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Resolve
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-700">{c.concern}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Work Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setShowUpdateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Update Work</h2>
              <p className="text-xs text-slate-500 mt-1">
                Answer these 3 simple questions to update your progress. No percentage required.
              </p>
            </div>

            <form onSubmit={handleAddUpdate} className="space-y-3.5 text-xs">
              {workItem.target_quantity && Number(workItem.target_quantity) > 0 && (
                <div className="bg-rose-50/60 p-3.5 rounded-xl border border-[#801424]/20 space-y-1.5">
                  <label className="block font-bold text-slate-900">
                    Cumulative Completed {workItem.quantity_unit || 'Units'} (Total Target: {workItem.target_quantity}) *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={cumulativeQuantity}
                      onChange={(e) => setCumulativeQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#801424] bg-white font-bold text-slate-900"
                      placeholder={`e.g. ${Math.min(Number(workItem.target_quantity), (Number(workItem.completed_quantity) || 0) + 1)}`}
                    />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap font-mono">
                      / {workItem.target_quantity} {workItem.quantity_unit || 'items'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Enter the total completed count so far. When reaching {workItem.target_quantity}, this work item will automatically be marked as completed.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  What did you work on today? *
                </label>
                <textarea
                  required
                  rows={2}
                  value={workedToday}
                  onChange={(e) => setWorkedToday(e.target.value)}
                  placeholder="Summary of what you worked on..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#801424] resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  What is completed?
                </label>
                <textarea
                  rows={2}
                  value={completedWork}
                  onChange={(e) => setCompletedWork(e.target.value)}
                  placeholder="Specific items, tasks, or milestones finished..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#801424] resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Any blocker / next step?
                </label>
                <textarea
                  rows={2}
                  value={blockersNextSteps}
                  onChange={(e) => setBlockersNextSteps(e.target.value)}
                  placeholder="Any blockers encountered or upcoming next steps..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-[#801424] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateSubmitting || !workedToday.trim()}
                  className="px-5 py-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs transition"
                >
                  <Send size={12} />
                  <span>{updateSubmitting ? 'Submitting...' : 'Submit Update'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Concern Modal */}
      {showConcernModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setShowConcernModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Report Concern or Blocker</h2>
            <p className="text-xs text-slate-500 mb-4">Notify managers of blockers preventing task completion.</p>

            <form onSubmit={handleAddConcern} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Priority Level</label>
                <select
                  value={concernPriority}
                  onChange={(e) => setConcernPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                >
                  <option value="LOW">LOW — Informational</option>
                  <option value="MEDIUM">MEDIUM — Normal Follow-up</option>
                  <option value="HIGH">HIGH — High Risk (Orange)</option>
                  <option value="CRITICAL">CRITICAL — Blocker (Red)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Describe Concern / Blocker *</label>
                <textarea
                  required
                  rows={4}
                  value={concernText}
                  onChange={(e) => setConcernText(e.target.value)}
                  placeholder="Explain the blocker or difficulty preventing task completion..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConcernModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={concernSubmitting || !concernText.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Report Concern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reassign Work Modal (Step 143) */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
            <button
              onClick={() => setShowReassignModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-slate-900">Reassign Work Item</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!accessToken || !workItem) return
                const isAssigneeChanging = reassignEmployeeId !== (workItem.assigned_to || '')
                if (isAssigneeChanging && !reassignReason.trim()) {
                  alert('Reassignment reason is required when changing assignee.')
                  return
                }

                setReassignSubmitting(true)
                try {
                  await updateWorkItem(accessToken, workItem.id, {
                    assigned_to: reassignEmployeeId || null,
                    assignment_reason: reassignReason.trim() || undefined,
                  })
                  setShowReassignModal(false)
                  await loadAllData()
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to reassign work.')
                } finally {
                  setReassignSubmitting(false)
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Reassign To</label>
                <select
                  value={reassignEmployeeId}
                  onChange={(e) => setReassignEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                >
                  <option value="">Unassigned</option>
                  {employees
                    .filter((emp) =>
                      ['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(emp.role),
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name || ''} ({emp.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Reason {reassignEmployeeId !== (workItem.assigned_to || '') && '*'}
                </label>
                <input
                  type="text"
                  required={reassignEmployeeId !== (workItem.assigned_to || '')}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Workload balancing"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={reassignSubmitting}
                  className="px-5 py-2 bg-[#09090b] hover:bg-[#18181b] text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
