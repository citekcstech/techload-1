import { createClient } from '@/lib/supabase/client';
import type { NotificationType } from '@/types';

export async function createNotification(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: NotificationType,
  message: string,
  taskId?: string
): Promise<void> {
  await supabase
    .from('notifications')
    .insert({ user_id: userId, type, message, task_id: taskId ?? null });
}
