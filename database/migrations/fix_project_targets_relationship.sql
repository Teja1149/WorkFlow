-- ====================================================================
-- Fix project_targets <-> projects foreign key relationship & schema cache
-- ====================================================================

DO $$
BEGIN
    -- 1. Ensure foreign key from project_targets.project_id -> projects.id exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'project_targets_project_id_fkey'
          AND table_name = 'project_targets'
    ) THEN
        -- Add foreign key constraint if missing
        ALTER TABLE public.project_targets
        ADD CONSTRAINT project_targets_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.projects(id)
        ON DELETE CASCADE;
    END IF;

    -- 2. Ensure foreign key from project_target_allocations.target_id -> project_targets.id exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_allocations_target_id_fkey'
          AND table_name = 'project_target_allocations'
    ) THEN
        ALTER TABLE public.project_target_allocations
        ADD CONSTRAINT project_target_allocations_target_id_fkey
        FOREIGN KEY (target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;

    -- 3. Ensure foreign key from project_target_milestones.target_id -> project_targets.id exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'project_target_milestones_target_id_fkey'
          AND table_name = 'project_target_milestones'
    ) THEN
        ALTER TABLE public.project_target_milestones
        ADD CONSTRAINT project_target_milestones_target_id_fkey
        FOREIGN KEY (target_id) REFERENCES public.project_targets(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
