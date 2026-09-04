import React, { useEffect, useState } from 'react'
import {
  FileText,
  Calendar,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  User,
  Plus,
  Settings,
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import {
  getProjectDailyReportsSummary,
  getProjectDailyReportsHistory,
  getProjectReportTemplate,
  exportDailyReportsCsv,
  type ProjectDailyReportsSummary,
  type ProjectDailyReportSubmission,
  type ProjectReportTemplate,
  type MemberReportStatus,
} from '../project-daily-report.service'
import ProjectDailyReportSubmissionModal from './ProjectDailyReportSubmissionModal'
import ProjectDailyReportTemplateBuilder from './ProjectDailyReportTemplateBuilder'

interface Props {
  projectId: string
  projectName: string
  accessToken: string
  currentUserId?: string
  canManageTeam: boolean
}

export default function ProjectDailyReportsTab({
  projectId,
  projectName,
  accessToken,
  currentUserId,
  canManageTeam,
}: Props) {
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10))
  const [summary, setSummary] = useState<ProjectDailyReportsSummary | null>(null)
  const [submissions, setSubmissions] = useState<ProjectDailyReportSubmission[]>([])
  const [template, setTemplate] = useState<ProjectReportTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ProjectDailyReportSubmission | null>(null)
  const [selectedMemberStatus, setSelectedMemberStatus] = useState<MemberReportStatus | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [projectId, accessToken, reportDate])

  async function loadData() {
    if (!accessToken || !projectId) return
    setLoading(true)
    try {
      const [sum, history, tmpl] = await Promise.all([
        getProjectDailyReportsSummary(accessToken, projectId, reportDate).catch(() => null),
        getProjectDailyReportsHistory(accessToken, projectId, { from: reportDate, to: reportDate }).catch(() => []),
        getProjectReportTemplate(accessToken, projectId).catch(() => null),
      ])

      setSummary(sum)
      setSubmissions(history || [])
      setTemplate(tmpl)
    } catch (err) {
      console.error('Failed to load project daily reports:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleExportCsv() {
    if (!summary || submissions.length === 0) {
      alert('No daily report submissions available to export for this date.')
      return
    }
    exportDailyReportsCsv(projectName, summary, submissions)
  }

  // Check if current user has already submitted today
  const currentUserSubmission = submissions.find((s) => s.employee_id === currentUserId)

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono flex items-center gap-1.5">
                <FileText size={14} />
                DAILY REPORTING & COMPLIANCE
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Project Daily Reports
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live submissions, missing alerts, and field-level reporting audits for {projectName}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <Calendar size={14} className="text-[#801424]" />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="bg-transparent outline-none font-bold text-slate-800"
              />
            </div>

            {/* Submit My Report Button */}
            {!currentUserSubmission ? (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Submit My Report</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 size={14} />
                <span>Report Submitted ✓</span>
              </span>
            )}

            {/* Export CSV/Excel */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            {/* Template Builder Toggle */}
            {canManageTeam && (
              <button
                type="button"
                onClick={() => setShowTemplateBuilder(!showTemplateBuilder)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  showTemplateBuilder
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings size={14} />
                <span>{showTemplateBuilder ? 'Close Template' : 'Configure Template'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Template Builder Collapsible Pane */}
        {showTemplateBuilder && (
          <div className="pt-2 border-t border-slate-100 animate-in fade-in duration-150">
            <ProjectDailyReportTemplateBuilder
              projectId={projectId}
              accessToken={accessToken}
              onSaved={() => {
                loadData()
                setShowTemplateBuilder(false)
              }}
            />
          </div>
        )}

        {/* Top Mini Compliance KPIs */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                Required Reports
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">{summary.total_required}</p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-700 font-mono">
                Submitted
              </span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{summary.total_submitted}</p>
            </div>

            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-700 font-mono">
                Missing
              </span>
              <p className="text-2xl font-black text-rose-900 mt-1">{summary.total_missing}</p>
            </div>

            <div className="rounded-xl border border-[#801424]/20 bg-rose-50/40 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-[#801424] font-mono">
                Compliance Rate
              </span>
              <p className="text-2xl font-black text-[#801424] mt-1">
                {summary.compliance_rate}%
              </p>
            </div>
          </div>
        )}

        {/* Member Compliance Roster */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              Team Member Status ({summary?.members.length || 0})
            </h3>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 outline-none w-48"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading daily reports...</div>
          ) : !summary || summary.members.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No assigned team members found for this project.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.members
                .filter((m: MemberReportStatus) =>
                  searchQuery ? m.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) : true,
                )
                .map((member: MemberReportStatus) => {
                  const isSubmitted = member.status === 'SUBMITTED'
                  const matchingSub = submissions.find((s) => s.employee_id === member.employee_id)

                  return (
                    <div
                      key={member.employee_id}
                      className="py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {member.employee_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">{member.employee_name}</h4>
                          <span className="text-[11px] text-slate-400">
                            {member.role || 'Team Member'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isSubmitted ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle size={13} />
                            <span>
                              Submitted{' '}
                              {member.submitted_at
                                ? new Date(member.submitted_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 flex items-center gap-1.5">
                            <AlertTriangle size={13} />
                            <span>Missing Report</span>
                          </span>
                        )}

                        {(matchingSub || (member.answers && member.answers.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (matchingSub) {
                                setSelectedReport(matchingSub)
                              } else {
                                setSelectedMemberStatus(member)
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                            title="View Report Details"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Submission Modal */}
      {showSubmitModal && (
        <ProjectDailyReportSubmissionModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          projectId={projectId}
          projectName={projectName}
          accessToken={accessToken}
          onSubmitted={() => {
            loadData()
            setShowSubmitModal(false)
          }}
        />
      )}

      {/* View Submitted Report Details Modal */}
      {(selectedReport || selectedMemberStatus) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#801424] flex items-center justify-center text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                    SUBMITTED DAILY REPORT
                  </span>
                  <h3 className="text-base font-black text-white">
                    {selectedReport?.employee
                      ? `${selectedReport.employee.first_name} ${selectedReport.employee.last_name || ''}`.trim()
                      : selectedMemberStatus?.employee_name || 'Team Member'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedReport(null)
                  setSelectedMemberStatus(null)
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block">Date:</span>
                  <span className="font-bold text-slate-800">
                    {selectedReport?.report_date || reportDate}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-bold block">Submitted At:</span>
                  <span className="font-bold text-slate-800">
                    {selectedReport?.submitted_at
                      ? new Date(selectedReport.submitted_at).toLocaleString()
                      : selectedMemberStatus?.submitted_at
                      ? new Date(selectedMemberStatus.submitted_at).toLocaleString()
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Display fields & answers */}
              <div className="space-y-3">
                {selectedReport?.answers && selectedReport.answers.length > 0 ? (
                  selectedReport.answers.map((a) => {
                    let displayVal = a.value !== undefined && a.value !== null && a.value !== '' ? String(a.value) : '—'
                    if (a.field_type === 'BOOLEAN') {
                      displayVal = a.value === true ? 'Yes' : 'No'
                    }

                    return (
                      <div
                        key={a.field_id}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">{a.label}</span>
                          {a.counts_toward_performance && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                              Performance
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 whitespace-pre-wrap">{displayVal}</p>
                      </div>
                    )
                  })
                ) : selectedMemberStatus?.answers && selectedMemberStatus.answers.length > 0 ? (
                  selectedMemberStatus.answers.map((a) => {
                    let displayVal = a.value !== undefined && a.value !== null && a.value !== '' ? String(a.value) : '—'
                    if (a.field_type === 'BOOLEAN') {
                      displayVal = a.value === true ? 'Yes' : 'No'
                    }

                    return (
                      <div
                        key={a.field_id}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">{a.label}</span>
                          {a.counts_toward_performance && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold border border-indigo-200">
                              Performance
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 whitespace-pre-wrap">{displayVal}</p>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic">No field details recorded.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedReport(null)
                  setSelectedMemberStatus(null)
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
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
