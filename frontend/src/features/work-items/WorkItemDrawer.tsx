import { useEffect, useState } from 'react'
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
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  getWorkUpdates,
  addWorkUpdate,
  updateWorkItem,
  updateWorkItemStatus,
  type WorkItem,
} from './work-item.service'
import { getWorkStatusConfig } from './work-status'
import type { DailyTarget } from '../daily-targets/daily-target.types'
import HealthBadge from '../../components/ui/HealthBadge'
import StatusBadge from '../../components/ui/StatusBadge'
import DeadlineCountdown from '../work-execution/DeadlineCountdown'
import { StructuredWorkUpdateCard } from './work-update-parser'
import {
  formatTargetValue,
  targetAchievement,
  targetRemaining,
} from '../daily-targets/daily-target.ui'

interface Props {
  workItem: WorkItem | null
  linkedTarget?: DailyTarget | null
  isOpen: boolean
  onClose: () => void
  onUpdated: () => Promise<void>
}

export default function WorkItemDrawer({
  workItem,
  linkedTarget,
  isOpen,
  onClose,
  onUpdated,
}: Props) {
  const { accessToken, profile } = useAuth()

  const [updates, setUpdates] = useState<any[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [updateText, setUpdateText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [showSendBackModal, setShowSendBackModal] = useState(false)

  const isManagerOrAdmin =
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'MANAGER'

  useEffect(() => {
    if (!isOpen || !workItem || !accessToken) return
    setUpdateText('')
    setShowUpdateForm(false)
    setShowSendBackModal(false)

    async function load() {
      setLoadingUpdates(true)
      try {
        const data = await getWorkUpdates(accessToken!, workItem!.id)
        setUpdates(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load work updates:', err)
      } finally {
        setLoadingUpdates(false)
      }
    }

    void load()
  }, [isOpen, workItem?.id, accessToken])

  if (!isOpen || !workItem) return null

  const progress = Number(workItem.progress_percent || 0)
  const health = (workItem as any).health || 'GREEN'

  // Step 509 — Transition Status Handlers
  async function handleStatusTransition(nextStatus: WorkItem['status'], notes?: string) {
    if (!accessToken || !workItem) return
    setSubmitting(true)
    setError('')
    try {
      await updateWorkItemStatus(accessToken, workItem.id, nextStatus, notes)
      await onUpdated()
      if (nextStatus === 'DONE') {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change status.')
    } finally {
      setSubmitting(false)
    }
  }

  // Post Work Update
  async function handlePostUpdate(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!accessToken || !updateText.trim()) return
    if (workItem?.status === 'BLOCKED') {
      setError('This work is currently on hold. Resolve the blocker before posting a work update.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await addWorkUpdate(accessToken, workItem!.id, {
        update_text: updateText.trim(),
      })
      setUpdateText('')
      setShowUpdateForm(false)
      const data = await getWorkUpdates(accessToken, workItem!.id)
      setUpdates(Array.isArray(data) ? data : [])
      await onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post update.')
    } finally {
      setSubmitting(false)
    }
  }

  // Manager Action: Send Back
  async function handleSendBack() {
    if (!accessToken || !workItem) return
    const notes = reviewNote.trim()
    if (!notes) {
      setError('A reason is required when sending work back.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await updateWorkItemStatus(accessToken, workItem.id, 'IN_PROGRESS', notes, 'SEND_BACK')
      setShowSendBackModal(false)
      setReviewNote('')
      await onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send back.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleComplete() {
    await handleStatusTransition('DONE')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-lg bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slideInRight text-xs">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#801424] font-mono">
                  WORK ITEM LIFECYCLE
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {workItem.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 font-bold">
                {error}
              </div>
            )}

            {/* Lifecycle Status & Progress Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                      getWorkStatusConfig(workItem.status).badge
                    }`}
                  >
                    {getWorkStatusConfig(workItem.status).label}
                  </span>
                  <HealthBadge health={health} />
                </div>

                <span className="text-xl font-black text-slate-900">
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#801424] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-slate-500 font-medium pt-1 text-[11px]">
                <span>
                  {workItem.deadline ? `Deadline: ${workItem.deadline}` : 'No deadline'}
                </span>
                <span>{workItem.priority} Priority</span>
              </div>
            </div>

            {/* Step 399 — Linked Today's Target Card */}
            {linkedTarget && (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#801424] font-mono flex items-center gap-1.5">
                    <Target size={12} />
                    Today's Target Commitment
                  </span>
                  <HealthBadge health={linkedTarget.health || 'GREEN'} />
                </div>

                <div className="flex items-end justify-between pt-1">
                  <div>
                    <p className="text-base font-black text-slate-900">
                      {formatTargetValue(linkedTarget.actual_value, linkedTarget.unit)} /{' '}
                      {formatTargetValue(linkedTarget.target_value, linkedTarget.unit)}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {targetRemaining(linkedTarget.target_value, linkedTarget.actual_value) > 0
                        ? `${targetRemaining(linkedTarget.target_value, linkedTarget.actual_value)} ${linkedTarget.unit} remaining`
                        : 'Target achieved'}
                    </p>
                  </div>

                  <span className="text-base font-black text-[#801424]">
                    {targetAchievement(linkedTarget.target_value, linkedTarget.actual_value)}%
                  </span>
                </div>
              </div>
            )}

            {/* Deliverable Hierarchy Context */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">
                Deliverable Context
              </span>

              <div className="flex items-center gap-2 text-slate-700">
                <FolderKanban size={13} className="text-[#801424] shrink-0" />
                <span className="text-slate-400 font-medium">Project:</span>
                <strong className="text-slate-900">{workItem.projects?.name || 'General'}</strong>
              </div>

              {workItem.project_modules?.name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-3" />
                  <span className="text-slate-400 font-medium">Module:</span>
                  <strong className="text-slate-900">{workItem.project_modules.name}</strong>
                </div>
              )}
            </div>

            {/* Quick Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">
                  Status
                </span>
                <StatusBadge status={workItem.status} />
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">
                  Health & SLA
                </span>
                <HealthBadge health={(workItem as any).health || 'GREEN'} />
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">
                  Assignee
                </span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <User size={13} className="text-slate-400" />
                  <span>
                    {workItem.assignee
                      ? `${workItem.assignee.first_name || ''} ${workItem.assignee.last_name || ''}`.trim()
                      : 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 block mb-1">
                  Deadline
                </span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Calendar size={13} className="text-slate-400" />
                  <span>
                    {workItem.deadline
                      ? new Date(workItem.deadline).toLocaleDateString()
                      : 'No deadline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Manager Send Back Action for Completed Work */}
            {workItem.status === 'DONE' && isManagerOrAdmin && (
              <button
                type="button"
                onClick={() => setShowSendBackModal(true)}
                disabled={submitting}
                className="w-full py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs cursor-pointer transition"
              >
                ↩ Send Back
              </button>
            )}

            {/* Manager Send Back Action */}
            {isManagerOrAdmin &&
              workItem.status !== 'DONE' &&
              workItem.assigned_to &&
              workItem.assigned_to !== profile?.id && (
                <button
                  type="button"
                  onClick={() => setShowSendBackModal(true)}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs cursor-pointer transition"
                >
                  ↩ Send Back to Employee
                </button>
              )}

            {/* Send Back Reason Sub-Form */}
            {showSendBackModal && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                <label className="font-bold text-slate-800 text-[11px]">
                  Feedback for Employee
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Please complete error handling and unit tests."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs bg-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSendBackModal(false)}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendBack}
                    disabled={submitting}
                    className="px-3 py-1 rounded-lg bg-[#801424] text-white font-bold text-[10px]"
                  >
                    Confirm & Send Back
                  </button>
                </div>
              </div>
            )}

            {/* Work Updates Thread */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <MessageSquare size={12} />
                  Work Updates ({updates.length})
                </span>

                {workItem.status !== 'DONE' && (
                  <button
                    onClick={() => setShowUpdateForm(!showUpdateForm)}
                    className="text-[11px] font-bold text-[#801424] hover:underline cursor-pointer"
                  >
                    {showUpdateForm ? 'Cancel' : '+ Post Update'}
                  </button>
                )}
              </div>

              {showUpdateForm && (
                <form
                  onSubmit={handlePostUpdate}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3"
                >
                  <textarea
                    value={updateText}
                    onChange={(e) =>
                      setUpdateText(e.target.value)
                    }
                    placeholder="What did you work on? What was completed? Any blocker or next step?"
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-[#801424] resize-none"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        submitting ||
                        !updateText.trim()
                      }
                      className="px-4 py-1.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={12} />
                      <span>Post Update</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Updates List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {loadingUpdates ? (
                  <p className="text-slate-400 py-3 text-center">Loading updates...</p>
                ) : updates.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No work updates yet.
                  </div>
                ) : (
                  updates.map((up) => (
                    <StructuredWorkUpdateCard
                      key={up.id}
                      update={up}
                      unit={workItem.quantity_unit || 'items'}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-2">
            {isManagerOrAdmin ? (
              <>
                {workItem.status === 'TODO' && (
                  <button
                    onClick={() => handleStatusTransition('IN_PROGRESS')}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play size={14} />
                    <span>Start Work</span>
                  </button>
                )}

                {workItem.status === 'IN_PROGRESS' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusTransition('DONE')}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>✓ Complete</span>
                    </button>

                    <button
                      onClick={() => setShowSendBackModal(true)}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span>↩ Send Back</span>
                    </button>

                    <button
                      onClick={() => handleStatusTransition('BLOCKED')}
                      disabled={submitting}
                      className="px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold cursor-pointer disabled:opacity-50"
                    >
                      Put On Hold
                    </button>
                  </div>
                )}

                {workItem.status === 'BLOCKED' && (
                  <button
                    onClick={() => handleStatusTransition('IN_PROGRESS')}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play size={14} />
                    <span>Resume Work</span>
                  </button>
                )}

                {workItem.status === 'DONE' && (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <p className="text-xs font-bold text-emerald-900">
                      Work completed
                    </p>
                    <div className="flex gap-2 pt-1">
                      <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs">
                        <CheckCircle2 size={14} />
                        <span>✓ Complete</span>
                      </div>
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => setShowSendBackModal(true)}
                          disabled={submitting}
                          className="flex-1 py-2 px-3 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs cursor-pointer transition shadow-2xs"
                        >
                          ↩ Send Back
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {workItem.status === 'TODO' && (
                  <button
                    onClick={() => handleStatusTransition('IN_PROGRESS')}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play size={14} />
                    <span>Start Work</span>
                  </button>
                )}

                {workItem.status === 'IN_PROGRESS' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusTransition('DONE')}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      <span>Complete Work</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUpdateForm(true)}
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Send size={14} />
                      <span>Update Work</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusTransition('BLOCKED')}
                      disabled={submitting}
                      className="px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-bold text-xs cursor-pointer"
                    >
                      Put On Hold
                    </button>
                  </div>
                )}

                  {workItem.status === 'BLOCKED' && (
                  <button
                    onClick={() => handleStatusTransition('IN_PROGRESS')}
                    disabled={submitting}
                    className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white font-bold cursor-pointer"
                  >
                    Resume Work
                  </button>
                )}

                {workItem.status === 'DONE' && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 px-4 text-center font-bold text-xs text-emerald-800 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Completed</span>
                  </div>
                )}
              </>
            )}



            <Link
              to={`/work-items/${workItem.id}`}
              onClick={onClose}
              className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2"
            >
              <Briefcase size={14} className="text-slate-400" />
              <span>Open Full Work Details</span>
              <ExternalLink size={12} />
            </Link>

            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
