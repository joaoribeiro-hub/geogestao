import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  ensureGoogleDriveFolder,
  getFreshGoogleAccessToken,
  getGoogleIntegrationForUser,
  uploadFileToGoogleDrive,
} from "@/lib/integrations/google";
import { buildDocumentStoragePath, sanitizeDocumentFileName, validateDocumentFile } from "@/lib/documents/storage";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 });
  }

  const validation = validateDocumentFile({ sizeBytes: file.size, mimeType: file.type });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const clientId = optionalFormString(formData.get("clientId"));
  const propertyId = optionalFormString(formData.get("propertyId"));
  const serviceId = optionalFormString(formData.get("serviceId"));
  const employeeId = optionalFormString(formData.get("employeeId"));
  const relatedType = optionalFormString(formData.get("relatedType")) ?? "company";

  const ownershipError = await validateRelatedRecords({
    supabase,
    organizationId: organization.id,
    clientId,
    serviceId,
  });
  if (ownershipError) return NextResponse.json({ error: ownershipError }, { status: 403 });

  const integration = await getGoogleIntegrationForUser({
    supabase,
    userId: user.id,
    organizationId: organization.id,
    provider: "google_drive",
  });
  if (!integration || integration.status !== "active") {
    return NextResponse.json({ error: "Conecte o Google Drive antes de enviar para o Drive." }, { status: 400 });
  }

  try {
    const documentId = crypto.randomUUID();
    const safeFilename = sanitizeDocumentFileName(file.name);
    const storagePath = buildDocumentStoragePath({
      organizationId: organization.id,
      documentId,
      originalName: file.name,
      clientId,
      propertyId,
      serviceId,
      employeeId,
      relatedType,
    });
    const accessToken = await getFreshGoogleAccessToken(supabase, integration);
    const rootId = await ensureGoogleDriveFolder(accessToken, "GeoGestao");
    const organizationsId = await ensureGoogleDriveFolder(accessToken, "organizations", rootId);
    const orgId = await ensureGoogleDriveFolder(accessToken, organization.id, organizationsId);
    const section = serviceId ? "services" : employeeId ? "hr" : clientId ? "clients" : "documents";
    const sectionId = await ensureGoogleDriveFolder(accessToken, section, orgId);
    const folderId = await ensureGoogleDriveFolder(accessToken, documentId, sectionId);
    const driveFile = await uploadFileToGoogleDrive({
      accessToken,
      file,
      filename: safeFilename,
      mimeType: file.type,
      parentId: folderId,
    });

    const { data, error } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        organization_id: organization.id,
        client_id: clientId,
        property_id: propertyId,
        service_id: serviceId,
        employee_id: employeeId,
        related_type: relatedType,
        related_id: serviceId ?? clientId ?? employeeId ?? null,
        uploaded_by: user.id,
        original_name: file.name,
        stored_name: safeFilename,
        title: optionalFormString(formData.get("title")),
        document_type: optionalFormString(formData.get("documentType")),
        category: optionalFormString(formData.get("category")),
        description: optionalFormString(formData.get("description")),
        notes: optionalFormString(formData.get("notes")),
        storage_provider: "google_drive",
        storage_bucket: "google_drive",
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type,
        upload_status: "enviado",
        processing_status: "nao_processado",
        google_drive_file_id: driveFile.id,
        google_drive_owner_user_id: user.id,
        google_drive_owner_email: integration.provider_account_email,
        external_url: driveFile.webViewLink ?? null,
        external_metadata: {
          drive_file_id: driveFile.id,
          drive_folder_id: folderId,
          provider: "google_drive",
        } as Json,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ document: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel enviar ao Google Drive." },
      { status: 500 },
    );
  }
}

function optionalFormString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

async function validateRelatedRecords({
  supabase,
  organizationId,
  clientId,
  serviceId,
}: {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  organizationId: string;
  clientId: string | null;
  serviceId: string | null;
}) {
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!data) return "Cliente nao pertence a organizacao atual.";
  }
  if (serviceId) {
    const { data } = await supabase
      .from("service_cards")
      .select("id")
      .eq("id", serviceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!data) return "Servico nao pertence a organizacao atual.";
  }
  return null;
}
