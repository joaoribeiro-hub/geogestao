"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/form-data";
import { propertyMapSchema } from "@/lib/schemas";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function createPropertyGeometryAction(formData: FormData) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const parsed = propertyMapSchema.parse(formDataToObject(formData));

  let geojson: Json;
  try {
    geojson = JSON.parse(parsed.geojson) as Json;
  } catch {
    throw new Error("GeoJSON invalido.");
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      client_id: parsed.client_id,
      service_card_id: parsed.service_card_id,
      name: parsed.name,
      area: parsed.area,
      registry_number: parsed.registry_number,
      registry_date: parsed.registry_date,
      car_state: parsed.car_state,
      car_federal: parsed.car_federal,
      city: parsed.city,
      state: parsed.state,
      notes: parsed.notes,
    })
    .select("id")
    .single();

  if (propertyError) throw new Error(propertyError.message);

  const { data: geometry, error: geometryError } = await supabase
    .from("property_geometries")
    .insert({
      property_id: property.id,
      client_id: parsed.client_id,
      service_card_id: parsed.service_card_id,
      file_path: parsed.file_path,
      file_name: parsed.file_name,
      mime_type: parsed.mime_type,
      size_bytes: parsed.size_bytes,
      geojson,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (geometryError) throw new Error(geometryError.message);

  await logAudit(supabase, {
    action: "map.geometry_uploaded",
    entityType: "property",
    entityId: property.id,
    metadata: {
      geometry_id: geometry.id,
      client_id: parsed.client_id,
      service_card_id: parsed.service_card_id,
      file_name: parsed.file_name,
    },
  });

  revalidatePath("/mapa");

  return {
    ok: true,
    message: "KML/KMZ enviado e perimetro salvo no mapa.",
    propertyId: property.id,
    geometryId: geometry.id,
  };
}
