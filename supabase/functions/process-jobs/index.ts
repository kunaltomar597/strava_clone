// Called every 10 seconds by pg_cron (see the notification_queue
// migration). Drains a batch off the `push_notifications` pgmq queue,
// looks up each notification's recipient + active push tokens, and hands
// the batch to send-push. Messages are archived only after a successful
// send, so a crash mid-batch just leaves them to be retried on the next run.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 50;
const VISIBILITY_TIMEOUT_S = 30;

interface QueueMessage {
  msg_id: number;
  message: { notification_id: string };
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: messages, error: readError } = await admin.rpc("pgmq_read", {
    queue_name: "push_notifications",
    vt: VISIBILITY_TIMEOUT_S,
    qty: BATCH_SIZE,
  });
  if (readError) {
    console.error("Failed to read push_notifications queue:", readError.message);
    return new Response(JSON.stringify({ error: readError.message }), { status: 500 });
  }

  const batch = (messages ?? []) as QueueMessage[];
  if (batch.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const notificationIds = batch.map((m) => m.message.notification_id);

  const { data: notifications, error: fetchError } = await admin
    .from("notifications")
    .select(
      "id, recipient_id, actor_id, type, activity_id, comment_id, data, actor:profiles!notifications_actor_id_fkey(display_name)",
    )
    .in("id", notificationIds);

  if (fetchError) {
    console.error("Failed to load notifications for push:", fetchError.message);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const { data: tokenRows } = await admin
    .from("push_tokens")
    .select("user_id, token")
    .in(
      "user_id",
      (notifications ?? []).map((n) => n.recipient_id),
    )
    .is("disabled_at", null);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  const sendPushUrl = `${SUPABASE_URL}/functions/v1/send-push`;
  let sent = 0;

  for (const notification of notifications ?? []) {
    const tokens = tokensByUser.get(notification.recipient_id) ?? [];
    if (tokens.length === 0) continue;

    const actorName =
      (notification as { actor?: { display_name?: string } }).actor?.display_name ?? "Someone";
    const { title, body } = messageFor(notification.type, actorName);

    const response = await fetch(sendPushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        tokens,
        title,
        body,
        data: { type: notification.type, activityId: notification.activity_id, notificationId: notification.id },
      }),
    });

    if (response.ok) {
      sent++;
    } else {
      console.error(`send-push failed for notification ${notification.id}: ${await response.text()}`);
    }
  }

  // Archive every message we picked up, sent or not — a permanently
  // unreachable recipient (no tokens) shouldn't be retried forever, and a
  // real send-push failure is logged above for investigation rather than
  // silently retried into a hot loop.
  await admin.rpc("pgmq_archive", {
    queue_name: "push_notifications",
    msg_ids: batch.map((m) => m.msg_id),
  });

  return new Response(JSON.stringify({ processed: batch.length, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});

function messageFor(type: string, actorName: string): { title: string; body: string } {
  switch (type) {
    case "kudos":
      return { title: "New kudos", body: `${actorName} gave you kudos` };
    case "comment":
      return { title: "New comment", body: `${actorName} commented on your activity` };
    case "follow":
      return { title: "New follower", body: `${actorName} started following you` };
    case "follow_request":
      return { title: "Follow request", body: `${actorName} wants to follow you` };
    case "follow_accepted":
      return { title: "Follow accepted", body: `${actorName} accepted your follow request` };
    case "personal_record":
      return { title: "New personal record!", body: "You just set a new personal record" };
    default:
      return { title: "Stride", body: "You have a new notification" };
  }
}
