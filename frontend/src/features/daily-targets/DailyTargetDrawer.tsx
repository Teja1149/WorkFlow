import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  FolderKanban,
  Target,
  User,
  X,
} from 'lucide-react'
import type { DailyTarget } from './daily-target.types'
import {
  formatTargetValue,
  targetAchievement,
  targetRemaining,
  resultReasonLabel,
} from './daily-target.ui'
import HealthBadge from '../../components/ui/HealthBadge'
import DynamicDailyReportModal from '../../components/DynamicDailyReportModal'
import { useState } from 'react'

interface Props {
  target: DailyTarget | null
  isOpen: boolean
  onClose: () => void
  onUpdateResult?: (target: DailyTarget) => void
}

export default function DailyTargetDrawer({
  target,
  isOpen,
  onClose,
  onUpdateResult,
}: Props) {
  const [showReportModal, setShowReportModal] = useState(false)

  if (!isOpen || !target) return null

  const achievement = targetAchievement(target.target_value, target.actual_value)
  const remaining = targetRemaining(target.target_value, target.actual_value)
  const completed = target.status === 'COMPLETED'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slideInRight">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#801424] font-mono">
                  DAILY TARGET
                </span>
                <h3 className="text-lg font-bold text-slate-900">{target.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Output Commitment Card */}
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#801424] font-mono uppercase">
                  Today's Expected Output
                </span>
                <HealthBadge health={target.health || 'GREEN'} />
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-black text-slate-900">
                    {formatTargetValue(target.actual_value, target.unit)}
                    <span className="mx-1.5 text-slate-300 font-normal">/</span>
                    {formatTargetValue(target.target_value, target.unit)}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {remaining > 0 ? `${remaining} ${target.unit || 'units'} remaining` : 'Target Completed'}
                  </p>
                </div>

                <span className="text-2xl font-black text-[#801424]">
                  {achievement}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#801424]"
                  style={{ width: `${achievement}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Deadline: {target.deadline_time || 'End of day'}</span>
                <span className="font-bold text-slate-800 uppercase text-[10px]">
                  {target.status}
                </span>
              </div>
            </div>

            {/* Deliverable Context Hierarchy */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">
                Deliverable Hierarchy
              </span>

              <div className="flex items-center gap-2 text-slate-700">
                <FolderKanban size={14} className="text-[#801424] shrink-0" />
                <span className="font-medium text-slate-400">Project:</span>
                <strong className="text-slate-900">{target.projects?.name || 'General Workspace'}</strong>
              </div>

              {target.project_modules?.name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-3.5" />
                  <span className="font-medium text-slate-400">Module:</span>
                  <strong className="text-slate-900">{target.project_modules.name}</strong>
                </div>
              )}

              {target.project_milestones?.name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-3.5" />
                  <span className="font-medium text-slate-400">Milestone:</span>
                  <strong className="text-slate-900">{target.project_milestones.name}</strong>
                </div>
              )}

              {target.sprints?.name && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Flame size={14} className="text-orange-600 shrink-0" />
                  <span className="font-medium text-slate-400">Sprint:</span>
                  <strong className="text-slate-900">{target.sprints.name}</strong>
                </div>
              )}

              {target.employee && (
                <div className="flex items-center gap-2 text-slate-700 pt-1 border-t border-slate-100">
                  <User size={14} className="text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-400">Owner:</span>
                  <strong className="text-slate-900">
                    {target.employee.first_name} {target.employee.last_name || ''}
                  </strong>
                </div>
              )}
            </div>

            {/* Result & Audit Record */}
            {(target.result_reason || target.result_note) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 font-mono block">
                  Latest Result Audit
                </span>

                {target.result_reason && (
                  <div>
                    <span className="font-medium text-slate-500">Reason for Shortfall / Delay:</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {resultReasonLabel(target.result_reason)}
                    </p>
                  </div>
                )}

                {target.result_note && (
                  <div>
                    <span className="font-medium text-slate-500">Notes:</span>
                    <p className="text-slate-700 italic mt-0.5">
                      "{target.result_note}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-2.5">
            {!completed && (
              <button
                onClick={() => setShowReportModal(true)}
                className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition"
              >
                <Target size={14} />
                <span>Submit Daily Report</span>
              </button>
            )}

            {target.work_item_id && (
              <Link
                to={`/work-items/${target.work_item_id}`}
                onClick={onClose}
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Briefcase size={14} className="text-slate-400" />
                <span>View Underlying Work Item</span>
                <ExternalLink size={12} />
              </Link>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Close
            </button>
          </div>

          <DynamicDailyReportModal
            isOpen={showReportModal}
            target={target}
            onClose={() => setShowReportModal(false)}
            onSaved={() => {
              onClose()
              if (onUpdateResult) onUpdateResult(target)
            }}
          />
        </div>
      </div>
    </div>
  )
}
