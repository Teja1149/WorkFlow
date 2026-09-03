-- STEP 21: Project Members Table
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    user_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    assigned_by uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    UNIQUE (
        project_id,
        user_id
    )
);

ALTER TABLE public.project_members
ENABLE ROW LEVEL SECURITY;

-- STEP 23: Work Items Table
CREATE TABLE IF NOT EXISTS public.work_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    work_type_id uuid
        REFERENCES public.work_types(id)
        ON DELETE SET NULL,

    module_id uuid
        REFERENCES public.project_modules(id)
        ON DELETE SET NULL,

    milestone_id uuid
        REFERENCES public.project_milestones(id)
        ON DELETE SET NULL,

    assigned_to uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_by uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    title text NOT NULL,
    description text,
    priority text NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status text NOT NULL DEFAULT 'TODO',     -- TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED

    start_date date,
    deadline date,
    deadline_time time,

    original_deadline date,
    carried_forward_from date,
    carry_forward_count integer NOT NULL DEFAULT 0,

    health text NOT NULL DEFAULT 'GREEN',
    escalation_level integer NOT NULL DEFAULT 0,

    estimated_hours numeric DEFAULT 0,
    actual_hours numeric DEFAULT 0,

    last_carried_forward_at timestamptz,
    last_health_notification text,
    last_health_notification_at timestamptz,

    completed_at timestamptz,

    recurring_template_id uuid,
    recurring_work_date date,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_recurring_daily_unique
ON public.work_items(
  recurring_template_id,
  assigned_to,
  recurring_work_date
)
WHERE recurring_template_id IS NOT NULL;

ALTER TABLE public.work_items
ENABLE ROW LEVEL SECURITY;

-- STEP 37: Work Comments Table
CREATE TABLE IF NOT EXISTS public.work_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id uuid REFERENCES public.work_comments(id) ON DELETE SET NULL,
    comment text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_comments ENABLE ROW LEVEL SECURITY;

-- STEP 38: Work Updates Table
CREATE TABLE IF NOT EXISTS public.work_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    update_text text NOT NULL,
    progress_percent integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_updates ENABLE ROW LEVEL SECURITY;

-- STEP 39: Work Concerns Table
CREATE TABLE IF NOT EXISTS public.work_concerns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    concern text NOT NULL,
    priority text NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    status text NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED
    resolution_note text,
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_concerns ENABLE ROW LEVEL SECURITY;

-- STEP 41: Work Activity Table
CREATE TABLE IF NOT EXISTS public.work_activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    description text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_activity ENABLE ROW LEVEL SECURITY;

-- STEP 45: Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    type text NOT NULL, -- WORK_ASSIGNED, UPDATE_SUBMITTED, CONCERN_REPORTED, STATUS_CHANGED, etc.
    title text NOT NULL,
    message text NOT NULL,

    work_item_id uuid
        REFERENCES public.work_items(id)
        ON DELETE CASCADE,

    project_id uuid
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
ENABLE ROW LEVEL SECURITY;

-- STEP 50: Work Types Table
CREATE TABLE IF NOT EXISTS public.work_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    name text NOT NULL,
    description text,
    icon text,
    color text,
    is_active boolean NOT NULL DEFAULT true,

    created_by uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_types
ENABLE ROW LEVEL SECURITY;

-- STEP 51: Project Modules Table
CREATE TABLE IF NOT EXISTS public.project_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    work_type_id uuid
        REFERENCES public.work_types(id)
        ON DELETE SET NULL,

    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,

    created_by uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (project_id, name)
);

ALTER TABLE public.project_modules
ENABLE ROW LEVEL SECURITY;

-- Organization Work Settings Table
CREATE TABLE IF NOT EXISTS public.organization_work_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  workday_start text NOT NULL DEFAULT '09:00',
  workday_end text NOT NULL DEFAULT '18:00',
  working_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  carry_forward_time text NOT NULL DEFAULT '18:00',
  warning_minutes integer NOT NULL DEFAULT 120,
  at_risk_minutes integer NOT NULL DEFAULT 60,
  critical_carry_forward_count integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_work_settings
ENABLE ROW LEVEL SECURITY;

-- Work Item Dependencies Table
CREATE TABLE IF NOT EXISTS public.work_item_dependencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    depends_on_work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    dependency_type text NOT NULL DEFAULT 'BLOCKS',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (work_item_id, depends_on_work_item_id)
);

ALTER TABLE public.work_item_dependencies
ENABLE ROW LEVEL SECURITY;

-- STEP 120: Project Milestones Table
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'PLANNED', -- PLANNED, IN_PROGRESS, COMPLETED, CANCELLED, AT_RISK, OVERDUE
    deadline date,
    progress_percent integer NOT NULL DEFAULT 0,

    created_by uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (project_id, name)
);

ALTER TABLE public.project_milestones
ENABLE ROW LEVEL SECURITY;

-- Employee Work Capacity Table
CREATE TABLE IF NOT EXISTS public.employee_work_capacity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    daily_capacity_hours numeric NOT NULL DEFAULT 8.0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, employee_id)
);

ALTER TABLE public.employee_work_capacity
ENABLE ROW LEVEL SECURITY;

-- Work Assignment History Table
CREATE TABLE IF NOT EXISTS public.work_assignment_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    previous_assignee uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_assignee uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_assignment_history
ENABLE ROW LEVEL SECURITY;

-- Work Execution History Table
CREATE TABLE IF NOT EXISTS public.work_execution_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text NOT NULL,
    health text NOT NULL,
    progress_percent integer NOT NULL DEFAULT 0,
    deadline date,
    deadline_time time,
    carry_forward_count integer NOT NULL DEFAULT 0,
    escalation_level integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_execution_history
ENABLE ROW LEVEL SECURITY;

-- Daily Work Targets Table
CREATE TABLE IF NOT EXISTS public.daily_work_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    employee_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    project_id uuid
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    module_id uuid
        REFERENCES public.project_modules(id)
        ON DELETE SET NULL,

    milestone_id uuid
        REFERENCES public.project_milestones(id)
        ON DELETE SET NULL,

    sprint_id uuid
        REFERENCES public.sprints(id)
        ON DELETE SET NULL,

    work_item_id uuid
        REFERENCES public.work_items(id)
        ON DELETE SET NULL,

    title text NOT NULL,
    target_type text NOT NULL DEFAULT 'COUNT',
    target_value numeric NOT NULL DEFAULT 1,
    unit text NOT NULL DEFAULT 'ITEMS',

    deadline_date date NOT NULL,
    deadline_time time,

    priority text NOT NULL DEFAULT 'MEDIUM',
    status text NOT NULL DEFAULT 'OPEN',

    actual_value numeric NOT NULL DEFAULT 0,
    result_note text,

    carry_forward_value numeric NOT NULL DEFAULT 0,
    carried_forward_from date,
    carry_forward_count integer NOT NULL DEFAULT 0,

    created_by uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE RESTRICT,

    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_work_targets
ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.daily_target_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES public.daily_work_targets(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    module_id uuid REFERENCES public.project_modules(id) ON DELETE SET NULL,
    milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    sprint_id uuid REFERENCES public.sprints(id) ON DELETE SET NULL,
    work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
    target_date date NOT NULL,
    target_type text NOT NULL DEFAULT 'COUNT',
    target_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,
    unit text NOT NULL DEFAULT 'ITEMS',
    achievement_percent numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'OPEN',
    result_reason text,
    result_note text,
    actual_hours numeric,
    deadline_date date,
    deadline_time time,
    health text NOT NULL DEFAULT 'GREEN',
    carry_forward_value numeric NOT NULL DEFAULT 0,
    carry_forward_count integer NOT NULL DEFAULT 0,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_target_results_target_date_key UNIQUE (target_id, target_date)
);

ALTER TABLE public.daily_target_results
ENABLE ROW LEVEL SECURITY;

-- Recurring Work Templates Table
CREATE TABLE IF NOT EXISTS public.recurring_work_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    module_id uuid REFERENCES public.project_modules(id) ON DELETE SET NULL,
    milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    work_type_id uuid REFERENCES public.work_types(id) ON DELETE SET NULL,
    priority text NOT NULL DEFAULT 'MEDIUM',
    frequency text NOT NULL DEFAULT 'DAILY',
    assignment_mode text NOT NULL DEFAULT 'ALL',
    employee_ids uuid[] DEFAULT '{}',
    deadline_time time NOT NULL DEFAULT '18:00',
    estimated_hours numeric DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    last_generated_date date,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_work_templates
ENABLE ROW LEVEL SECURITY;

-- STEP 24: Project Targets Tables

-- 1. project_targets table
CREATE TABLE IF NOT EXISTS public.project_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    project_id uuid NOT NULL
        REFERENCES public.projects(id)
        ON DELETE CASCADE,

    name text NOT NULL,
    description text,

    target_type text NOT NULL DEFAULT 'COUNT', -- 'COUNT', 'HOURS', 'POINTS', 'PERCENTAGE', 'CUSTOM'
    unit text NOT NULL DEFAULT 'units',

    target_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,

    period_type text NOT NULL DEFAULT 'MONTHLY', -- 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'
    period_start date NOT NULL,
    period_end date NOT NULL,

    deadline_date date,
    deadline_time time,

    schedule_mode text DEFAULT 'MANUAL', -- 'AUTOMATIC_DAILY', 'WEEKLY', 'MILESTONE', 'MANUAL'
    status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'
    health text NOT NULL DEFAULT 'GREEN', -- 'GREEN', 'AMBER', 'RED'

    work_type_id uuid
        REFERENCES public.work_types(id)
        ON DELETE SET NULL,

    created_by uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_targets_project_id ON public.project_targets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_targets_org_id ON public.project_targets(organization_id);

ALTER TABLE public.project_targets ENABLE ROW LEVEL SECURITY;

-- 2. project_target_allocations table
CREATE TABLE IF NOT EXISTS public.project_target_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    target_id uuid NOT NULL
        REFERENCES public.project_targets(id)
        ON DELETE CASCADE,

    employee_id uuid NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    allocated_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_target_allocations_target_emp_key UNIQUE (target_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_project_target_allocations_target_id ON public.project_target_allocations(target_id);
CREATE INDEX IF NOT EXISTS idx_project_target_allocations_emp_id ON public.project_target_allocations(employee_id);

ALTER TABLE public.project_target_allocations ENABLE ROW LEVEL SECURITY;

-- 3. project_target_milestones table
CREATE TABLE IF NOT EXISTS public.project_target_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id uuid NOT NULL
        REFERENCES public.organizations(id)
        ON DELETE CASCADE,

    target_id uuid NOT NULL
        REFERENCES public.project_targets(id)
        ON DELETE CASCADE,

    milestone_id uuid
        REFERENCES public.project_milestones(id)
        ON DELETE SET NULL,

    name text NOT NULL,
    target_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,

    deadline date,
    status text NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
    health text NOT NULL DEFAULT 'GREEN', -- 'GREEN', 'AMBER', 'RED'
    order_index integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_target_milestones_target_id ON public.project_target_milestones(target_id);

ALTER TABLE public.project_target_milestones ENABLE ROW LEVEL SECURITY;





