-- Migration: Make work_items.project_id nullable
-- Allows standalone/custom work assignment without requiring a project
-- Preserves existing foreign key relationship with projects

ALTER TABLE public.work_items
    ALTER COLUMN project_id DROP NOT NULL;
