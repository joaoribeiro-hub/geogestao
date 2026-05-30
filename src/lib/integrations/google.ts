import crypto from "node:crypto";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { Json, UserIntegrationProvider } from "@/types/database";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_PROVIDER_LABELS: Record<UserIntegrationProvider, string> = {
  google_drive: "Google Drive",
  google_calendar: "Google Calendar",
};

export function getGoogleOAuthConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
    encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "",
  };
}

export function assertGoogleOAuthConfigured() {
  const config = getGoogleOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri || !config.encryptionKey) {
    throw new Error("Google OAuth nao configurado no servidor.");
  }
  return config;
}

export function getGoogleScopes(provider: UserIntegrationProvider) {
  if (provider === "google_drive") {
    return [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ];
  }
  return [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
  ];
}

export function buildGoogleAuthorizationUrl({
  provider,
  state,
}: {
  provider: UserIntegrationProvider;
  state: string;
}) {
  const config = assertGoogleOAuthConfigured();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", getGoogleScopes(provider).join(" "));
  url.searchParams.set("state", state);
  return url;
}

export function createGoogleOAuthState(input: {
  provider: UserIntegrationProvider;
  userId: string;
  organizationId: string;
}) {
  const config = assertGoogleOAuthConfigured();
  const payload = {
    ...input,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", deriveKey(config.encryptionKey))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyGoogleOAuthState(value: string) {
  const config = assertGoogleOAuthConfigured();
  const [body, signature] = value.split(".");
  if (!body || !signature) throw new Error("Estado OAuth invalido.");
  const expected = crypto
    .createHmac("sha256", deriveKey(config.encryptionKey))
    .update(body)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Estado OAuth invalido.");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    provider: UserIntegrationProvider;
    userId: string;
    organizationId: string;
    exp: number;
  };
  if (Date.now() > parsed.exp) throw new Error("Estado OAuth expirado.");
  return parsed;
}

export async function exchangeGoogleCode(code: string) {
  const config = assertGoogleOAuthConfigured();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description ?? "Nao foi possivel conectar ao Google.");
  }
  return data;
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => null)) as { email?: string } | null;
  return data?.email ?? null;
}

export async function upsertGoogleIntegration({
  supabase,
  userId,
  organizationId,
  provider,
  token,
  providerAccountEmail,
}: {
  supabase: ServerSupabase;
  userId: string;
  organizationId: string;
  provider: UserIntegrationProvider;
  token: GoogleTokenResponse;
  providerAccountEmail: string | null;
}) {
  const accessToken = encryptSecret(token.access_token);
  const refreshToken = token.refresh_token ? encryptSecret(token.refresh_token) : null;
  const tokenExpiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? getGoogleScopes(provider);

  const { data: existing } = await supabase
    .from("user_integrations")
    .select("id,refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  const payload = {
    user_id: userId,
    organization_id: organizationId,
    provider,
    provider_account_email: providerAccountEmail,
    access_token_encrypted: accessToken,
    refresh_token_encrypted: refreshToken ?? existing?.refresh_token_encrypted ?? null,
    token_expires_at: tokenExpiresAt,
    scopes,
    status: "active" as const,
    metadata: { connected_at: new Date().toISOString() } as Json,
  };

  const query = existing?.id
    ? supabase.from("user_integrations").update(payload).eq("id", existing.id)
    : supabase.from("user_integrations").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function getFreshGoogleAccessToken(
  supabase: ServerSupabase,
  integration: {
    id: string;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: string | null;
    status: string;
  },
) {
  if (integration.status !== "active") throw new Error("Integracao Google inativa.");
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (integration.access_token_encrypted && expiresAt > Date.now() + 60_000) {
    return decryptSecret(integration.access_token_encrypted);
  }
  if (!integration.refresh_token_encrypted) throw new Error("Google precisa de reautorizacao.");

  const config = assertGoogleOAuthConfigured();
  const refreshToken = decryptSecret(integration.refresh_token_encrypted);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    await supabase
      .from("user_integrations")
      .update({ status: "needs_reauthorization", updated_at: new Date().toISOString() })
      .eq("id", integration.id);
    throw new Error(data?.error_description ?? "Google precisa de reautorizacao.");
  }
  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  await supabase
    .from("user_integrations")
    .update({
      access_token_encrypted: encryptSecret(data.access_token),
      token_expires_at: tokenExpiresAt,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
  return data.access_token;
}

export async function getGoogleIntegrationForUser({
  supabase,
  userId,
  organizationId,
  provider,
}: {
  supabase: ServerSupabase;
  userId: string;
  organizationId: string;
  provider: UserIntegrationProvider;
}) {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getGoogleDriveQuota(accessToken: string) {
  const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=storageQuota,user`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error("Nao foi possivel consultar quota do Google Drive.");
  return data;
}

export async function ensureGoogleDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string | null,
) {
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${escapeDriveQuery(name)}'`,
    parentId ? `'${escapeDriveQuery(parentId)}' in parents` : null,
  ].filter(Boolean).join(" and ");
  const searchUrl = new URL(`${GOOGLE_DRIVE_API}/files`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("fields", "files(id,name)");
  searchUrl.searchParams.set("pageSize", "1");
  const search = await fetch(searchUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const searchData = (await search.json().catch(() => null)) as { files?: Array<{ id: string }> } | null;
  if (searchData?.files?.[0]?.id) return searchData.files[0].id;

  const create = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const folder = (await create.json().catch(() => null)) as { id?: string } | null;
  if (!create.ok || !folder?.id) throw new Error("Nao foi possivel criar pasta no Google Drive.");
  return folder.id;
}

export async function uploadFileToGoogleDrive({
  accessToken,
  file,
  filename,
  mimeType,
  parentId,
}: {
  accessToken: string;
  file: Blob;
  filename: string;
  mimeType: string;
  parentId: string;
}) {
  const boundary = `geogestao-${crypto.randomBytes(8).toString("hex")}`;
  const metadata = JSON.stringify({ name: filename, parents: [parentId] });
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: ${mimeType || "application/octet-stream"}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const response = await fetch(`${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = (await response.json().catch(() => null)) as GoogleDriveFile | null;
  if (!response.ok || !data?.id) throw new Error("Nao foi possivel enviar arquivo ao Google Drive.");
  return data;
}

export async function downloadGoogleDriveFile(accessToken: string, fileId: string) {
  const metadataResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?fields=name,mimeType,size`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const metadata = (await metadataResponse.json().catch(() => null)) as GoogleDriveFile | null;
  if (!metadataResponse.ok || !metadata?.name) throw new Error("Arquivo do Google Drive nao encontrado.");
  const fileResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!fileResponse.ok || !fileResponse.body) throw new Error("Nao foi possivel baixar arquivo do Google Drive.");
  return { response: fileResponse, metadata };
}

export async function createGoogleCalendarEvent({
  accessToken,
  title,
  description,
  date,
  time,
}: {
  accessToken: string;
  title: string;
  description?: string | null;
  date: string;
  time?: string | null;
}) {
  const event = time
    ? {
        summary: title,
        description: description ?? undefined,
        start: { dateTime: `${date}T${time}:00-03:00`, timeZone: "America/Sao_Paulo" },
        end: { dateTime: addOneHour(date, time), timeZone: "America/Sao_Paulo" },
      }
    : {
        summary: title,
        description: description ?? undefined,
        start: { date },
        end: { date: addOneDay(date) },
      };
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
  const data = (await response.json().catch(() => null)) as { id?: string; htmlLink?: string; error?: unknown } | null;
  if (!response.ok || !data?.id) throw new Error("Nao foi possivel criar evento no Google Calendar.");
  return data;
}

function encryptSecret(value: string) {
  const key = deriveKey(assertGoogleOAuthConfigured().encryptionKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string) {
  const [, ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Token criptografado invalido.");
  const key = deriveKey(assertGoogleOAuthConfigured().encryptionKey);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function deriveKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function addOneHour(date: string, time: string) {
  const value = new Date(`${date}T${time}:00-03:00`);
  value.setHours(value.getHours() + 1);
  return value.toISOString();
}

function addOneDay(date: string) {
  const value = new Date(`${date}T00:00:00-03:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error_description?: string;
};

type GoogleDriveFile = {
  id?: string;
  name?: string;
  webViewLink?: string;
  size?: string;
  mimeType?: string;
};
