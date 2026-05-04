import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type TraceRow = {
  id: string;
  title: string | null;
  description: string | null;
  lat: number;
  lng: number;
  date: string | null;
  end_date: string | null;
};

function escapeIcsText(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}

/** Fold to ~75 octets per RFC 5545 (ASCII-safe for our charset). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  if (rest.length) parts.push(rest);
  return parts.join("\r\n");
}

function ymdToIcsDate(ymd: string): string {
  return ymd.replaceAll("-", "");
}

/** Exclusive calendar end for VALUE=DATE (day after inclusive last day). */
function exclusiveEndFromInclusive(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d + 1);
  const dt = new Date(ms);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function formatUtcDtStamp(d: Date): string {
  return d.toISOString().replaceAll("-", "").replaceAll(":", "").split(".")[0] + "Z";
}

function buildCalendar(params: { journalName: string; journalId: string; traces: TraceRow[] }): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Curolia//iCalendar feed//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcsText(params.journalName)}`,
  ];
  const dtstamp = formatUtcDtStamp(new Date());
  for (const t of params.traces) {
    if (!t.date) continue;
    const summary = (t.title?.trim() || "Trace").slice(0, 200);
    const desc = t.description?.trim() ?? "";
    const start = ymdToIcsDate(t.date);
    const lastInclusive = t.end_date && t.end_date >= t.date ? t.end_date : t.date;
    const endExclusive = exclusiveEndFromInclusive(lastInclusive);
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${t.id}@curolia-${params.journalId}`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${endExclusive}`);
    lines.push(foldLine(`SUMMARY:${escapeIcsText(summary)}`));
    if (desc.length > 0) lines.push(foldLine(`DESCRIPTION:${escapeIcsText(desc)}`));
    lines.push(foldLine(`GEO:${t.lat};${t.lng}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: feedRow, error: feedErr } = await admin
    .from("journal_ical_feed_tokens")
    .select("journal_id")
    .eq("token", token)
    .maybeSingle();

  if (feedErr || !feedRow?.journal_id) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const journalId = feedRow.journal_id as string;

  const { data: ownerRow, error: ownerErr } = await admin
    .from("journal_members")
    .select("user_id")
    .eq("journal_id", journalId)
    .eq("role", "owner")
    .maybeSingle();

  if (ownerErr || !ownerRow?.user_id) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { data: uc, error: ucErr } = await admin
    .from("user_connectors")
    .select("enabled")
    .eq("user_id", ownerRow.user_id as string)
    .eq("connector_type_id", "ical")
    .maybeSingle();

  if (ucErr || !uc?.enabled) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { data: jc, error: jcErr } = await admin
    .from("journal_connectors")
    .select("config")
    .eq("journal_id", journalId)
    .eq("connector_type_id", "ical")
    .maybeSingle();

  if (jcErr || !jc) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const cfg = jc.config as Record<string, unknown> | null;
  const publish = cfg?.publishFeed === true;
  if (!publish) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { data: journal, error: jErr } = await admin.from("journals").select("name").eq("id", journalId).single();
  if (jErr || !journal) {
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { data: traces, error: tErr } = await admin
    .from("traces")
    .select("id, title, description, lat, lng, date, end_date")
    .eq("journal_id", journalId)
    .order("date", { ascending: true, nullsFirst: false });

  if (tErr) {
    return new Response("Error", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const body = buildCalendar({
    journalName: (journal.name as string) || "Untitled journal",
    journalId,
    traces: (traces ?? []) as TraceRow[],
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
