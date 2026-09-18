// Thin wrapper around Expo's push API. Kept as its own function (rather
// than inlined into process-jobs) so token-invalidation handling lives in
// one place regardless of which caller triggers a send.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN");

interface SendPushRequest {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Called only by process-jobs, authenticated with the service role.
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const { tokens, title, body, data } = (await req.json()) as SendPushRequest;
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ error: "No tokens provided" }), { status: 400 });
  }

  const messages = tokens.map((to) => ({ to, title, body, data, sound: "default" as const }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    return new Response(JSON.stringify({ error: `Expo push API error: ${text}` }), { status: 502 });
  }

  const { data: tickets } = (await response.json()) as { data: ExpoPushTicket[] };

  // A DeviceNotRegistered error means the app was uninstalled or the token
  // otherwise expired; disable it so future sends don't keep retrying it.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const deadTokens = tickets
    .map((ticket, i) => (ticket.details?.error === "DeviceNotRegistered" ? tokens[i] : null))
    .filter((t): t is string => t !== null);

  if (deadTokens.length > 0) {
    await admin.from("push_tokens").update({ disabled_at: new Date().toISOString() }).in("token", deadTokens);
  }

  return new Response(JSON.stringify({ sent: tickets.length, disabled: deadTokens.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
