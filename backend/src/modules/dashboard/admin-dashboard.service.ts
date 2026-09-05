import { supabaseAdmin } from '../../lib/supabase.js'
import { DateTime } from 'luxon'

export async function getAdminDashboard(organizationId: string) {
  const today = DateTime.now().setZone('Asia/Kolkata').toISODate()!
  const currentTime = DateTime.now().setZone('Asia/Kolkata')

  // 1. Fetch all projects
  const { data: projects, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_key, status, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (pErr) throw new Error(pErr.message)

  // 2. Fetch all employees & managers
  const { data: users, error: uErr } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email')
    .eq('organization_id', organizationId)

  if (uErr) throw new Error(uErr.message)

  // 3. Fetch all active work items
  const { data: workItems, error: wErr } = await supabaseAdmin
    .from('work_items')
    .select(`
      id,
      title,
      status,
      priority,
      deadline,
      deadline_time,
      health,
      completed_at,
      updated_at,
      carry_forward_count,
      project_id,
      assigned_to,
      created_at,
      projects ( id, name, project_key )
    `)
    .eq('organization_id', organizationId)
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')
    .order('created_at', { ascending: false })

  if (wErr) throw new Error(wErr.message)

  // 4. Fetch daily work targets for today
  const { data: dailyTargets, error: dtErr } = await supabaseAdmin
    .from('daily_work_targets')
    .select(`
      id,
      title,
      target_value,
      actual_value,
      unit,
      status,
      health,
      deadline_date,
      deadline_time,
      carry_forward_value,
      carried_forward_from,
      carry_forward_count,
      employee_id,
      project_id,
      created_at
    `)
    .eq('organization_id', organizationId)
    .eq('deadline_date', today)
    .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')

  if (dtErr) console.warn('Daily targets query notice:', dtErr)

  // 5. Fetch project targets
  const { data: projectTargets, error: ptErr } = await supabaseAdmin
    .from('project_targets')
    .select('id, project_id, name, target_value, completed_value, actual_value, unit, health, status')
    .eq('organization_id', organizationId)

  if (ptErr) console.warn('Project targets query notice:', ptErr)

  const items = (workItems || []).filter((w) => w.title !== 'PROJECT_DAILY_REPORT_TEMPLATE')
  const targets = (dailyTargets || []).filter((t) => t.title !== 'PROJECT_DAILY_REPORT_TEMPLATE')
  const allProjects = projects || []
  const allUsers = users || []

  // Active projects (not COMPLETED or CANCELLED)
  const activeProjects = allProjects.filter(
    (p) => !['COMPLETED', 'CANCELLED'].includes(p.status),
  )

  // Metrics computation — 100% strict database counts
  const activeProjectsCount = activeProjects.length
  const worksAssignedCount = items.filter((w) => w.assigned_to && w.status !== 'DONE').length
  const inProgressCount = items.filter((w) =>
    ['IN_PROGRESS', 'DEVELOPMENT', 'IN_REVIEW'].includes(w.status),
  ).length
  const completedTodayCount = items.filter(
    (w) =>
      w.status === 'DONE' &&
      ((w.completed_at && w.completed_at.slice(0, 10) === today) ||
        (w.updated_at && w.updated_at.slice(0, 10) === today)),
  ).length

  const overdueItems = items.filter((w) => {
    if (w.status === 'DONE') return false
    if (!w.deadline) return false
    return w.deadline.slice(0, 10) < today || w.health === 'RED' || w.health === 'CRITICAL'
  })

  const overdueCount = overdueItems.length

  const carriedTargets = targets.filter(
    (t) =>
      Boolean(t.carried_forward_from) ||
      t.status === 'CARRIED_FORWARD' ||
      (t.carry_forward_count && t.carry_forward_count > 0),
  )

  const carryForwardCount = carriedTargets.length

  const dueTodayItems = items.filter((w) => {
    if (w.status === 'DONE') return false
    if (!w.deadline) return false
    return w.deadline.slice(0, 10) === today
  })

  const dueTodayCount = dueTodayItems.length

  const atRiskItems = items.filter(
    (w) =>
      w.status !== 'DONE' &&
      ['RED', 'CRITICAL', 'AMBER', 'ORANGE'].includes(w.health),
  )

  const atRiskCount = atRiskItems.length

  // Pulse Calculation
  const pendingCount = Math.max(
    0,
    worksAssignedCount - (completedTodayCount + inProgressCount + overdueCount),
  )
  const pulsePercentage =
    worksAssignedCount > 0
      ? Math.min(100, Math.round((completedTodayCount / worksAssignedCount) * 100))
      : 0

  // User map for lookup
  const userMap = new Map<string, string>()
  allUsers.forEach((u) => {
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    userMap.set(u.id, fullName)
  })

  // Overdue Work list
  const overdueWork = overdueItems.slice(0, 10).map((w) => {
    const empName = userMap.get(w.assigned_to || '') || 'Unassigned'
    const projName = (w.projects as any)?.name || 'No Project'
    return {
      id: w.id,
      employeeName: empName,
      workTitle: w.title,
      projectName: projName,
      pendingCount: '1 item pending',
      deadlineText: w.deadline ? `Due: ${w.deadline.slice(0, 10)}` : 'Due: Today',
      isCritical: w.health === 'CRITICAL' || w.health === 'RED',
    }
  })

  // Carried Forward list
  const carriedForwardWork = carriedTargets.slice(0, 10).map((t) => {
    const empName = userMap.get(t.employee_id || '') || 'Team Member'
    const days = t.carry_forward_count || 1
    return {
      id: t.id,
      employeeName: empName,
      projectName: 'Daily Target',
      workTitle: t.title,
      remaining: Math.max(0, (t.target_value || 0) - (t.actual_value || 0)),
      days,
      isCritical: days >= 3,
    }
  })

  // Project Health List (Strictly from real database work items)
  const projectHealth = activeProjects.map((p) => {
    const pWork = items.filter((w) => w.project_id === p.id)
    const total = pWork.length
    const done = pWork.filter((w) => w.status === 'DONE').length
    const pendingVal = Math.max(0, total - done)
    const achievement = total > 0 ? Math.round((done / total) * 100) : 0
    const health =
      achievement >= 70
        ? 'GREEN'
        : achievement >= 40
        ? 'AMBER'
        : total === 0
        ? 'GREEN'
        : 'RED'

    return {
      id: p.id,
      name: p.name,
      targetFormatted: `${total} tasks`,
      done,
      pending: pendingVal,
      achievement,
      health: health as 'GREEN' | 'AMBER' | 'RED',
    }
  })

  // Team Workload List (Strictly from real database records)
  const teamWorkload = allUsers.map((u) => {
    const uWork = items.filter((w) => w.assigned_to === u.id)
    const assigned = uWork.length
    const done = uWork.filter(
      (w) =>
        w.status === 'DONE' &&
        ((w.completed_at && w.completed_at.slice(0, 10) === today) ||
          (w.updated_at && w.updated_at.slice(0, 10) === today)),
    ).length
    const pending = uWork.filter((w) => w.status !== 'DONE').length

    let load: 'GREEN' | 'AMBER' | 'RED' = 'GREEN'
    if (pending >= 10) load = 'RED'
    else if (pending >= 5) load = 'AMBER'

    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    return {
      id: u.id,
      name: u.role === 'MANAGER' ? `${name} (Manager)` : name,
      assigned,
      done,
      pending,
      load,
    }
  })

  // Live Activity feed from actual work_updates
  const workItemIds = items.map((w) => w.id)
  const { data: realUpdates } = workItemIds.length > 0
    ? await supabaseAdmin
        .from('work_updates')
        .select(`
          id,
          work_item_id,
          employee_id,
          update_text,
          created_at,
          employee:profiles!work_updates_employee_id_fkey(first_name, last_name, email),
          work_item:work_items!work_updates_work_item_id_fkey(title, project_id, projects(name))
        `)
        .in('work_item_id', workItemIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  const liveActivity = (realUpdates || []).map((u: any) => ({
    id: u.id,
    time: DateTime.fromISO(u.created_at).setZone('Asia/Kolkata').toFormat('HH:mm'),
    text: `${u.employee ? `${u.employee.first_name || ''} ${u.employee.last_name || ''}`.trim() || u.employee.email : 'Team Member'}: ${u.update_text || 'Updated work'}`,
    projectName: u.work_item?.projects?.name || 'Project',
  }))

  return {
    metrics: {
      activeProjects: activeProjectsCount,
      worksAssigned: worksAssignedCount,
      inProgress: inProgressCount,
      completedToday: completedTodayCount,
      overdue: overdueCount,
      carryForward: carryForwardCount,
      dueToday: dueTodayCount,
      atRisk: atRiskCount,
    },
    pulse: {
      assigned: worksAssignedCount,
      completed: completedTodayCount,
      inProgress: inProgressCount,
      overdue: overdueCount,
      pending: pendingCount,
      percentage: pulsePercentage,
    },
    overdueWork,
    carriedForwardWork,
    projectHealth,
    teamWorkload,
    liveActivity,
    serverTime: currentTime.toISO(),
  }
}

export async function getEmployeeCapacity(
  organizationId: string,
) {
  const now = new Date()

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )

  const { data: employees, error: employeeError } =
    await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        employee_id,
        role
      `)
      .eq('organization_id', organizationId)

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  const { data: capacityRows, error: capacityError } =
    await supabaseAdmin
      .from('employee_work_capacity')
      .select(`
        employee_id,
        daily_capacity_hours
      `)
      .eq('organization_id', organizationId)

  if (capacityError) {
    throw new Error(capacityError.message)
  }

  const { data: workItems, error: workError } =
    await supabaseAdmin
      .from('work_items')
      .select(`
        id,
        title,
        assigned_to,
        project_id,
        status,
        priority,
        estimated_hours,
        progress_percent,
        health,
        deadline,
        deadline_time,
        start_date,
        projects:project_id (
          id,
          name
        )
      `)
      .eq('organization_id', organizationId)
      .neq('status', 'DONE')
      .neq('title', 'PROJECT_DAILY_REPORT_TEMPLATE')

  if (workError) {
    throw new Error(workError.message)
  }

  const capacityMap = new Map(
    (capacityRows || []).map((row) => [
      row.employee_id,
      row,
    ]),
  )

  function getFallbackHours(priority?: string | null) {
    switch (
      String(priority || 'MEDIUM').toUpperCase()
    ) {
      case 'CRITICAL':
        return 6

      case 'URGENT':
        return 4

      case 'HIGH':
        return 3

      case 'LOW':
        return 1

      case 'MEDIUM':
      default:
        return 2
    }
  }

  function getDeadlineDate(
    item: any,
  ): Date | null {
    if (!item.deadline) {
      return null
    }

    const time =
      item.deadline_time || '23:59:59'

    const date = new Date(
      `${item.deadline}T${time}`,
    )

    return Number.isNaN(date.getTime())
      ? null
      : date
  }

  function getRemainingWorkDays(
    deadline: Date | null,
  ) {
    if (!deadline) {
      // Work without a deadline should not create
      // an artificial overload spike.
      return 5
    }

    const deadlineDay = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
    )

    const difference =
      deadlineDay.getTime() -
      today.getTime()

    const days =
      Math.ceil(
        difference / (1000 * 60 * 60 * 24),
      ) + 1

    return Math.max(1, days)
  }

  function getRemainingHours(item: any) {
    const estimate =
      Number(item.estimated_hours || 0) > 0
        ? Number(item.estimated_hours)
        : getFallbackHours(item.priority)

    const progress = Math.max(
      0,
      Math.min(
        100,
        Number(item.progress_percent || 0),
      ),
    )

    return (
      estimate *
      Math.max(0, 1 - progress / 100)
    )
  }

  return (employees || [])
    .filter(
      (employee) =>
        ['EMPLOYEE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(employee.role),
    )
    .map((employee) => {
      const capacity =
        capacityMap.get(employee.id)

      const dailyCapacity =
        Math.max(
          1,
          Number(
            capacity?.daily_capacity_hours ?? 8,
          ),
        )

      const assigned =
        (workItems || []).filter(
          (item) =>
            item.assigned_to === employee.id,
        )

      let estimatedRemainingHours = 0

      let requiredDailyHours = 0

      let overdueCount = 0

      let criticalCount = 0

      let blockedCount = 0

      let dueTodayCount = 0

      let dueWithin48HoursCount = 0

      const projectMap = new Map<
        string,
        string
      >()

      const assignedItems = assigned.map(
        (item) => {
          const remainingHours =
            getRemainingHours(item)

          const deadline =
            getDeadlineDate(item)

          const remainingDays =
            getRemainingWorkDays(deadline)

          const dailyRequiredHours =
            remainingHours / remainingDays

          estimatedRemainingHours +=
            remainingHours

          requiredDailyHours +=
            dailyRequiredHours

          const deadlineTimestamp =
            deadline?.getTime() || null

          const nowTimestamp =
            now.getTime()

          if (
            deadlineTimestamp &&
            deadlineTimestamp < nowTimestamp
          ) {
            overdueCount += 1
          }

          if (
            item.health === 'CRITICAL' ||
            item.priority === 'CRITICAL'
          ) {
            criticalCount += 1
          }

          if (item.status === 'BLOCKED') {
            blockedCount += 1
          }

          if (deadlineTimestamp) {
            const hoursUntilDeadline =
              (deadlineTimestamp -
                nowTimestamp) /
              (1000 * 60 * 60)

            if (
              hoursUntilDeadline >= 0 &&
              hoursUntilDeadline <= 24
            ) {
              dueTodayCount += 1
            }

            if (
              hoursUntilDeadline >= 0 &&
              hoursUntilDeadline <= 48
            ) {
              dueWithin48HoursCount += 1
            }
          }

          if (item.project_id) {
            const projectName =
              (item.projects as any)?.name ||
              'Project'

            projectMap.set(
              item.project_id,
              projectName,
            )
          }

          return {
            id: item.id,
            title: item.title,

            projectId:
              item.project_id || null,

            projectName:
              (item.projects as any)?.name ||
              null,

            priority:
              item.priority || 'MEDIUM',

            status: item.status,

            deadline: item.deadline || null,

            deadlineTime:
              item.deadline_time || null,

            progressPercent:
              Number(
                item.progress_percent || 0,
              ),

            remainingHours:
              Number(
                remainingHours.toFixed(2),
              ),

            remainingDays,

            requiredDailyHours:
              Number(
                dailyRequiredHours.toFixed(2),
              ),

            health: item.health || null,
          }
        },
      )

      /*
       * This is the important calculation.
       *
       * Example:
       *
       * 16 remaining hours
       * 8 days until deadline
       *
       * Required daily workload = 2 hours/day
       *
       * This is much more accurate than treating
       * all 16 hours as today's workload.
       */
      const utilizationPercent =
        Math.round(
          (requiredDailyHours /
            dailyCapacity) *
            100,
        )

      let workloadStatus:
        | 'AVAILABLE'
        | 'NORMAL'
        | 'HIGH'
        | 'OVERLOADED'

      if (
        utilizationPercent <= 50 &&
        overdueCount === 0 &&
        criticalCount === 0
      ) {
        workloadStatus = 'AVAILABLE'
      } else if (
        utilizationPercent <= 85 &&
        overdueCount === 0
      ) {
        workloadStatus = 'NORMAL'
      } else if (
        utilizationPercent <= 100
      ) {
        workloadStatus = 'HIGH'
      } else {
        workloadStatus = 'OVERLOADED'
      }

      /*
       * Immediate attention should also influence
       * the workload status.
       */
      if (
        overdueCount >= 2 ||
        requiredDailyHours >
          dailyCapacity * 1.25
      ) {
        workloadStatus = 'OVERLOADED'
      }

      const availableDailyHours =
        Math.max(
          0,
          dailyCapacity -
            requiredDailyHours,
        )

      return {
        employee: {
          id: employee.id,
          first_name:
            employee.first_name,
          last_name:
            employee.last_name,
          employee_id:
            employee.employee_id,
        },

        dailyCapacityHours:
          dailyCapacity,

        assignedWork:
          assigned.length,

        activeProjectCount:
          projectMap.size,

        activeProjects:
          Array.from(
            projectMap.entries(),
          ).map(
            ([id, name]) => ({
              id,
              name,
            }),
          ),

        estimatedRemainingHours:
          Number(
            estimatedRemainingHours.toFixed(2),
          ),

        requiredDailyHours:
          Number(
            requiredDailyHours.toFixed(2),
          ),

        availableDailyHours:
          Number(
            availableDailyHours.toFixed(2),
          ),

        utilizationPercent,

        workloadStatus,

        assignmentRisk:
          workloadStatus === 'OVERLOADED'
            ? 'DO_NOT_ASSIGN'
            : workloadStatus === 'HIGH'
              ? 'ASSIGN_WITH_CAUTION'
              : 'SAFE_TO_ASSIGN',

        overdueCount,

        criticalCount,

        blockedCount,

        dueTodayCount,

        dueWithin48HoursCount,

        assignedItems,
      }
    })
}
