import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  User,
  AlertTriangle,
  Send,
  TrendingUp,
  AlertCircle,
  X,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  getWorkItems,
  updateWorkItem,
  getWorkComments,
  addWorkComment,
  getWorkUpdates,
  addWorkUpdate,
  getWorkConcerns,
  addWorkConcern,
  resolveWorkConcern,
  type WorkItem,
} from '../features/work-items/work-item.service'
import type {
  WorkComment,
  WorkUpdate,
  WorkConcern,
} from '../features/work-items/work-communication.service'

export default function WorkItemDetails() {
  const { id: workItemId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { accessToken, profile } = useAuth()

  const [workItem, setWorkItem] = useState<WorkItem | null>(null)
  const [comments, setComments] = useState<WorkComment[]>([])
  const [updates, setUpdates] = useState<WorkUpdate[]>([])
  const [concerns, setConcerns] = useState<WorkConcern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [newComment, setNewComment] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  const [updateText, setUpdateText] = useState('')
  const [progressPercent, setProgressPercent] = useState(50)
  const [updateSubmitting, setUpdateSubmitting] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

  const [concernText, setConcernText] = useState('')
  const [showConcernModal, setShowConcernModal] = useState(false)
  const [concernSubmitting, setConcernSubmitting] = useState(false)

  async function loadAllData() {
    if (!accessToken || !workItemId) return
    setLoading(true)
    setError('')
    try {
      const [allItems, comList, upList, conList] = await Promise.all([
        getWorkItems(accessToken),
        getWorkComments(accessToken, workItemId).catch(() => []),
        getWorkUpdates(accessToken, workItemId).catch(() => []),
        getWorkConcerns(accessToken, workItemId).catch(() => []),
      ])

      const found = allItems.find((w) => w.id === workItemId)
      if (found) {
        setWorkItem(found)
        // Compute last progress if available
        if (upList.length > 0) {
          setProgressPercent(upList[0].progress_percent)
        } else {
          setProgressPercent(found.status === 'DONE' ? 100 : found.status === 'IN_PROGRESS' ? 50 : 0)
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

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !workItemId || !updateText.trim()) return
    setUpdateSubmitting(true)
    try {
      const created = await addWorkUpdate(accessToken, workItemId, {
        update_text: updateText.trim(),
        progress_percent: progressPercent,
      })
      setUpdates((prev) => [created, ...prev])
      setUpdateText('')
      setShowProgressModal(false)

      // Also update status if progress is 100%
      if (progressPercent === 100 && workItem?.status !== 'DONE') {
        const updated = await updateWorkItem(accessToken, workItemId, { status: 'DONE' })
        setWorkItem((prev) => (prev ? { ...prev, ...updated } : prev))
      } else if (progressPercent > 0 && workItem?.status === 'TODO') {
        const updated = await updateWorkItem(accessToken, workItemId, { status: 'IN_PROGRESS' })
        setWorkItem((prev) => (prev ? { ...prev, ...updated } : prev))
      }
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
      const created = await addWorkConcern(accessToken, workItemId, { concern: concernText.trim() })
      setConcerns((prev) => [created, ...prev])
      setConcernText('')
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
      const updated = await updateWorkItem(accessToken, workItemId, { status: newStatus })
      setWorkItem((prev) => (prev ? { ...prev, ...updated } : prev))
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

            <select
              value={workItem.status}
              onChange={(e) => handleStatusChange(e.target.value as WorkItem['status'])}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border outline-none cursor-pointer transition ${
                workItem.status === 'DONE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : workItem.status === 'IN_PROGRESS'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : workItem.status === 'IN_REVIEW'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : workItem.status === 'BLOCKED'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="DONE">DONE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-xs text-slate-600">
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
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Deadline:</span>
            <strong className="text-slate-900">
              {workItem.deadline ? new Date(workItem.deadline).toLocaleDateString() : 'No deadline'}
            </strong>
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
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{latestProgress}%</span>
          </div>

          <button
            onClick={() => setShowProgressModal(true)}
            className="flex items-center gap-2 bg-[#09090b] hover:bg-[#18181b] text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <TrendingUp size={15} />
            Update Progress
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 transition-all duration-500 rounded-full"
            style={{ width: `${latestProgress}%` }}
          />
        </div>
      </div>

      {/* Work Updates Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Updates</h2>

        <div className="space-y-3">
          {updates.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No work updates logged yet.</p>
          ) : (
            updates.map((u) => (
              <div key={u.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {u.employee?.first_name} {u.employee?.last_name || ''}
                  </span>
                  <span className="text-slate-400">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-700">{u.update_text}</p>
                <div className="pt-1 text-[11px] font-mono text-slate-900 font-semibold">
                  Progress: {u.progress_percent}%
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleAddUpdate} className="flex gap-3 pt-2">
          <input
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="Write an update..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-zinc-800"
          />
          <button
            type="submit"
            disabled={updateSubmitting || !updateText.trim()}
            className="px-5 py-2.5 bg-[#09090b] hover:bg-[#18181b] text-white font-semibold text-xs rounded-xl transition disabled:opacity-50"
          >
            Post Update
          </button>
        </form>
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
                    {c.status === 'OPEN' && (profile?.role === 'SUPER_ADMIN' || profile?.role === 'MANAGER') && (
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

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
            <button
              onClick={() => setShowProgressModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Update Progress</h2>
            <p className="text-xs text-slate-500 mb-4">Set your current completion percentage and summary.</p>

            <form onSubmit={handleAddUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Progress Percentage ({progressPercent}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Update Description *</label>
                <textarea
                  required
                  rows={3}
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="What progress did you complete?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-zinc-800 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateSubmitting || !updateText.trim()}
                  className="px-5 py-2 bg-[#801424] hover:bg-[#9f1239] text-white font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  Submit Progress
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
                <label className="block font-medium text-slate-700 mb-1">Describe Blocker *</label>
                <textarea
                  required
                  rows={4}
                  value={concernText}
                  onChange={(e) => setConcernText(e.target.value)}
                  placeholder="Explain the blocker or difficulty..."
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  Submit Concern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
