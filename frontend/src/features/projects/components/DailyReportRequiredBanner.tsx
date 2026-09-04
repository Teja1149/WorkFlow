import React, { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Send,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import {
  getMyPendingDailyReports,
  type PendingDailyReportItem,
} from '../project-daily-report.service'
import ProjectDailyReportSubmissionModal from './ProjectDailyReportSubmissionModal'

interface Props {
  accessToken: string
  onReportSubmitted?: () => void
}

export default function DailyReportRequiredBanner({
  accessToken,
  onReportSubmitted,
}: Props) {
  const [items, setItems] = useState<PendingDailyReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSubmissionProject, setActiveSubmissionProject] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    loadPending()
  }, [accessToken])

  async function loadPending() {
    if (!accessToken) return
    try {
      const data = await getMyPendingDailyReports(accessToken)
      setItems(data || [])
    } catch (err) {
      console.error('Failed to load pending daily reports:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || items.length === 0) return null

  const missingCount = items.filter((i) => !i.is_submitted).length

  return (
    <>
      <div
        className={`rounded-2xl border p-5 shadow-xs transition duration-200 ${
          missingCount > 0
            ? 'border-amber-300 bg-linear-to-r from-amber-50 via-rose-50/40 to-amber-50/60'
            : 'border-emerald-200 bg-emerald-50/40'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl text-white ${
                missingCount > 0 ? 'bg-amber-600 shadow-xs' : 'bg-emerald-600'
              }`}
            >
              {missingCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>{missingCount > 0 ? '⚠ DAILY REPORT REQUIRED' : '✓ DAILY REPORTS COMPLETE'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                  {items.length - missingCount} / {items.length} Submitted
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {missingCount > 0
                  ? `You have ${missingCount} pending project daily report(s) required for today.`
                  : 'All assigned project daily reports for today have been submitted. Great work!'}
              </p>
            </div>
          </div>
        </div>

        {/* Project Reports Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3.5">
          {items.map((item) => (
            <div
              key={item.project_id}
              className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                item.is_submitted
                  ? 'border-emerald-200 bg-white text-emerald-900 shadow-2xs'
                  : 'border-amber-200/90 bg-white hover:border-amber-400 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    {item.project_key || 'PROJECT'}
                  </span>
                  {item.is_submitted ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      <span>Submitted</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                      <AlertTriangle size={11} />
                      <span>Missing</span>
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-xs mt-1 truncate">
                  {item.project_name}
                </h4>
              </div>

              {!item.is_submitted ? (
                <button
                  type="button"
                  onClick={() =>
                    setActiveSubmissionProject({
                      id: item.project_id,
                      name: item.project_name,
                    })
                  }
                  className="w-full py-2 px-3 rounded-lg bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Send size={12} />
                  <span>Submit Report</span>
                </button>
              ) : (
                <div className="text-[11px] font-medium text-emerald-700 font-mono">
                  ✓ Recorded on {item.report_date}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submission Modal */}
      {activeSubmissionProject && (
        <ProjectDailyReportSubmissionModal
          isOpen={!!activeSubmissionProject}
          onClose={() => setActiveSubmissionProject(null)}
          projectId={activeSubmissionProject.id}
          projectName={activeSubmissionProject.name}
          accessToken={accessToken}
          onSubmitted={() => {
            loadPending()
            setActiveSubmissionProject(null)
            if (onReportSubmitted) onReportSubmitted()
          }}
        />
      )}
    </>
  )
}
