import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  FileCode,
  FilePlus2,
  Layers,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getEmployees } from '../features/employees/employee.service'
import { getProjects } from '../features/projects/project.service'
import { getWorkTypes } from '../features/work-types/work-type.service'
import {
  createDailyTarget,
  createDailyTargetWithWorkItem,
} from '../features/daily-targets/daily-target.service'
import { getWorkItems, type WorkItem } from '../features/work-items/work-item.service'
import { getProjectModules } from '../features/project-modules/project-module.service'
import { getProjectMilestones } from '../features/project-milestones/project-milestone.service'
import { getProjectSprints } from '../features/sprints/sprint.service'

type WorkSource = 'EXISTING' | 'NEW' | 'TARGET_ONLY'

type Option = {
  id: string
  name: string
  project_id?: string
}

const TARGET_TYPE_INFO = {
  COUNT: 'How many? (e.g. 5 videos, 3 endpoints, 10 test cases)',
  HOURS: 'How much time? (e.g. 6 hours of focused work)',
  PERCENTAGE: 'How much completion? (e.g. 100% of module spec)',
  MILESTONE: 'Was the milestone achieved? (1 = Achieved)',
  CUSTOM: 'Custom operational measurement',
}

export default function SetDailyTarget() {
  const { accessToken } = useAuth()

  // Work Source state (Step 166 & 167)
  const [workSource, setWorkSource] = useState<WorkSource>('EXISTING')

  const [employees, setEmployees] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [workTypes, setWorkTypes] = useState<any[]>([])
  const [allWorkItems, setAllWorkItems] = useState<WorkItem[]>([])
  const [modules, setModules] = useState<Option[]>([])
  const [milestones, setMilestones] = useState<Option[]>([])
  const [sprints, setSprints] = useState<any[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    work_item_id: '',
    employee_id: '',
    project_id: '',
    module_id: '',
    milestone_id: '',
    sprint_id: '',
    work_type_id: '',

    // New Work Item Fields (Step 169)
    work_title: '',
    work_description: '',
    estimated_hours: '',
    story_points: '',

    // Target Fields
    title: '',
    target_type: 'COUNT' as 'COUNT' | 'HOURS' | 'PERCENTAGE' | 'MILESTONE' | 'CUSTOM',
    target_value: '',
    unit: 'ITEMS',

    deadline_date: new Date().toISOString().slice(0, 10),
    deadline_time: '17:00',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  })

  // Initial load
  useEffect(() => {
    if (!accessToken) return

    async function load() {
      try {
        const [
          employeeData,
          projectData,
          workTypeData,
          workItemData,
        ] = await Promise.all([
          getEmployees(accessToken!),
          getProjects(accessToken!),
          getWorkTypes(accessToken!).catch(() => []),
          getWorkItems(accessToken!).catch(() => []),
        ])

        setEmployees(employeeData || [])
        setProjects(projectData || [])
        setWorkTypes(workTypeData || [])
        setAllWorkItems(workItemData || [])

        // Step 285 — Read URL parameters
        const params = new URLSearchParams(window.location.search)
        const paramEmployeeId = params.get('employeeId')
        const paramProjectId = params.get('projectId')
        const paramWorkItemId = params.get('workItemId')

        if (paramWorkItemId && workItemData) {
          const item = workItemData.find((w: any) => w.id === paramWorkItemId)
          if (item) {
            setWorkSource('EXISTING')
            setForm((prev) => ({
              ...prev,
              work_item_id: item.id,
              employee_id: paramEmployeeId || item.assigned_to || prev.employee_id,
              project_id: item.project_id || paramProjectId || prev.project_id,
              module_id: item.module_id || prev.module_id,
              milestone_id: item.milestone_id || prev.milestone_id,
              sprint_id: (item as any).sprint_id || prev.sprint_id,
              work_type_id: item.work_type_id || prev.work_type_id,
              title: item.title ? `Work on ${item.title}` : prev.title,
            }))
            return
          }
        }

        if (paramEmployeeId || paramProjectId) {
          setForm((prev) => ({
            ...prev,
            employee_id: paramEmployeeId || prev.employee_id,
            project_id: paramProjectId || prev.project_id,
          }))
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load target setup options.',
        )
      }
    }

    load()
  }, [accessToken])

  // Filtered work items for selected project (Step 167)
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === form.project_id)
  }, [projects, form.project_id])

  // Load project child structures (modules, milestones, sprints)
  useEffect(() => {
    setModules([])
    setMilestones([])
    setSprints([])

    if (!form.project_id || !accessToken) return

    async function loadProjectData() {
      try {
        const [modData, msData, sprintData] = await Promise.all([
          getProjectModules(accessToken!, form.project_id).catch(() => []),
          getProjectMilestones(accessToken!, form.project_id).catch(() => []),
          selectedProject?.methodology === 'SCRUM'
            ? getProjectSprints(accessToken!, form.project_id).catch(() => [])
            : Promise.resolve([]),
        ])

        setModules(modData || [])
        setMilestones(msData || [])
        setSprints(sprintData || [])
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load project structure.',
        )
      }
    }

    loadProjectData()
  }, [form.project_id, accessToken, selectedProject?.methodology])

  // Filtered work items for selected project (Step 167)
  const projectWorkItems = useMemo(() => {
    if (!form.project_id) return allWorkItems
    return allWorkItems.filter((w) => w.project_id === form.project_id)
  }, [allWorkItems, form.project_id])

  // Auto-fill when selecting an existing work item (Step 168)
  function handleSelectWorkItem(workItemId: string) {
    const selectedItem = allWorkItems.find((w) => w.id === workItemId)
    if (!selectedItem) {
      setForm((prev) => ({ ...prev, work_item_id: '' }))
      return
    }

    setForm((prev) => ({
      ...prev,
      work_item_id: selectedItem.id,
      title: prev.title || selectedItem.title,
      project_id: selectedItem.project_id || prev.project_id,
      module_id: selectedItem.module_id || prev.module_id,
      milestone_id: selectedItem.milestone_id || prev.milestone_id,
      work_type_id: selectedItem.work_type_id || prev.work_type_id,
      employee_id: selectedItem.assigned_to || prev.employee_id,
      deadline_time: selectedItem.deadline_time || prev.deadline_time,
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!accessToken) return

    if (!form.employee_id) {
      setError('Please select an employee.')
      return
    }

    const tVal = Number(form.target_value)
    if (form.target_value === '' || isNaN(tVal) || tVal < 0) {
      setError('Target value must be zero or greater.')
      return
    }

    // Step 178 — Percentage validation
    if (form.target_type === 'PERCENTAGE' && (tVal < 0 || tVal > 100)) {
      setError('Percentage target must be between 0 and 100.')
      return
    }

    if (!form.deadline_date) {
      setError('Deadline date is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (workSource === 'NEW') {
        // Combined Creation (Project or Standalone)
        if (!form.work_title.trim()) {
          setError('Work title is required.')
          setSaving(false)
          return
        }

        await createDailyTargetWithWorkItem(accessToken, {
          employee_id: form.employee_id,
          project_id: form.project_id || null,
          module_id: form.project_id ? (form.module_id || null) : null,
          milestone_id: form.project_id ? (form.milestone_id || null) : null,
          sprint_id: form.project_id ? (form.sprint_id || null) : null,
          work_type_id: form.work_type_id || null,

          work_title: form.work_title.trim(),
          work_description: form.work_description.trim() || undefined,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
          story_points: form.story_points ? Number(form.story_points) : null,

          target_type: form.target_type,
          target_value: tVal,
          unit: form.unit.trim() || 'ITEMS',

          deadline_date: form.deadline_date,
          deadline_time: form.deadline_time || null,
          priority: form.priority,
        })

        setSuccess('Work item and daily target created successfully!')
      } else {
        // Step 168 (Existing Work Item) & Step 176 (Target Only)
        const finalTitle =
          workSource === 'EXISTING'
            ? form.title.trim() ||
              allWorkItems.find((w) => w.id === form.work_item_id)?.title ||
              'Daily Target'
            : form.title.trim()

        if (!finalTitle) {
          setError('Target title is required.')
          setSaving(false)
          return
        }

        await createDailyTarget(accessToken, {
          employee_id: form.employee_id,
          work_item_id: workSource === 'EXISTING' ? form.work_item_id || null : null,
          project_id: form.project_id || null,
          module_id: form.module_id || null,
          milestone_id: form.milestone_id || null,
          sprint_id: form.sprint_id || null,
          work_type_id: form.work_type_id || null,

          title: finalTitle,
          target_type: form.target_type,
          target_value: tVal,
          unit: form.unit.trim() || 'ITEMS',

          deadline_date: form.deadline_date,
          deadline_time: form.deadline_time || null,
          priority: form.priority,
        })

        setSuccess('Daily target created successfully!')
      }

      // Reset form title/values
      setForm((prev) => ({
        ...prev,
        work_title: '',
        work_description: '',
        title: '',
        target_value: '',
        estimated_hours: '',
        story_points: '',
      }))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create target.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            TARGET ASSIGNMENT
          </span>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Set Daily Target
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign an objective, measurable daily target to an employee with real-time health and carry-forward tracking.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white shadow-sm space-y-8 p-6 md:p-8">

          {/* STEP 166 — WORK SOURCE SELECTOR */}
          <section className="space-y-3 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                1. WORK SOURCE
              </h2>
              <p className="text-xs text-slate-500">
                Choose how this target connects to your workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label
                className={`flex flex-col p-4 rounded-xl border-2 transition cursor-pointer ${
                  workSource === 'EXISTING'
                    ? 'border-[#801424] bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <input
                    type="radio"
                    name="workSource"
                    value="EXISTING"
                    checked={workSource === 'EXISTING'}
                    onChange={() => setWorkSource('EXISTING')}
                    className="text-[#801424] focus:ring-[#801424]"
                  />
                  <span>Existing Work Item</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Target a sub-part of an ongoing work item (e.g. 3 endpoints of Payment API).
                </p>
              </label>

              <label
                className={`flex flex-col p-4 rounded-xl border-2 transition cursor-pointer ${
                  workSource === 'NEW'
                    ? 'border-[#801424] bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <input
                    type="radio"
                    name="workSource"
                    value="NEW"
                    checked={workSource === 'NEW'}
                    onChange={() => setWorkSource('NEW')}
                    className="text-[#801424] focus:ring-[#801424]"
                  />
                  <span>Create New Work Item</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Creates a parent work item & daily target together in one click.
                </p>
              </label>

              <label
                className={`flex flex-col p-4 rounded-xl border-2 transition cursor-pointer ${
                  workSource === 'TARGET_ONLY'
                    ? 'border-[#801424] bg-rose-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <input
                    type="radio"
                    name="workSource"
                    value="TARGET_ONLY"
                    checked={workSource === 'TARGET_ONLY'}
                    onChange={() => setWorkSource('TARGET_ONLY')}
                    className="text-[#801424] focus:ring-[#801424]"
                  />
                  <span>Target Only</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Standalone operational target without a software work item (e.g. 10 customer calls).
                </p>
              </label>
            </div>
          </section>

          {/* STEP 167 & 168 — WORK ITEM & PROJECT CONTEXT */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              2. ASSIGNMENT & CONTEXT
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Employee Selector */}
              <Field label="Assignee (Employee) *">
                <select
                  value={form.employee_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      employee_id: e.target.value,
                    }))
                  }
                  className="input"
                  required
                >
                  <option value="">Select team member</option>
                  {employees
                    .filter((e) => ['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(e.role) || !e.role)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name || ''} {emp.employee_id ? `(${emp.employee_id})` : ''}
                      </option>
                    ))}
                </select>
              </Field>

              {/* Project Selector */}
              <Field label={workSource === 'TARGET_ONLY' ? 'Project (Optional)' : 'Project *'}>
                <select
                  value={form.project_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      project_id: e.target.value,
                      work_item_id: '',
                      module_id: '',
                      milestone_id: '',
                      sprint_id: '',
                    }))
                  }
                  className="input"
                >
                  <option value="">No Project / General Work</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.project_key} — {proj.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Existing Work Item Selector (Step 167 & 168) */}
              {workSource === 'EXISTING' && (
                <div className="md:col-span-2">
                  <Field label="Select Existing Work Item *">
                    <select
                      value={form.work_item_id}
                      onChange={(e) => handleSelectWorkItem(e.target.value)}
                      className="input"
                    >
                      <option value="">-- Choose work item --</option>
                      {projectWorkItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} ({item.status} · {item.projects?.name || 'General'})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {/* Module, Milestone, Sprint (when project selected) */}
              {form.project_id && (
                <>
                  <Field label="Module (Optional)">
                    <select
                      value={form.module_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, module_id: e.target.value }))}
                      className="input"
                    >
                      <option value="">No module</option>
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Milestone (Optional)">
                    <select
                      value={form.milestone_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, milestone_id: e.target.value }))}
                      className="input"
                    >
                      <option value="">No milestone</option>
                      {milestones.map((ms) => (
                        <option key={ms.id} value={ms.id}>
                          {ms.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedProject?.methodology === 'SCRUM' && (
                    <Field label="Sprint (Optional)">
                      <select
                        value={form.sprint_id}
                        onChange={(e) => setForm((prev) => ({ ...prev, sprint_id: e.target.value }))}
                        className="input"
                      >
                        <option value="">No sprint</option>
                        {sprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <Field label="Work Type (Optional)">
                    <select
                      value={form.work_type_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, work_type_id: e.target.value }))}
                      className="input"
                    >
                      <option value="">No specific work type</option>
                      {workTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
          </section>

          {/* STEP 169 — CREATE NEW WORK ITEM DETAILS */}
          {workSource === 'NEW' && (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  NEW WORK ITEM DETAILS
                </h2>
                <p className="text-xs text-slate-500">
                  This work item will be added to the backlog and assigned to the employee.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Work Item Title *">
                    <input
                      type="text"
                      placeholder="e.g. Payment Gateway Integration API"
                      value={form.work_title}
                      onChange={(e) => setForm((prev) => ({ ...prev, work_title: e.target.value }))}
                      className="input"
                      required
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Description">
                    <textarea
                      rows={2}
                      placeholder="Brief details about the work deliverable..."
                      value={form.work_description}
                      onChange={(e) => setForm((prev) => ({ ...prev, work_description: e.target.value }))}
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="Estimated Hours">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 8"
                    value={form.estimated_hours}
                    onChange={(e) => setForm((prev) => ({ ...prev, estimated_hours: e.target.value }))}
                    className="input"
                  />
                </Field>

                <Field label="Story Points">
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                    value={form.story_points}
                    onChange={(e) => setForm((prev) => ({ ...prev, story_points: e.target.value }))}
                    className="input"
                  />
                </Field>
              </div>
            </section>
          )}

          {/* STEP 168, 176, 177, 178 — TARGET SPECIFICATION */}
          <section className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                3. TODAY'S MEASURABLE TARGET
              </h2>
              <p className="text-xs text-slate-500">
                Define the specific quantitative deliverable for today.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Target Title / Focus *">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder={
                      workSource === 'TARGET_ONLY'
                        ? 'e.g. 10 customer sales calls'
                        : 'e.g. 3 endpoints of Payment API'
                    }
                    className="input"
                    required={workSource !== 'NEW'}
                  />
                </Field>
              </div>

              {/* Target Type with Step 177 Explanations */}
              <div>
                <Field label="Target Type">
                  <select
                    value={form.target_type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_type: e.target.value as any,
                        unit:
                          e.target.value === 'HOURS'
                            ? 'hours'
                            : e.target.value === 'PERCENTAGE'
                            ? '%'
                            : prev.unit,
                      }))
                    }
                    className="input"
                  >
                    <option value="COUNT">COUNT (Quantities)</option>
                    <option value="HOURS">HOURS (Focused time)</option>
                    <option value="PERCENTAGE">PERCENTAGE (0–100%)</option>
                    <option value="MILESTONE">MILESTONE (Binary 1 / 0)</option>
                    <option value="CUSTOM">CUSTOM (Custom unit)</option>
                  </select>
                </Field>
                <p className="mt-1 text-[11px] text-slate-400 font-medium italic">
                  {TARGET_TYPE_INFO[form.target_type]}
                </p>
              </div>

              {/* Target Value */}
              <Field label="Target Value *">
                <input
                  type="number"
                  min="0"
                  max={form.target_type === 'PERCENTAGE' ? 100 : undefined}
                  step={form.target_type === 'HOURS' ? '0.25' : '1'}
                  value={form.target_value}
                  onChange={(e) => setForm((prev) => ({ ...prev, target_value: e.target.value }))}
                  placeholder={form.target_type === 'PERCENTAGE' ? '100' : '5'}
                  className="input"
                  required
                />
              </Field>

              {/* Unit */}
              <Field label="Unit of Measurement *">
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="videos / endpoints / calls / test cases"
                  className="input"
                  required
                />
              </Field>

              {/* Priority */}
              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as any }))}
                  className="input"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent (Escalates faster)</option>
                </select>
              </Field>

              {/* Deadline Date */}
              <Field label="Target Date *">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={form.deadline_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, deadline_date: e.target.value }))}
                    className="input pl-10"
                    required
                  />
                </div>
              </Field>

              {/* Deadline Time */}
              <Field label="Deadline Time">
                <input
                  type="time"
                  value={form.deadline_time}
                  onChange={(e) => setForm((prev) => ({ ...prev, deadline_time: e.target.value }))}
                  className="input"
                />
              </Field>
            </div>
          </section>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#801424] px-6 py-3 text-sm font-bold text-white hover:bg-[#9f1239] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Target className="h-4 w-4" />
              {saving
                ? 'Creating Target...'
                : workSource === 'NEW'
                ? 'Create Work + Target'
                : 'Set Daily Target'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
        {label}
      </label>
      {children}
    </div>
  )
}
