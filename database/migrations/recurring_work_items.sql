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

ALTER TABLE public.recurring_work_templates ENABLE ROW LEVEL SECURITY;

-- Recurring Work Items Idempotency & Template Columns
ALTER TABLE public.work_items
ADD COLUMN IF NOT EXISTS recurring_template_id uuid;

ALTER TABLE public.work_items
ADD COLUMN IF NOT EXISTS recurring_work_date date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_recurring_daily_unique
ON public.work_items(
  recurring_template_id,
  assigned_to,
  recurring_work_date
)
WHERE recurring_template_id IS NOT NULL;
