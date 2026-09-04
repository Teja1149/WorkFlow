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
      async (payload) => {
        const workItemId = (payload.new as { work_item_id?: string })?.work_item_id

        if (!workItemId) {
          onChange()
          return
        }

        const { data: workItem } = await supabase
          .from('work_items')
          .select('organization_id')
          .eq('id', workItemId)
          .maybeSingle()

        if (workItem?.organization_id === organizationId) {
          onChange()
        }
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
