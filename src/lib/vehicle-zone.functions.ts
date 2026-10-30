import { createServerFn } from "@tanstack/react-start";
import type { ZoneJob } from "./vehicle-zone";

export const reviewVehicleAssignment = createServerFn({ method: "POST" })
  .inputValidator((data: ZoneJob) => data)
  .handler(async ({ data }) => {
    const { requireAccess } = await import("./access-session.server");
    await requireAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reviewVehicleZone } = await import("./vehicle-zone.server");
    return reviewVehicleZone(supabaseAdmin, data);
  });