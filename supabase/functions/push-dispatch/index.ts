import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type PushRow = {
  id: string;
  token: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendViaFcm(serverKey: string, row: PushRow): Promise<void> {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: row.token,
      notification: {
        title: row.title,
        body: row.body ?? "",
      },
      data: row.payload,
      priority: "high",
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `FCM request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  if (typeof payload.failure === "number" && payload.failure > 0) {
    throw new Error(`FCM delivery failed: ${JSON.stringify(payload)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return jsonResponse(405, { error: "Method not allowed" });

  const dispatchSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!dispatchSecret)
    return jsonResponse(500, {
      error: "PUSH_DISPATCH_SECRET is not configured",
    });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${dispatchSecret}`) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  if (!supabaseUrl || !serviceRole)
    return jsonResponse(500, { error: "Supabase env vars missing" });
  if (!fcmServerKey)
    return jsonResponse(500, { error: "FCM_SERVER_KEY is not configured" });

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);
  const client = createClient(supabaseUrl, serviceRole);

  const { data: rows, error } = await client
    .from("push_notification_outbox")
    .select("id, token, title, body, payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return jsonResponse(500, { error: error.message });
  if (!rows || rows.length === 0)
    return jsonResponse(200, { processed: 0, sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  for (const rawRow of rows as PushRow[]) {
    try {
      await sendViaFcm(fcmServerKey, rawRow);
      const { error: updateError } = await client
        .from("push_notification_outbox")
        .update({
          status: "sent",
          attempts: 1,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", rawRow.id);
      if (updateError) throw updateError;
      sent += 1;
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Unknown push error";
      await client
        .from("push_notification_outbox")
        .update({
          status: "failed",
          attempts: 1,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rawRow.id);
      failed += 1;
    }
  }

  return jsonResponse(200, {
    processed: rows.length,
    sent,
    failed,
  });
});
