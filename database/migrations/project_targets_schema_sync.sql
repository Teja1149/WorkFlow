-- ====================================================================
-- CONSOLIDATED NON-DESTRUCTIVE DATABASE MIGRATION FOR PROJECT TARGETS
-- Fully audits and synchronizes:
-- 1. public.project_targets (all V2 columns, types, foreign keys & indexes)
-- 2. public.project_target_allocations (columns, dual target_id/project_target_id compatibility, foreign keys & indexes)
-- 3. public.project_target_milestones (columns, dual target_id/project_target_id & deadline/deadline_date compatibility, foreign keys & indexes)
-- 4. public.work_items (project_target_id foreign key & target pacing columns)
-- 5. PostgREST schema-cache reload (NOTIFY pgrst)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. PROJECT_TARGETS TABLE & ALL COLUMNS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_targets
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'COUNT',
    ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'units',
    ADD COLUMN IF NOT EXISTS target_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completed_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS period_type text NOT NULL DEFAULT 'MONTHLY',
    ADD COLUMN IF NOT EXISTS period_start date NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS period_end date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
    ADD COLUMN IF NOT EXISTS deadline_date date,
    ADD COLUMN IF NOT EXISTS deadline_time text,
    ADD COLUMN IF NOT EXISTS schedule_mode text DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'GREEN',
    ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'COMBINED',
    ADD COLUMN IF NOT EXISTS work_type_id uuid,
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Foreign keys for project_targets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_targets_project_id_fkey'
          AND table_name = 'project_targets'
    ) THEN
        ALTER TABLE public.project_targets
        ADD CONSTRAINT project_targets_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_targets_organization_id_fkey'
          AND table_name = 'project_targets'
    ) THEN
        ALTER TABLE public.project_targets
        ADD CONSTRAINT project_targets_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_targets_work_type_id_fkey'
          AND table_name = 'project_targets'
    ) THEN
        ALTER TABLE public.project_targets
        ADD CONSTRAINT project_targets_work_type_id_fkey
        FOREIGN KEY (work_type_id) REFERENCES public.work_types(id)
        ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_targets_created_by_fkey'
          AND table_name = 'project_targets'
    ) THEN
        ALTER TABLE public.project_targets
        ADD CONSTRAINT project_targets_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.profiles(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. PROJECT_TARGET_ALLOCATIONS TABLE & COLUMNS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_target_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_id uuid,
    project_target_id uuid,
    employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    allocated_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,
    completed_value numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_target_allocations
    ADD COLUMN IF NOT EXISTS target_id uuid,
    ADD COLUMN IF NOT EXISTS project_target_id uuid,
    ADD COLUMN IF NOT EXISTS allocated_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completed_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure target_id and project_target_id are synced bidirectionally
UPDATE public.project_target_allocations
SET target_id = project_target_id
WHERE target_id IS NULL AND project_target_id IS NOT NULL;

UPDATE public.project_target_allocations
SET project_target_id = target_id
WHERE project_target_id IS NULL AND target_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_allocations_target_id_fkey'
          AND table_name = 'project_target_allocations'
    ) THEN
        ALTER TABLE public.project_target_allocations
        ADD CONSTRAINT project_target_allocations_target_id_fkey
        FOREIGN KEY (target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_allocations_project_target_id_fkey'
          AND table_name = 'project_target_allocations'
    ) THEN
        ALTER TABLE public.project_target_allocations
        ADD CONSTRAINT project_target_allocations_project_target_id_fkey
        FOREIGN KEY (project_target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_allocations_employee_id_fkey'
          AND table_name = 'project_target_allocations'
    ) THEN
        ALTER TABLE public.project_target_allocations
        ADD CONSTRAINT project_target_allocations_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_allocations_organization_id_fkey'
          AND table_name = 'project_target_allocations'
    ) THEN
        ALTER TABLE public.project_target_allocations
        ADD CONSTRAINT project_target_allocations_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. PROJECT_TARGET_MILESTONES TABLE & COLUMNS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_target_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_id uuid,
    project_target_id uuid,
    milestone_id uuid,
    name text NOT NULL DEFAULT '',
    target_value numeric NOT NULL DEFAULT 0,
    actual_value numeric NOT NULL DEFAULT 0,
    completed_value numeric NOT NULL DEFAULT 0,
    deadline date,
    deadline_date date,
    status text NOT NULL DEFAULT 'PENDING',
    health text NOT NULL DEFAULT 'GREEN',
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_target_milestones
    ADD COLUMN IF NOT EXISTS target_id uuid,
    ADD COLUMN IF NOT EXISTS project_target_id uuid,
    ADD COLUMN IF NOT EXISTS milestone_id uuid,
    ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS target_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completed_value numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deadline date,
    ADD COLUMN IF NOT EXISTS deadline_date date,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'GREEN',
    ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure target_id/project_target_id and deadline/deadline_date are synced
UPDATE public.project_target_milestones
SET target_id = project_target_id
WHERE target_id IS NULL AND project_target_id IS NOT NULL;

UPDATE public.project_target_milestones
SET project_target_id = target_id
WHERE project_target_id IS NULL AND target_id IS NOT NULL;

UPDATE public.project_target_milestones
SET deadline = deadline_date
WHERE deadline IS NULL AND deadline_date IS NOT NULL;

UPDATE public.project_target_milestones
SET deadline_date = deadline
WHERE deadline_date IS NULL AND deadline IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_milestones_target_id_fkey'
          AND table_name = 'project_target_milestones'
    ) THEN
        ALTER TABLE public.project_target_milestones
        ADD CONSTRAINT project_target_milestones_target_id_fkey
        FOREIGN KEY (target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_milestones_project_target_id_fkey'
          AND table_name = 'project_target_milestones'
    ) THEN
        ALTER TABLE public.project_target_milestones
        ADD CONSTRAINT project_target_milestones_project_target_id_fkey
        FOREIGN KEY (project_target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_milestones_organization_id_fkey'
          AND table_name = 'project_target_milestones'
    ) THEN
        ALTER TABLE public.project_target_milestones
        ADD CONSTRAINT project_target_milestones_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 4. WORK_ITEMS TABLE EXTENSIONS (Target Synchronization Link)
-- --------------------------------------------------------------------
ALTER TABLE public.work_items
    ADD COLUMN IF NOT EXISTS project_target_id uuid,
    ADD COLUMN IF NOT EXISTS target_unit_index integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pacing_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pacing_start_date date,
    ADD COLUMN IF NOT EXISTS target_quantity numeric NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quantity_target numeric NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS completed_quantity numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_completed numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_unit text NOT NULL DEFAULT 'units';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'work_items_project_target_id_fkey'
          AND table_name = 'work_items'
    ) THEN
        ALTER TABLE public.work_items
        ADD CONSTRAINT work_items_project_target_id_fkey
        FOREIGN KEY (project_target_id) REFERENCES public.project_targets(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_project_targets_project_id ON public.project_targets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_targets_org_id ON public.project_targets(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_targets_created_at ON public.project_targets(created_at);

CREATE INDEX IF NOT EXISTS idx_project_target_allocations_target_id ON public.project_target_allocations(target_id);
CREATE INDEX IF NOT EXISTS idx_project_target_allocations_proj_target_id ON public.project_target_allocations(project_target_id);
CREATE INDEX IF NOT EXISTS idx_project_target_allocations_emp_id ON public.project_target_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_target_allocations_org_id ON public.project_target_allocations(organization_id);

CREATE INDEX IF NOT EXISTS idx_project_target_milestones_target_id ON public.project_target_milestones(target_id);
CREATE INDEX IF NOT EXISTS idx_project_target_milestones_proj_target_id ON public.project_target_milestones(project_target_id);
CREATE INDEX IF NOT EXISTS idx_project_target_milestones_org_id ON public.project_target_milestones(organization_id);

CREATE INDEX IF NOT EXISTS idx_work_items_project_target_id ON public.work_items(project_target_id);

-- --------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.project_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_target_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_target_milestones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'project_targets' AND policyname = 'project_targets_org_policy'
    ) THEN
        CREATE POLICY project_targets_org_policy ON public.project_targets
            FOR ALL USING (
                organization_id IN (
                    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'project_target_allocations' AND policyname = 'project_target_allocations_org_policy'
    ) THEN
        CREATE POLICY project_target_allocations_org_policy ON public.project_target_allocations
            FOR ALL USING (
                organization_id IN (
                    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'project_target_milestones' AND policyname = 'project_target_milestones_org_policy'
    ) THEN
        CREATE POLICY project_target_milestones_org_policy ON public.project_target_milestones
            FOR ALL USING (
                organization_id IN (
                    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
                )
            );
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 7. NOTIFY POSTGREST SCHEMA CACHE RELOAD
-- --------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
