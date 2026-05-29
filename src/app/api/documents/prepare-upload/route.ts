import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  assertDocumentRelatedRecords,
  releaseDocumentStorage,
  reserveDocumentStorageOrThrow,
} from "@/lib/documents/server";
import {
  buildDocumentStoragePath,
  DOCUMENTS_BUCKET,
  sanitizeDocumentFileName,
  validateDocumentFile,
} from "@/lib/documents/storage";
import { requireOrganization } from "@/lib/organization";
import { createServerSupabase } from "@/lib/supabase/server";

type PrepareUploadBody = {
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  title?: string;
  documentType?: string;
  category?: string;
  description?: string;
  notes?: string;
  clientId?: string | null;
  propertyId?: string | null;
  serviceId?: string | null;
  employeeId?: string | null;
  relatedType?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  const { organization } = await requireOrganization(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ error: "Organizacao nao encontrada." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PrepareUploadBody;
  const fileName = body.fileName?.trim() ?? "";
  const sizeBytes = Number(body.sizeBytes ?? 0);
  const mimeType = body.mimeType ?? "";
  const validation = validateDocumentFile({ sizeBytes, mimeType });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  await assertDocumentRelatedRecords({
    supabase,
    organizationId: organization.id,
    clientId: body.clientId,
    serviceId: body.serviceId,
    employeeId: body.employeeId,
  });

  const documentId = crypto.randomUUID();
  const storedName = sanitizeDocumentFileName(fileName);
  const storagePath = buildDocumentStoragePath({
    organizationId: organization.id,
    documentId,
    originalName: fileName,
    clientId: body.clientId,
    propertyId: body.propertyId,
    serviceId: body.serviceId,
    employeeId: body.employeeId,
    relatedType: body.relatedType,
  });

  await reserveDocumentStorageOrThrow(supabase, organization.id, sizeBytes);

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: organization.id,
    client_id: body.clientId || null,
    property_id: body.propertyId || null,
    service_id: body.serviceId || null,
    employee_id: body.employeeId || null,
    related_type: body.relatedType || null,
    related_id: body.serviceId || body.clientId || body.employeeId || body.propertyId || null,
    uploaded_by: user.id,
    original_name: fileName,
    stored_name: storedName,
    title: body.title?.trim() || fileName,
    document_type: body.documentType?.trim() || null,
    category: body.category?.trim() || null,
    description: body.description?.trim() || null,
    notes: body.notes?.trim() || null,
    storage_bucket: DOCUMENTS_BUCKET,
    storage_path: storagePath,
    size_bytes: sizeBytes,
    mime_type: mimeType,
    upload_status: "aguardando_upload",
    processing_status: "nao_processado",
    is_global: false,
    is_official: false,
  });

  if (error) {
    await releaseDocumentStorage(supabase, organization.id, sizeBytes).catch(() => undefined);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    documentId,
    bucket: DOCUMENTS_BUCKET,
    storagePath,
    maxSizeBytes: sizeBytes,
  });
}

