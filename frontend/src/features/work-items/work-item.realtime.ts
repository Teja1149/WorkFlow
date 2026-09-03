import { supabase } from '../../lib/supabase'

export function subscribeToWorkItems(
  organizationId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`work-items:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'work_items',
        filter: `organization_id=eq.${organizationId}`,
      },
      () => {
        onChange()
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToWorkUpdates(
  organizationId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`work-updates:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'work_updates',
      },
      () => {
        onChange()
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
