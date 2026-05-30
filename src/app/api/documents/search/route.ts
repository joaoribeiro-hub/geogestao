import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ documents: [] });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const clientId = url.searchParams.get("client_id");
  const propertyId = url.searchParams.get("property_id");
  const serviceId = url.searchParams.get("service_id");
  const employeeId = url.searchParams.get("employee_id");
  const relatedType = url.searchParams.get("related_type");
  const documentType = url.searchParams.get("document_type");
  const processingStatus = url.searchParams.get("processing_status");
  const uploadStatus = url.searchParams.get("upload_status");

  let query = supabase
    .from("documents")
    .select(
      "id,organization_id,client_id,property_id,service_id,employee_id,related_type,original_name,stored_name,document_type,category,title,description,notes,storage_provider,storage_bucket,storage_path,size_bytes,mime_type,upload_status,processing_status,is_global,is_official,created_at,uploaded_by,google_drive_owner_email,external_url",
    )
    .or(`organization_id.eq.${organization.id},is_global.eq.true`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (clientId) query = query.eq("client_id", clientId);
  if (propertyId) query = query.eq("property_id", propertyId);
  if (serviceId) query = query.eq("service_id", serviceId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  if (relatedType) query = query.eq("related_type", relatedType);
  if (documentType) query = query.eq("document_type", documentType);
  if (isProcessingStatus(processingStatus)) query = query.eq("processing_status", processingStatus);
  if (isUploadStatus(uploadStatus)) query = query.eq("upload_status", uploadStatus);
  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    const { data: chunkMatches } = await supabase
      .from("document_chunks")
      .select("document_id")
      .eq("organization_id", organization.id)
      .ilike("text", `%${escaped}%`)
      .limit(50);
    const chunkDocumentIds = Array.from(new Set((chunkMatches ?? []).map((item) => item.document_id)));
    const chunkFilter = chunkDocumentIds.length ? `,id.in.(${chunkDocumentIds.join(",")})` : "";
    query = query.or(
      [
        `original_name.ilike.%${escaped}%`,
        `title.ilike.%${escaped}%`,
        `document_type.ilike.%${escaped}%`,
        `category.ilike.%${escaped}%`,
        `description.ilike.%${escaped}%`,
        `notes.ilike.%${escaped}%`,
        `extracted_text.ilike.%${escaped}%`,
      ].join(",") + chunkFilter,
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ documents: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

function isProcessingStatus(value: string | null): value is "nao_processado" | "pendente" | "processando" | "concluido" | "erro" | "precisa_ocr" {
  return ["nao_processado", "pendente", "processando", "concluido", "erro", "precisa_ocr"].includes(value ?? "");
}

function isUploadStatus(value: string | null): value is "aguardando_upload" | "enviado" | "erro_upload" | "cancelado" | "removido" {
  return ["aguardando_upload", "enviado", "erro_upload", "cancelado", "removido"].includes(value ?? "");
}
