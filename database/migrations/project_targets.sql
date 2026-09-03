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
