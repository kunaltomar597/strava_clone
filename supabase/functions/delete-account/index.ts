// Deletes the calling user's account entirely: their Storage folders across
// every bucket, then the auth.users row, which cascades through every
// table in `public` via `on delete cascade` foreign keys. Required by both
// Apple (5.1.1) and Google Play's account-deletion policy.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Buckets that store files under a `{user_id}/...` prefix. Kept as a plain
// list (rather than discovered dynamically) so adding a bucket is a
// deliberate, reviewed change to this function.
const USER_PREFIXED_BUCKETS = ["avatars", "activity-raw", "activity-photos"];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  // A client bound to the *caller's* JWT, purely to find out who they are.
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  for (const bucket of USER_PREFIXED_BUCKETS) {
    const { data: files, error: listError } = await admin.storage.from(bucket).list(user.id, {
      limit: 1000,
    });
    if (listError) {
      console.error(`Failed to list ${bucket}/${user.id}:`, listError.message);
      continue;
    }
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`Failed to remove files from ${bucket}:`, removeError.message);
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
