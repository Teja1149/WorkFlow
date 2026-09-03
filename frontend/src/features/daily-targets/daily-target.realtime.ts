import { supabase } from '../../lib/supabase'

export function subscribeToDailyTargets(
  organizationId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`daily-targets:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_work_targets',
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
