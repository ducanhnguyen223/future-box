// Schedule: Supabase Dashboard > Edge Functions > notify-due-boxes > Schedule (cron, ví dụ mỗi phút "* * * * *"),
// hoặc pg_cron + pg_net: select cron.schedule('notify-due-boxes', '* * * * *',
//   $$select net.http_post(url := '<function-url>', headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>'))$$);
//
// Activity diagram: design/flows/06-push-notification.md (ServerSide) — deno runtime, không chạy qua Jest.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type DueBox = { id: string; user_id: string };
type PushTokenRow = { expo_push_token: string };

/** Query boxes đến hạn & chưa notify — dùng đúng idx_boxes_open_at_pending (partial index). */
async function fetchDueBoxes(supabase: ReturnType<typeof createClient>): Promise<DueBox[]> {
  const { data, error } = await supabase
    .from('boxes')
    .select('id, user_id')
    .lte('open_at', new Date().toISOString())
    .is('opened_at', null)
    .is('notified_at', null);

  if (error) throw error;
  return (data ?? []) as DueBox[];
}

async function fetchTokensForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase.from('push_tokens').select('expo_push_token').eq('user_id', userId);

  if (error) throw error;
  return ((data ?? []) as PushTokenRow[]).map((row) => row.expo_push_token);
}

async function sendExpoPush(tokens: string[], boxId: string): Promise<boolean> {
  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: 'Hộp thời gian đã đến hạn mở',
          body: 'Một hộp thời gian của bạn đã sẵn sàng để mở.',
          data: { boxId },
        }))
      ),
    });
    return response.ok;
  } catch (err) {
    console.error(`sendExpoPush failed for box ${boxId}:`, err);
    return false;
  }
}

async function markNotified(supabase: ReturnType<typeof createClient>, boxId: string): Promise<void> {
  const { error } = await supabase.from('boxes').update({ notified_at: new Date().toISOString() }).eq('id', boxId);
  if (error) console.error(`markNotified failed for box ${boxId}:`, error);
}

async function processBox(supabase: ReturnType<typeof createClient>, box: DueBox): Promise<void> {
  const tokens = await fetchTokensForUser(supabase, box.user_id);

  // Không có token đã đăng ký: bỏ qua, coi như đã xử lý xong hộp này (Ghi chú trong flow 06).
  if (tokens.length === 0) {
    await markNotified(supabase, box.id);
    return;
  }

  const sent = await sendExpoPush(tokens, box.id);
  // Gửi thất bại: không set notified_at, để lượt cron sau thử lại.
  if (sent) {
    await markNotified(supabase, box.id);
  }
}

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const dueBoxes = await fetchDueBoxes(supabase);
  for (const box of dueBoxes) {
    await processBox(supabase, box);
  }

  return new Response(JSON.stringify({ processed: dueBoxes.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
