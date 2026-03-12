import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://cxdhv.locusteater.io",
  "https://cxdhv.netlify.app",
  "https://locusteater-io.github.io",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const LOOKBACK_DAYS = 90;
const FUNCTION_ID = "travel_load";
// Other team domain functions whose roster should mirror Micro profiles
const ROSTER_SYNC_FN_IDS = ["team_sat", "company_sat"];

function diffDays(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function roleLabel(appRole: string | null): string {
  switch (appRole) {
    case "cx_vp":
      return "CX VP";
    case "cx_director":
      return "CX Director";
    case "cx_manager":
      return "CX Manager";
    case "css":
      return "CS";
    default:
      return "FDE";
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization — require a Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate origin for browser requests
    const origin = req.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(
        JSON.stringify({ error: "Forbidden origin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    const ninetyAgo = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
    const cutoff = ninetyAgo.toISOString().slice(0, 10);

    // Get all profiles + roles
    const { data: profiles, error: profErr } = await supabase
      .from("micro_profiles")
      .select("id, full_name");
    if (profErr) throw profErr;

    const { data: roles } = await supabase
      .from("micro_user_roles")
      .select("user_id, role");
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

    // Get past trips only: event_end < today AND event_end >= 90 days ago
    const { data: trips, error: tripErr } = await supabase
      .from("micro_trips")
      .select("id, type, event_start, event_end, deleted")
      .eq("deleted", false)
      .lt("event_end", nowStr)
      .gte("event_end", cutoff);
    if (tripErr) throw tripErr;

    // Get assignments
    const tripIds = (trips || []).map(t => t.id);
    const { data: assignments, error: assignErr } = await supabase
      .from("micro_trip_assignments")
      .select("trip_id, user_id")
      .in("trip_id", tripIds.length > 0 ? tripIds : ["__none__"]);
    if (assignErr) throw assignErr;

    // Build per-user trip lists (O(1) lookup via Map)
    const tripMap = new Map((trips || []).map(t => [t.id, t]));
    const userTrips: Record<string, typeof trips> = {};
    for (const a of assignments || []) {
      if (!userTrips[a.user_id]) userTrips[a.user_id] = [];
      const trip = tripMap.get(a.trip_id);
      if (trip) userTrips[a.user_id].push(trip);
    }

    // Equal weight across all active profiles
    const profileCount = (profiles || []).length;
    const weight = profileCount > 0 ? Math.round((1 / profileCount) * 100) / 100 : 0.1;

    // Fetch existing signals to preserve active state
    const { data: existingSignals } = await supabase
      .from("signals")
      .select("id, active")
      .eq("function_id", FUNCTION_ID);
    const existingActiveMap = new Map((existingSignals || []).map(s => [s.id, s.active]));

    const activeSignalIds: string[] = [];
    const travelSignalBatch: Record<string, unknown>[] = [];
    const results: { name: string; signal_id: string; road_days: number; pto_days: number; trip_count: number; micro_score: number; cxdhv_score: number }[] = [];

    for (const profile of profiles || []) {
      const myTrips = userTrips[profile.id] || [];
      const signalId = `travel_${profile.id}`;
      activeSignalIds.push(signalId);

      let roadDays = 0;
      let ptoDays = 0;
      let tripCount = 0;

      for (const trip of myTrips) {
        const type = trip.type || "in_person";

        if (type === "pto") {
          ptoDays += diffDays(trip.event_start, trip.event_end);
          continue;
        }

        if (type === "no_travel" || type === "mil_time" || type === "virtual") {
          continue;
        }

        // in_person and travel_day count toward road days
        roadDays += diffDays(trip.event_start, trip.event_end);

        // Only in_person counts as a "trip"
        if (type === "in_person") {
          tripCount++;
        }
      }

      const rawScore = (roadDays * 2 + tripCount) / (ptoDays + 5) * 10;
      const microScore = Math.min(100, Math.max(0, Math.round(rawScore)));
      const cxdhvScore = 100 - microScore;
      const role = roleLabel(roleMap.get(profile.id) || null);

      travelSignalBatch.push({
        id: signalId,
        function_id: FUNCTION_ID,
        label: profile.full_name || "Unknown",
        score: cxdhvScore,
        source: "api",
        source_ref: `micro_profile:${profile.id}`,
        role: role,
        weight: weight,
        active: existingActiveMap.has(signalId) ? existingActiveMap.get(signalId) : true,
        updated_at: now.toISOString(),
      });

      results.push({
        name: profile.full_name || "Unknown",
        signal_id: signalId,
        road_days: roadDays,
        pto_days: ptoDays,
        trip_count: tripCount,
        micro_score: microScore,
        cxdhv_score: cxdhvScore,
      });
    }

    // Batch upsert travel_load signals
    if (travelSignalBatch.length > 0) {
      const { error: batchErr } = await supabase
        .from("signals")
        .upsert(travelSignalBatch, { onConflict: "id" });
      if (batchErr) throw batchErr;
    }

    // Soft-deactivate orphaned travel_load signals
    if (activeSignalIds.length > 0) {
      await supabase
        .from("signals")
        .update({ active: false })
        .eq("function_id", FUNCTION_ID)
        .not("id", "in", `(${activeSignalIds.join(",")})`);
    }

    // ── Sync roster to other team functions (team_sat, company_sat) ──
    // Updates names, roles, adds missing members, soft-deactivates stale ones.
    // Preserves existing scores and active state.
    let rosterSynced = 0;
    for (const fnId of ROSTER_SYNC_FN_IDS) {
      const { data: existingSigs } = await supabase
        .from("signals")
        .select("id, label, role, score, active, source_ref")
        .eq("function_id", fnId);

      const existingByRef = new Map(
        (existingSigs || [])
          .filter(s => s.source_ref)
          .map(s => [s.source_ref, s])
      );
      const existingById = new Map(
        (existingSigs || []).map(s => [s.id, s])
      );

      const rosterBatch: Record<string, unknown>[] = [];
      const validSignalIds = new Set<string>();

      for (const profile of profiles || []) {
        const ref = `micro_profile:${profile.id}`;
        const sigId = `${fnId}_${profile.id}`;
        const role = roleLabel(roleMap.get(profile.id) || null);
        const name = profile.full_name || "Unknown";

        const existingByRefSig = existingByRef.get(ref);
        const existingByIdSig = existingById.get(sigId);
        const existing = existingByRefSig || existingByIdSig;
        const upsertId = existing ? existing.id : sigId;
        validSignalIds.add(upsertId);

        rosterBatch.push({
          id: upsertId,
          function_id: fnId,
          label: name,
          role: role,
          score: existing ? existing.score : 50,
          weight: weight,
          source: "manual",
          source_ref: ref,
          active: existing ? existing.active : true,
          updated_at: now.toISOString(),
        });

        rosterSynced++;
      }

      // Batch upsert roster signals
      if (rosterBatch.length > 0) {
        const { error: rosterErr } = await supabase
          .from("signals")
          .upsert(rosterBatch, { onConflict: "id" });
        if (rosterErr) throw rosterErr;
      }

      // Soft-deactivate signals for profiles no longer in Micro
      for (const sig of existingSigs || []) {
        if (!validSignalIds.has(sig.id)) {
          await supabase
            .from("signals")
            .update({ active: false })
            .eq("id", sig.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: results.length, roster_synced: rosterSynced, scores: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
