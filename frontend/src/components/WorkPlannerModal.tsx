import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Sparkles,
  Calendar,
  Users,
  Target,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Zap,
  Plus,
  Trash2,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import {
  createProjectTarget,
  generateDailyTargetsFromProject,
  getTeamCapacityPreview,
  type TeamCapacityItem,
  type ProjectTargetPeriod,
  type ProjectTargetType,
} from '../features/project-targets/project-target.service'
import { getWorkTypes } from '../features/work-types/work-type.service'
import { getProjects, type Project } from '../features/projects/project.service'
import { getEmployees } from '../features/employees/employee.service'
import {
  splitQuantity,
  validateAllocation,
} from '../features/work-items/work-allocation.service'

type WorkType = any
type Employee = any

export interface WorkPlannerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  defaultProjectId?: string
}

export default function WorkPlannerModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
}: WorkPlannerModalProps) {
  const { accessToken } = useAuth()

  // Data sources
  const [projects, setProjects] = useState<Project[]>([])
  const [workTypes, setWorkTypes] = useState<WorkType[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [capacityList, setCapacityList] = useState<TeamCapacityItem[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [targetName, setTargetName] = useState('')
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState('')
  const [targetType, setTargetType] = useState<ProjectTargetType>('COUNT')
  const [unit, setUnit] = useState('Items')
  const [targetValue, setTargetValue] = useState<number | ''>(10)
  const [period, setPeriod] = useState<ProjectTargetPeriod>('MONTHLY')

  // Allocation Method & Tracking Mode
  const [allocationMethod, setAllocationMethod] = useState<'EQUAL' | 'MANUAL' | 'INDIVIDUAL'>('EQUAL')
  const [trackingMode, setTrackingMode] = useState<'COMBINED' | 'SEPARATE'>('COMBINED')

  // Date ranges
  const todayIso = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(todayIso)
  const endOfMonthIso = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10)
  const [deadlineDate, setDeadlineDate] = useState(endOfMonthIso)

  // Distribution mode
  const [distributionMode, setDistributionMode] = useState<
    'EVEN_DAILY' | 'MILESTONE_BASED' | 'CUSTOM'
  >('EVEN_DAILY')

  // Employee allocations: map of employeeId -> { selected: boolean, monthly: number, daily: number, deadline: string }
  const [allocations, setAllocations] = useState<
    Record<
      string,
      {
        selected: boolean
        monthly: number
        daily: number
        deadline: string
      }
    >
  >({})

  // Milestones
  const [milestones, setMilestones] = useState<
    Array<{ name: string; target_value: number; deadline: string }>
  >([
    { name: 'Batch 1', target_value: 3, deadline: endOfMonthIso },
    { name: 'Batch 2', target_value: 3, deadline: endOfMonthIso },
    { name: 'Batch 3', target_value: 4, deadline: endOfMonthIso },
  ])

  // Daily Report dynamic fields
  const [reportFields, setReportFields] = useState<
    Array<{
      label: string
      type: 'number' | 'paragraph' | 'text' | 'boolean'
      counts_toward_target: boolean
      required: boolean
    }>
  >([
    { label: 'Completed Output', type: 'number', counts_toward_target: true, required: true },
    { label: 'Deliverables Finished', type: 'text', counts_toward_target: false, required: false },
    { label: 'Revisions', type: 'number', counts_toward_target: false, required: false },
    { label: 'Blocker', type: 'paragraph', counts_toward_target: false, required: false },
    { label: 'Comments', type: 'paragraph', counts_toward_target: false, required: false },
  ])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<'number' | 'paragraph' | 'text' | 'boolean'>(
    'number',
  )
  const [newFieldCounts, setNewFieldCounts] = useState(false)

  // Load prerequisites
  useEffect(() => {
    if (!isOpen || !accessToken) return

    async function loadData() {
      setLoadingData(true)
      setError('')
      try {
        const [projRes, wtRes, empRes, capRes] = await Promise.all([
          getProjects(accessToken!),
          getWorkTypes(accessToken!),
          getEmployees(accessToken!),
          getTeamCapacityPreview(accessToken!).catch(() => []),
        ])

        setProjects(projRes || [])
        setWorkTypes(wtRes || [])
        setEmployees(empRes || [])
        setCapacityList(capRes || [])

        if (defaultProjectId) {
          setProjectId(defaultProjectId)
        } else if (projRes && projRes.length > 0) {
          setProjectId(projRes[0].id)
        }

        // Initialize default employee selections
        if (empRes && empRes.length > 0) {
          const initialAllocs: typeof allocations = {}
          empRes.slice(0, 4).forEach((emp, idx) => {
            const defaultMonthly = idx === 0 ? 5 : idx === 1 ? 3 : idx === 2 ? 2 : 0
            initialAllocs[emp.id] = {
              selected: defaultMonthly > 0,
              monthly: defaultMonthly,
              daily: defaultMonthly > 0 ? Math.max(1, Math.ceil(defaultMonthly / 20)) : 1,
              deadline: endOfMonthIso,
            }
          })
          setAllocations(initialAllocs)
        }

        // Select first work type by default if available
        if (wtRes && wtRes.length > 0) {
          const first = wtRes[0]
          setSelectedWorkTypeId(first.id)
          setTargetName(`${first.name} Delivery`)
          if (first.unit) setUnit(first.unit)
          if (first.default_target) setTargetValue(first.default_target)
          if (first.measurement) {
            if (first.measurement === 'STORY_POINTS') setTargetType('POINTS')
            else if (first.measurement === 'HOURS') setTargetType('HOURS')
            else if (first.measurement === 'PERCENTAGE') setTargetType('PERCENTAGE')
            else setTargetType('COUNT')
          }
          if (first.report_fields && first.report_fields.length > 0) {
            setReportFields(
              first.report_fields.map((rf: any) => ({
                label: rf.label,
                type: rf.type || 'number',
                counts_toward_target: Boolean(rf.counts_toward_target),
                required: Boolean(rf.required),
              })),
            )
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load planner data.')
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [isOpen, accessToken, defaultProjectId])

  // Handle Work Type change & auto-inheritance
  function handleSelectWorkType(wtId: string) {
    setSelectedWorkTypeId(wtId)
    const found = workTypes.find((w) => w.id === wtId)
    if (found) {
      setTargetName(`${found.name} Delivery`)
      if (found.unit) setUnit(found.unit)
      if (found.default_target) setTargetValue(found.default_target)
      if (found.measurement) {
        if (found.measurement === 'STORY_POINTS') setTargetType('POINTS')
        else if (found.measurement === 'HOURS') setTargetType('HOURS')
        else if (found.measurement === 'PERCENTAGE') setTargetType('PERCENTAGE')
        else setTargetType('COUNT')
      }
      if (found.report_fields && found.report_fields.length > 0) {
        setReportFields(
          found.report_fields.map((rf: any) => ({
            label: rf.label,
            type: rf.type || 'number',
            counts_toward_target: Boolean(rf.counts_toward_target),
            required: Boolean(rf.required),
          })),
        )
      }
    }
  }

  // Active work type details
  const activeWorkType = useMemo(
    () => workTypes.find((w) => w.id === selectedWorkTypeId),
    [workTypes, selectedWorkTypeId],
  )

  // Total allocated vs total target
  const totalAllocated = useMemo(() => {
    return Object.entries(allocations).reduce((sum, [_, alloc]) => {
      return alloc.selected ? sum + (Number(alloc.monthly) || 0) : sum
    }, 0)
  }, [allocations])

  const targetNum = Number(targetValue) || 0
  const allocationRemaining = targetNum - totalAllocated

  // Working days count between start and deadline
  const daysDiff = useMemo(() => {
    const s = new Date(startDate).getTime()
    const d = new Date(deadlineDate).getTime()
    return Math.max(1, Math.ceil((d - s) / (1000 * 60 * 60 * 24)))
  }, [startDate, deadlineDate])

  // Add a milestone
  function handleAddMilestone() {
    setMilestones((prev) => [
      ...prev,
      {
        name: `Batch ${prev.length + 1}`,
        target_value: 3,
        deadline: deadlineDate,
      },
    ])
  }

  // Remove milestone
  function handleRemoveMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index))
  }

  // Apply Equal Split
  function applyEqualSplit(employeeList?: string[]) {
    const selectedIds =
      employeeList ||
      Object.entries(allocations)
        .filter(([_, a]) => a.selected)
        .map(([id]) => id)

    const activeIds =
      selectedIds.length > 0
        ? selectedIds
        : employees.slice(0, Math.min(3, employees.length)).map((e) => e.id)

    if (!activeIds.length) return

    const splits = splitQuantity(targetNum, activeIds)
    const updatedAllocs = { ...allocations }

    employees.forEach((emp) => {
      const s = splits.find((item) => item.employeeId === emp.id)
      if (s) {
        const dailyPace = Math.max(1, Math.ceil(s.quantity / Math.max(1, Math.min(20, daysDiff))))
        updatedAllocs[emp.id] = {
          selected: true,
          monthly: s.quantity,
          daily: dailyPace,
          deadline: deadlineDate,
        }
      } else if (selectedIds.length > 0 && !selectedIds.includes(emp.id)) {
        updatedAllocs[emp.id] = {
          selected: false,
          monthly: 0,
          daily: 0,
          deadline: deadlineDate,
        }
      }
    })
    setAllocations(updatedAllocs)
  }

  // Toggle employee selection
  function handleToggleEmployee(empId: string) {
    setAllocations((prev) => {
      const existing = prev[empId] || {
        selected: false,
        monthly: 2,
        daily: 1,
        deadline: deadlineDate,
      }
      const newSelected = !existing.selected
      return {
        ...prev,
        [empId]: {
          ...existing,
          selected: newSelected,
          monthly: newSelected ? existing.monthly || 2 : 0,
        },
      }
    })
  }

  // Change employee monthly value & auto-calc daily pace
  function handleEmployeeMonthlyChange(empId: string, val: number) {
    const dailyPace = Math.max(1, Math.ceil(val / Math.max(1, Math.min(20, daysDiff))))
    setAllocations((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { selected: true, deadline: deadlineDate }),
        selected: val > 0,
        monthly: val,
        daily: dailyPace,
      },
    }))
  }

  // Change individual daily pace override
  function handleEmployeeDailyChange(empId: string, val: number) {
    setAllocations((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { selected: true, monthly: 1, deadline: deadlineDate }),
        daily: val,
      },
    }))
  }

  // Add dynamic report field
  function handleAddReportField() {
    if (!newFieldLabel.trim()) return
    setReportFields((prev) => [
      ...prev,
      {
        label: newFieldLabel.trim(),
        type: newFieldType,
        counts_toward_target: newFieldCounts,
        required: false,
      },
    ])
    setNewFieldLabel('')
    setNewFieldCounts(false)
  }

  // Remove report field
  function handleRemoveReportField(index: number) {
    setReportFields((prev) => prev.filter((_, i) => i !== index))
  }

  // ONE-CLICK SAVE & ASSIGN WORK
  async function handleSaveAndAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !projectId || !targetName) return

    setSaving(true)
    setError('')

    try {
      // Build selected allocations
      const selectedAllocs = Object.entries(allocations)
        .filter(([_, a]) => a.selected && a.monthly > 0)
        .map(([empId, a]) => ({
          employee_id: empId,
          allocated_value: Number(a.monthly) || 0,
        }))

      if (selectedAllocs.length > 0) {
        const valRes = validateAllocation(Number(targetValue) || 0, selectedAllocs)
        if (!valRes.isValid) {
          setError(valRes.message)
          setSaving(false)
          return
        }
      }

      // Build target payload
      const payload = {
        project_id: projectId,
        name: targetName.trim(),
        target_type: targetType,
        unit: unit.trim(),
        target_value: Number(targetValue) || 0,
        period_type: period,
        period_start: startDate,
        period_end: deadlineDate,
        deadline_date: deadlineDate,
        tracking_mode:
          trackingMode === 'SEPARATE' || allocationMethod === 'INDIVIDUAL'
            ? 'SEPARATE'
            : 'COMBINED',
        schedule_mode:
          distributionMode === 'EVEN_DAILY'
            ? 'AUTOMATIC_DAILY'
            : distributionMode === 'MILESTONE_BASED'
            ? 'MILESTONE'
            : 'MANUAL',
        work_type_id: selectedWorkTypeId || undefined,
        allocations: selectedAllocs,
        milestones:
          distributionMode === 'MILESTONE_BASED'
            ? milestones.map((m, idx) => ({
                name: m.name.trim(),
                target_value: Number(m.target_value) || 0,
                deadline: m.deadline || deadlineDate,
                order_index: idx,
              }))
            : undefined,
      }

      await createProjectTarget(accessToken, payload as any)

      // Auto-generate daily targets for today
      try {
        await generateDailyTargetsFromProject(accessToken, projectId)
      } catch (dtErr) {
        console.warn('Daily target auto-generation notice:', dtErr)
      }

      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save and assign work plan.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedProjectObj = projects.find((p) => p.id === projectId)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#801424] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                Work Planner
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                PROJECT WORK PLANNER
              </h2>
            </div>
            <p className="text-xs text-slate-300 font-semibold mt-0.5">
              {selectedProjectObj ? selectedProjectObj.name : 'Select Project'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSaveAndAssign} className="overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: TARGET CONFIGURATION */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Project *
                </label>
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#801424]"
                >
                  <option value="">Select Project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Work Type *
                </label>
                <select
                  value={selectedWorkTypeId}
                  onChange={(e) => handleSelectWorkType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#801424]"
                >
                  <option value="">Select Work Type...</option>
                  {workTypes.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name} ({wt.unit || 'units'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target & Unit *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value ? Number(e.target.value) : '')}
                    placeholder="10"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none focus:border-[#801424]"
                  />
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Videos"
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-[#801424]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as ProjectTargetPeriod)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#801424]"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="DAILY">Daily</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deadline Date *
                </label>
                <input
                  type="date"
                  required
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#801424]"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SECTION 2: ASSIGN PEOPLE & ALLOCATION METHOD */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                  <Users size={14} className="text-[#801424]" />
                  ASSIGN PEOPLE & ALLOCATION METHOD
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Choose how the project deliverable is allocated across team members.
                </p>
              </div>

              <div
                className={`px-3 py-1 rounded-full font-mono font-bold text-xs border self-start ${
                  allocationRemaining === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : allocationRemaining > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                Allocation: {totalAllocated} / {targetNum} {unit}
                {allocationRemaining > 0 && ` (${allocationRemaining} unallocated)`}
                {allocationRemaining < 0 && ` (${Math.abs(allocationRemaining)} over target)`}
              </div>
            </div>

            {/* Allocation Method Radio Group */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="radio"
                    name="allocMethod"
                    value="EQUAL"
                    checked={allocationMethod === 'EQUAL'}
                    onChange={() => {
                      setAllocationMethod('EQUAL')
                      applyEqualSplit()
                    }}
                    className="accent-[#801424]"
                  />
                  <span>Automatic Equal Split</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="radio"
                    name="allocMethod"
                    value="MANUAL"
                    checked={allocationMethod === 'MANUAL'}
                    onChange={() => setAllocationMethod('MANUAL')}
                    className="accent-[#801424]"
                  />
                  <span>Manual Allocation</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="radio"
                    name="allocMethod"
                    value="INDIVIDUAL"
                    checked={allocationMethod === 'INDIVIDUAL'}
                    onChange={() => {
                      setAllocationMethod('INDIVIDUAL')
                      setTrackingMode('SEPARATE')
                    }}
                    className="accent-[#801424]"
                  />
                  <span>Individual Work Items</span>
                </label>
              </div>

              {allocationMethod === 'EQUAL' && (
                <button
                  type="button"
                  onClick={() => applyEqualSplit()}
                  className="px-3 py-1 rounded-lg bg-[#801424] text-white text-xs font-bold hover:bg-[#9f1239] cursor-pointer"
                >
                  ⚡ Auto-Split Evenly
                </button>
              )}
            </div>

            {/* People Assignment Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-4 font-bold">Assign</th>
                    <th className="py-2.5 px-4 font-bold">Employee</th>
                    <th className="py-2.5 px-4 font-bold">Workload</th>
                    <th className="py-2.5 px-4 font-bold">Target ({unit})</th>
                    <th className="py-2.5 px-4 font-bold">Daily Pace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {employees.map((emp) => {
                    const alloc = allocations[emp.id] || {
                      selected: false,
                      monthly: 0,
                      daily: 0,
                      deadline: deadlineDate,
                    }
                    const isSelected = alloc.selected
                    const empName =
                      emp.display_name ||
                      `${emp.first_name || ''} ${emp.last_name || ''}`.trim() ||
                      emp.email
                    const cap = capacityList.find((c) => c.employee_id === emp.id)
                    const curWorkload = cap?.current_workload ?? 0
                    const isOverloaded = curWorkload > (cap?.daily_capacity ?? 8)

                    return (
                      <tr
                        key={emp.id}
                        className={`transition ${
                          isSelected ? 'bg-slate-50/60' : 'hover:bg-slate-50/30'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleEmployee(emp.id)}
                            className="accent-[#801424] h-4 w-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{empName}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOverloaded
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {curWorkload} active {isOverloaded ? '⚠ High' : '✓ OK'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              disabled={!isSelected}
                              value={alloc.monthly}
                              onChange={(e) =>
                                handleEmployeeMonthlyChange(emp.id, Number(e.target.value))
                              }
                              className={`w-20 rounded-lg border px-2 py-1 text-xs font-bold outline-none ${
                                isSelected
                                  ? 'border-slate-300 bg-white text-slate-900 focus:border-[#801424]'
                                  : 'border-slate-100 bg-slate-100 text-slate-400'
                              }`}
                            />
                            <span className="text-[11px] text-slate-400">{unit}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              disabled={!isSelected}
                              value={alloc.daily}
                              onChange={(e) =>
                                handleEmployeeDailyChange(emp.id, Number(e.target.value))
                              }
                              className={`w-16 rounded-lg border px-2 py-1 text-xs font-mono font-bold outline-none ${
                                isSelected
                                  ? 'border-slate-300 bg-white text-slate-900 focus:border-[#801424]'
                                  : 'border-slate-100 bg-slate-100 text-slate-400'
                              }`}
                            />
                            <span className="text-[11px] text-slate-400 font-mono">/day</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SECTION 3: DISTRIBUTION & SCHEDULE PREVIEW */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              DISTRIBUTION
            </h3>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="radio"
                  name="distMode"
                  value="EVEN_DAILY"
                  checked={distributionMode === 'EVEN_DAILY'}
                  onChange={() => setDistributionMode('EVEN_DAILY')}
                  className="accent-[#801424]"
                />
                <span>● Automatically distribute</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="radio"
                  name="distMode"
                  value="MILESTONE_BASED"
                  checked={distributionMode === 'MILESTONE_BASED'}
                  onChange={() => setDistributionMode('MILESTONE_BASED')}
                  className="accent-[#801424]"
                />
                <span>○ Milestone based</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 text-xs">
                <input
                  type="radio"
                  name="distMode"
                  value="CUSTOM"
                  checked={distributionMode === 'CUSTOM'}
                  onChange={() => setDistributionMode('CUSTOM')}
                  className="accent-[#801424]"
                />
                <span>○ Custom</span>
              </label>
            </div>

            {/* Calculated Schedule Preview */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px]">
                  Calculated Schedule Preview:
                </span>
                <span className="font-mono text-xs font-bold text-slate-900">
                  {targetNum} {unit} / {daysDiff} working days ≈{' '}
                  {(targetNum / Math.max(1, daysDiff)).toFixed(1)}/day
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                  <div
                    key={day}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-center shadow-2xs min-w-13.5"
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">
                      {day}
                    </span>
                    <span className="text-xs font-black text-slate-800">
                      {Math.max(1, Math.ceil(targetNum / Math.max(1, daysDiff)))}
                    </span>
                  </div>
                ))}
                <span className="text-[11px] text-slate-400 font-mono italic ml-2">
                  ... system generates daily targets automatically
                </span>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SECTION 4: MILESTONES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <Layers size={14} className="text-[#801424]" />
                MILESTONES
              </h3>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>+ Add Milestone</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs relative"
                >
                  <div className="flex items-center justify-between">
                    <input
                      value={m.name}
                      onChange={(e) => {
                        const updated = [...milestones]
                        updated[idx].name = e.target.value
                        setMilestones(updated)
                      }}
                      className="font-bold text-slate-900 border-b border-transparent focus:border-[#801424] outline-none text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={m.target_value}
                      onChange={(e) => {
                        const updated = [...milestones]
                        updated[idx].target_value = Number(e.target.value) || 0
                        setMilestones(updated)
                      }}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold outline-none"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">{unit}</span>
                  </div>

                  <input
                    type="date"
                    value={m.deadline}
                    onChange={(e) => {
                      const updated = [...milestones]
                      updated[idx].deadline = e.target.value
                      setMilestones(updated)
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SECTION 5: DAILY REPORT TEMPLATE FIELDS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <FileText size={14} className="text-[#801424]" />
                DAILY REPORT
              </h3>
              <span className="text-[11px] text-slate-400">
                Only fields with "Target" checked calculate project completion
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-4 font-bold">Field Name</th>
                    <th className="py-2.5 px-4 font-bold">Type</th>
                    <th className="py-2.5 px-4 font-bold text-center">Target Counting</th>
                    <th className="py-2.5 px-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {reportFields.map((field, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{field.label}</td>
                      <td className="py-2.5 px-4 text-slate-600 capitalize">
                        {field.type === 'paragraph' ? 'Long Text' : field.type}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={field.counts_toward_target}
                          onChange={(e) => {
                            const updated = [...reportFields]
                            updated[idx] = {
                              ...updated[idx],
                              counts_toward_target: e.target.checked,
                            }
                            setReportFields(updated)
                          }}
                          className="accent-[#801424] h-4 w-4 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveReportField(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inline Add Field */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50/80 border border-slate-200 rounded-xl">
              <input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g. Test Cases, Pull Requests"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none flex-1 min-w-37.5"
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none font-semibold"
              >
                <option value="number">Number</option>
                <option value="paragraph">Long Text</option>
                <option value="text">Short Text</option>
                <option value="boolean">Yes / No</option>
              </select>
              <label className="flex items-center gap-1 cursor-pointer text-slate-700 text-xs font-semibold px-2">
                <input
                  type="checkbox"
                  checked={newFieldCounts}
                  onChange={(e) => setNewFieldCounts(e.target.checked)}
                  className="accent-[#801424] rounded"
                />
                <span>Target</span>
              </label>
              <button
                type="button"
                onClick={handleAddReportField}
                className="px-3 py-1.5 rounded-lg bg-[#801424] text-white font-bold text-xs hover:bg-[#9f1239] cursor-pointer"
              >
                + Add Field
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* SECTION 6: WORKLOAD PREVIEW */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#801424]" />
              WORKLOAD PREVIEW
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(allocations)
                .filter(([_, a]) => a.selected && a.monthly > 0)
                .map(([empId, a]) => {
                  const emp = employees.find((e) => e.id === empId)
                  const name =
                    emp?.display_name ||
                    `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() ||
                    'Worker'
                  const cap = capacityList.find((c) => c.employee_id === empId)
                  const curWorkload = cap?.current_workload ?? 2
                  const newWorkload = a.daily || 1
                  const totalWorkload = curWorkload + newWorkload
                  const dailyCap = cap?.daily_capacity ?? 8
                  const isOverloaded = totalWorkload > dailyCap

                  return (
                    <div
                      key={empId}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900 font-bold">{name}</strong>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            isOverloaded
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isOverloaded ? '🔴 OVERLOADED' : '🟢 AVAILABLE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100 font-medium">
                        <span>Current: <strong className="text-slate-800">{curWorkload}/day</strong></span>
                        <span>New: <strong className="text-[#801424]">+{newWorkload}/day</strong></span>
                        <span>Total: <strong className="text-slate-900">{totalWorkload}/day</strong></span>
                        <span>Capacity: <strong className="text-slate-600">{dailyCap}/day</strong></span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <ShieldCheck size={15} className="text-emerald-600" />
              <span>
                1 Click generates Target, Allocations, Milestones, and Employee Daily Targets.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !projectId || !targetName}
                className="rounded-xl bg-[#801424] hover:bg-[#9f1239] px-7 py-2.5 text-xs font-black text-white shadow-md cursor-pointer disabled:opacity-50 transition flex items-center gap-2"
              >
                <Zap size={14} />
                <span>{saving ? 'Saving & Generating...' : 'SAVE & ASSIGN WORK'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
