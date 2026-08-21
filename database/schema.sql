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
    completed_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

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
    status text NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at timestamptz,
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
