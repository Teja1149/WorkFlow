import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Flame,
  FolderKanban,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getWorkItems, updateWorkItem, type WorkItem } from '../features/work-items/work-item.service'
import { getEmployees } from '../features/employees/employee.service'
import { getProjects, type Project } from '../features/projects/project.service'
import { getReassignmentRecommendations, type ReassignmentRecommendation } from '../features/work-analytics/work-analytics.service'
import { getTeamDailyTargets } from '../features/daily-targets/daily-target.service'
import HealthBadge from '../components/ui/HealthBadge'

export default function WorkDistribution() {
  const { accessToken, profile } = useAuth()
  const navigate = useNavigate()

  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [teamLoad, setTeamLoad] = useState<ReassignmentRecommendation[]>([])
  const [teamTargets, setTeamTargets] = useState<any>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Operational Filters (Step 287)
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL')
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Slide-Over Drawer State (Step 281 & 290)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null)
  const [isReassignment, setIsReassignment] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('')
  const [assignmentReason, setAssignmentReason] = useState<string>('INITIAL_ASSIGNMENT')
  const [targetStrategy, setTargetStrategy] = useState<'KEEP' | 'CANCEL' | 'CREATE_NEW'>('CREATE_NEW')
  const [savingAssignment, setSavingAssignment] = useState(false)

  // Success Prompt Modal (Step 283)
  const [assignedSuccess, setAssignedSuccess] = useState<{
    item: WorkItem
    employee: any
  } | null>(null)

  async function loadData() {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const [items, empData, projData, loadData, targetsData] = await Promise.all([
        getWorkItems(accessToken).catch(() => []),
        getEmployees(accessToken).catch(() => []),
        getProjects(accessToken).catch(() => []),
        getReassignmentRecommendations(accessToken).catch(() => []),
        getTeamDailyTargets(accessToken).catch(() => null),
      ])

      setWorkItems(items || [])
      setEmployees(empData || [])
      setProjects(projData || [])
      setTeamLoad(loadData || [])
      setTeamTargets(targetsData || null)
    } catch (err: any) {
      setError(err.message || 'Unable to load work distribution.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [accessToken])

  // Active non-done items for calculation (Step 289)
  const activeWorkItems = useMemo(() => {
    return workItems.filter((item) => item.status !== 'DONE')
  }, [workItems])

  const unassignedCount = useMemo(() => {
    return activeWorkItems.filter((item) => !item.assigned_to).length
  }, [activeWorkItems])

  const assignedCount = useMemo(() => {
    return activeWorkItems.filter((item) => !!item.assigned_to).length
  }, [activeWorkItems])

  const overloadedCount = useMemo(() => {
    return teamLoad.filter((l) => l.workload === 'OVERLOADED' || l.utilization > 100).length
  }, [teamLoad])

  const atRiskCount = useMemo(() => {
    return activeWorkItems.filter(
      (item) => item.health === 'RED' || item.health === 'CRITICAL' || item.priority === 'URGENT',
    ).length
  }, [activeWorkItems])

  const coveragePercent = useMemo(() => {
    if (activeWorkItems.length === 0) return 100
    return Math.round((assignedCount / activeWorkItems.length) * 100)
  }, [assignedCount, activeWorkItems.length])

  // Filtered Lists
  const filteredItems = useMemo(() => {
    return activeWorkItems.filter((item) => {
      if (assignmentFilter === 'UNASSIGNED' && item.assigned_to) return false
      if (assignmentFilter === 'ASSIGNED' && !item.assigned_to) return false
      if (selectedEmployeeFilter && item.assigned_to !== selectedEmployeeFilter) return false
      if (selectedProjectId && item.project_id !== selectedProjectId) return false
      if (selectedPriority && item.priority !== selectedPriority) return false
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const title = (item.title || '').toLowerCase()
        const projName = (item.projects?.name || '').toLowerCase()
        if (!title.includes(term) && !projName.includes(term)) return false
      }
      return true
    })
  }, [activeWorkItems, assignmentFilter, selectedEmployeeFilter, selectedProjectId, selectedPriority, searchTerm])

  const unassignedList = useMemo(() => {
    return filteredItems.filter((item) => !item.assigned_to)
  }, [filteredItems])

  const assignedList = useMemo(() => {
    return filteredItems.filter((item) => !!item.assigned_to)
  }, [filteredItems])

  // Open Assignment Drawer
  function openAssignDrawer(item: WorkItem, reassign = false) {
    setActiveItem(item)
    setIsReassignment(reassign)
    setSelectedAssigneeId(item.assigned_to || '')
    setAssignmentReason(reassign ? 'WORKLOAD_BALANCING' : 'INITIAL_ASSIGNMENT')
    setTargetStrategy('CREATE_NEW')
    setDrawerOpen(true)
  }

  // Handle Assignment Submission (Step 281, 282, 290)
  async function handleAssignSubmit() {
    if (!accessToken || !activeItem || !selectedAssigneeId) return
    setSavingAssignment(true)
    setError('')
    try {
      await updateWorkItem(accessToken, activeItem.id, {
        assigned_to: selectedAssigneeId,
      })

      const assignedEmp = employees.find((e) => e.id === selectedAssigneeId)
      const updatedItem = {
        ...activeItem,
        assigned_to: selectedAssigneeId,
        assignee: assignedEmp,
      }

      setWorkItems((prev) =>
        prev.map((item) => (item.id === activeItem.id ? updatedItem : item)),
      )

      setDrawerOpen(false)

      // Trigger Step 283 Prompt
      setAssignedSuccess({
        item: updatedItem,
        employee: assignedEmp,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to complete assignment.')
    } finally {
      setSavingAssignment(false)
    }
  }

  // Calculate live capacity after assignment (Step 282)
  const selectedAssigneeLoad = useMemo(() => {
    if (!selectedAssigneeId) return null
    const rec = teamLoad.find((l) => l.employee?.id === selectedAssigneeId)
    const currentUtil = rec?.utilization || 45
    const addedEffort = Number(activeItem?.estimated_hours || 4)
    // Approximate additional load %
    const addedUtil = Math.round((addedEffort / 8) * 100)
    const projectedUtil = currentUtil + addedUtil
    return {
      currentUtil,
      projectedUtil,
      isExceeded: projectedUtil > 100,
    }
  }, [selectedAssigneeId, teamLoad, activeItem])

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6">
      {/* HEADER (Step 280) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#801424] font-mono">
            OPERATIONAL WORKFLOW
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            WORK DISTRIBUTION
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Manage who is working on what across teams, balance capacity, and dispatch today's targets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/set-daily-target"
            className="inline-flex items-center gap-2 rounded-xl bg-[#801424] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#9f1239] shadow-xs transition cursor-pointer"
          >
            <Target size={14} />
            <span>Set Daily Target</span>
          </Link>

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
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* TOP DISTRIBUTION SUMMARY CARDS (Steps 288 & 289) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          onClick={() => setAssignmentFilter(assignmentFilter === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')}
          className={`rounded-2xl border p-4 text-left transition cursor-pointer ${
            unassignedCount > 0
              ? 'border-rose-300 bg-rose-50/70 hover:bg-rose-100/70'
              : 'border-emerald-200 bg-emerald-50/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase font-mono text-slate-500">Unassigned</span>
            {unassignedCount > 0 ? (
              <span className="text-[9px] font-bold uppercase bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">Action</span>
            ) : (
              <span className="text-[9px] font-bold uppercase bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">Clear</span>
            )}
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{unassignedCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            {unassignedCount > 0 ? `${unassignedCount} items waiting for owner` : '✓ All active work assigned'}
          </p>
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase font-mono text-slate-400">Assigned Work</span>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{assignedCount}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Under active ownership</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase font-mono text-amber-700">Overloaded Members</span>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">{overloadedCount}</p>
          <p className="mt-0.5 text-[11px] text-amber-700 font-medium">&gt;100% capacity utilization</p>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase font-mono text-rose-700">At Risk Work</span>
          <p className="mt-1 text-2xl font-extrabold text-rose-950">{atRiskCount}</p>
          <p className="mt-0.5 text-[11px] text-rose-700 font-medium">Critical or overdue health</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase font-mono text-slate-400">Assignment Coverage</span>
          <p className="mt-1 text-2xl font-extrabold text-[#801424]">{coveragePercent}%</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#801424]"
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* OPERATIONAL FILTERS (Step 287) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search work title, project, or module..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:border-[#801424] text-xs font-medium"
            />
          </div>

          {/* Assignment Scope Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
            <button
              onClick={() => setAssignmentFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                assignmentFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({activeWorkItems.length})
            </button>
            <button
              onClick={() => setAssignmentFilter('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                assignmentFilter === 'UNASSIGNED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Unassigned ({unassignedCount})
            </button>
            <button
              onClick={() => setAssignmentFilter('ASSIGNED')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                assignmentFilter === 'ASSIGNED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Assigned ({assignedCount})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Employee:</span>
            <select
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">All Assignees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name || ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: UNASSIGNED WORK (Step 280) */}
      {(assignmentFilter === 'ALL' || assignmentFilter === 'UNASSIGNED') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-[#801424]" />
              <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 font-mono">
                UNASSIGNED WORK ({unassignedList.length})
              </h2>
            </div>
            {unassignedList.length === 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                ✓ All work items are assigned
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedList.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.priority === 'HIGH' || item.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-800'
                          : item.priority === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.priority || 'MEDIUM'}
                    </span>
                  </div>

                  {/* Hierarchy */}
                  <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-800">{item.projects?.name || 'Project'}</span>
                    {item.project_modules?.name && <span>→ {item.project_modules.name}</span>}
                    {item.project_milestones?.name && <span>→ {item.project_milestones.name}</span>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock size={13} className="text-slate-400" />
                      {item.estimated_hours || 4}h estimated
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/work-items/${item.id}`}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => openAssignDrawer(item, false)}
                    className="px-4 py-2 bg-[#801424] hover:bg-[#9f1239] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <UserPlus size={14} />
                    <span>Assign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: ASSIGNED WORK & LIVE TODAY'S TARGET SNAPSHOT (Steps 280 & 286) */}
      {(assignmentFilter === 'ALL' || assignmentFilter === 'ASSIGNED') && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase size={18} className="text-[#801424]" />
              <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 font-mono">
                ASSIGNED WORK ({assignedList.length})
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assignedList.map((item) => {
              const assignee = item.assignee || employees.find((e) => e.id === item.assigned_to)
              const assigneeLoad = teamLoad.find((l) => l.employee?.id === item.assigned_to)
              const activeTarget = teamTargets?.targets?.find(
                (t: any) => t.work_item_id === item.id || (t.employee_id === item.assigned_to && t.project_id === item.project_id),
              )

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                      <HealthBadge health={item.health || 'GREEN'} />
                    </div>

                    {/* Hierarchy */}
                    <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800">{item.projects?.name || 'Project'}</span>
                      {item.project_modules?.name && <span>→ {item.project_modules.name}</span>}
                    </div>

                    {/* Assignee Box */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-[#801424] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                          {assignee?.first_name?.[0]?.toUpperCase() || 'E'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">
                            {assignee ? `${assignee.first_name} ${assignee.last_name || ''}` : 'Assigned'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {assigneeLoad?.utilization || 50}% load · {assigneeLoad?.workload || 'NORMAL'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* STEP 286 — TODAY'S TARGET SNAPSHOT */}
                    {activeTarget ? (
                      <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-[#801424] font-mono flex items-center gap-1">
                            <Target size={12} />
                            Today's Target
                          </span>
                          <span className="font-bold text-slate-900 text-[11px]">
                            {activeTarget.actual_value || 0}/{activeTarget.target_value} {activeTarget.unit || 'units'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">{activeTarget.achievement}% achieved</span>
                          <span className="font-bold text-rose-900 uppercase text-[10px]">
                            {activeTarget.status}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-2 text-[11px] text-slate-400 italic">
                        No target set for today yet.
                      </div>
                    )}
                  </div>

                  {/* Actions (Step 280) */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openAssignDrawer(item, true)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      Reassign
                    </button>

                    <Link
                      to={`/set-daily-target?employeeId=${encodeURIComponent(
                        item.assigned_to || '',
                      )}&projectId=${encodeURIComponent(
                        item.project_id || '',
                      )}&workItemId=${encodeURIComponent(item.id)}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Target size={13} />
                      <span>Set Today's Target</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* SLIDE-OVER ASSIGNMENT DRAWER (Steps 281, 282, 290, 291) */}
      {drawerOpen && activeItem && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slideInRight">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#801424] font-mono">
                      {isReassignment ? 'REASSIGN WORK' : 'ASSIGN WORK'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{activeItem.title}</h3>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Work Item Context */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{activeItem.projects?.name || 'Project'}</span>
                    <span>{activeItem.estimated_hours || 4}h effort</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {activeItem.project_modules?.name && <span>Module: {activeItem.project_modules.name} · </span>}
                    {activeItem.project_milestones?.name && <span>Milestone: {activeItem.project_milestones.name}</span>}
                  </div>
                </div>

                {/* STEP 282 — Assignee Selector with Live Capacity Feedback */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500 font-mono">
                    Assign To Team Member:
                  </label>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {employees
                      .filter((emp) =>
                        profile?.role === 'MANAGER'
                          ? emp.role === 'EMPLOYEE'
                          : emp.role === 'EMPLOYEE' || emp.role === 'MANAGER',
                      )
                      .map((emp) => {
                      const isSelected = selectedAssigneeId === emp.id
                      const loadRec = teamLoad.find((l) => l.employee?.id === emp.id)
                      const util = loadRec?.utilization || 50
                      const workload = loadRec?.workload || 'AVAILABLE'

                      return (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedAssigneeId(emp.id)}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-rose-50/80 border-[#801424] ring-2 ring-[#801424]/20'
                              : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-[#801424] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                              {emp.first_name?.[0]?.toUpperCase() || 'E'}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs">
                                {emp.first_name} {emp.last_name || ''}
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                {emp.role || 'Member'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`rounded px-2 py-0.5 font-bold uppercase text-[9px] ${
                                util > 100
                                  ? 'bg-rose-100 text-rose-800'
                                  : util > 75
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {util}% ({workload})
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* LIVE WORKLOAD FEEDBACK (Step 282) */}
                {selectedAssigneeLoad && (
                  <div
                    className={`rounded-xl p-3.5 border text-xs space-y-1.5 ${
                      selectedAssigneeLoad.isExceeded
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>Current Load: {selectedAssigneeLoad.currentUtil}%</span>
                      <span>After Assignment: {selectedAssigneeLoad.projectedUtil}%</span>
                    </div>

                    {selectedAssigneeLoad.isExceeded && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800 pt-1">
                        <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                        <span>Warning: This assignment exceeds this member's normal capacity.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Assignment Reason (Step 290) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Reason for Assignment</label>
                  <select
                    value={assignmentReason}
                    onChange={(e) => setAssignmentReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                  >
                    <option value="INITIAL_ASSIGNMENT">Initial Assignment</option>
                    <option value="WORKLOAD_BALANCING">Workload Balancing</option>
                    <option value="SKILL_MATCH">Specialized Skill Match</option>
                    <option value="EMERGENCY_REALLOCATION">Emergency Reallocation</option>
                  </select>
                </div>

                {/* STEP 291 — Active Target Handling for Reassignment */}
                {isReassignment && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                    <span className="font-bold text-slate-800 block">Active Daily Target Handling</span>
                    <div className="space-y-1.5 text-[11px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="targetStrat"
                          checked={targetStrategy === 'CREATE_NEW'}
                          onChange={() => setTargetStrategy('CREATE_NEW')}
                        />
                        <span>Create new target for new assignee</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="targetStrat"
                          checked={targetStrategy === 'KEEP'}
                          onChange={() => setTargetStrategy('KEEP')}
                        />
                        <span>Keep previous member's completed work record</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Actions */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleAssignSubmit}
                  disabled={!selectedAssigneeId || savingAssignment}
                  className="px-5 py-2 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold transition shadow-xs disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                >
                  <UserCheck size={14} />
                  <span>{savingAssignment ? 'Saving...' : isReassignment ? 'Reassign Work' : 'Assign Work'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POST-ASSIGNMENT ACTION MODAL (Steps 283 & 285) */}
      {assignedSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  ✓ {assignedSuccess.item.title} assigned to {assignedSuccess.employee?.first_name}!
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  What would you like to do next?
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  navigate(
                    `/set-daily-target?employeeId=${encodeURIComponent(
                      assignedSuccess.item.assigned_to || '',
                    )}&projectId=${encodeURIComponent(
                      assignedSuccess.item.project_id || '',
                    )}&workItemId=${encodeURIComponent(assignedSuccess.item.id)}`,
                  )
                }}
                className="w-full py-2.5 rounded-xl bg-[#801424] hover:bg-[#9f1239] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Target size={15} />
                <span>Set Today's Target</span>
              </button>

              <button
                onClick={() => setAssignedSuccess(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Continue Distributing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
