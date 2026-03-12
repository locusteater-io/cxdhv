import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOOKBACK_DAYS = 90;
const FUNCTION_ID = "travel_load";

function countDaysInRange(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

// Map micro app_role to CXDHV signal role label
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const lookbackDate = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);
    const cutoff = lookbackDate.toISOString().slice(0, 10);

    // Get all profiles + their roles
    const { data: profiles, error: profErr } = await supabase
      .from("micro_profiles")
      .select("id, full_name");
    if (profErr) throw profErr;

    const { data: roles } = await supabase
      .from("micro_user_roles")
      .select("user_id, role");
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

    // Get all trips that overlap with the lookback window
    const { data: trips, error: tripErr } = await supabase
      .from("micro_trips")
      .select("id, type, event_start, event_end, travel_day_start, travel_day_end, deleted")
      .eq("deleted", false)
      .gte("event_end", cutoff);
    if (tripErr) throw tripErr;

    // Get assignments for those trips
    const tripIds = (trips || []).map(t => t.id);
    const { data: assignments, error: assignErr } = await supabase
      .from("micro_trip_assignments")
      .select("trip_id, user_id")
      .in("trip_id", tripIds.length > 0 ? tripIds : ["__none__"]);
    if (assignErr) throw assignErr;

    // Build per-user trip lists
    const userTrips: Record<string, typeof trips> = {};
    for (const a of assignments || []) {
      if (!userTrips[a.user_id]) userTrips[a.user_id] = [];
      const trip = (trips || []).find(t => t.id === a.trip_id);
      if (trip) userTrips[a.user_id].push(trip);
    }

    // Equal weight across all active profiles
    const profileCount = (profiles || []).length;
    const weight = profileCount > 0 ? Math.round((1 / profileCount) * 100) / 100 : 0.1;

    const activeSignalIds: string[] = [];
    const results: { name: string; signal_id: string; road_days: number; pto_days: number; trip_count: number; micro_score: number; cxdhv_score: number }[] = [];

    for (const profile of profiles || []) {
      const myTrips = userTrips[profile.id] || [];
      // Deterministic signal ID from profile UUID
      const signalId = `travel_${profile.id}`;
      activeSignalIds.push(signalId);

      let roadDays = 0;
      let ptoDays = 0;
      let tripCount = 0;

      for (const trip of myTrips) {
        const type = trip.type || "in_person";

        if (type === "pto") {
          ptoDays += countDaysInRange(trip.event_start, trip.event_end);
          continue;
        }

        if (type === "no_travel" || type === "mil_time") {
          continue;
        }

        tripCount++;

        let days = countDaysInRange(trip.event_start, trip.event_end);
        if (trip.travel_day_start && trip.travel_day_start < trip.event_start) {
          days += countDaysInRange(trip.travel_day_start, trip.event_start) - 1;
        }
        if (trip.travel_day_end && trip.travel_day_end > trip.event_end) {
          days += countDaysInRange(trip.event_end, trip.travel_day_end) - 1;
        }
        roadDays += days;
      }

      // Micro formula: clamp(0, 100, round((road_days * 2 + trip_count) / (pto_days + 5) * 10))
      const rawScore = (roadDays * 2 + tripCount) / (ptoDays + 5) * 10;
      const microScore = Math.min(100, Math.max(0, Math.round(rawScore)));
      // Invert for CXDHV (higher = healthier)
      const cxdhvScore = 100 - microScore;

      const role = roleLabel(roleMap.get(profile.id) || null);

      // Upsert signal — create if missing, update if exists
      await supabase
        .from("signals")
        .upsert({
          id: signalId,
          function_id: FUNCTION_ID,
          label: profile.full_name || "Unknown",
          score: cxdhvScore,
          source: "api",
          source_ref: `micro_profile:${profile.id}`,
          role: role,
          weight: weight,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

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

    // Deactivate any travel_load signals that no longer match a profile
    if (activeSignalIds.length > 0) {
      await supabase
        .from("signals")
        .update({ active: false })
        .eq("function_id", FUNCTION_ID)
        .not("id", "in", `(${activeSignalIds.join(",")})`);
    }

    return new Response(
      JSON.stringify({ success: true, synced: results.length, scores: results }),
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
