const DEFAULT_MAPBIOMAS_ALERT_API_URL =
  "https://plataforma.alerta.mapbiomas.org/api/v2/graphql";
const MAPBIOMAS_PLATFORM_URL = "https://plataforma.alerta.mapbiomas.org/";

let cachedToken: string | null = null;
let cachedTokenSource: "configured" | "signIn" | null = null;

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type SignInResponse = {
  signIn?: unknown;
};

export type MapBiomasAlertDetails = Record<string, unknown>;

export class MapBiomasAuthError extends Error {
  constructor(message = "Nao foi possivel autenticar na API MapBiomas. Verifique as variaveis do servidor.") {
    super(message);
    this.name = "MapBiomasAuthError";
  }
}

export class MapBiomasUnavailableError extends Error {
  constructor(message = "A API MapBiomas nao respondeu agora. Tente novamente mais tarde.") {
    super(message);
    this.name = "MapBiomasUnavailableError";
  }
}

export function hasMapBiomasAlertConfig() {
  return Boolean(
    process.env.MAPBIOMAS_ALERT_TOKEN ||
      (process.env.MAPBIOMAS_ALERT_EMAIL && process.env.MAPBIOMAS_ALERT_PASSWORD),
  );
}

export async function signInMapBiomas(options?: { forceCredentials?: boolean }) {
  if (!options?.forceCredentials && process.env.MAPBIOMAS_ALERT_TOKEN) {
    cachedToken = process.env.MAPBIOMAS_ALERT_TOKEN;
    cachedTokenSource = "configured";
    return cachedToken;
  }

  if (cachedToken && cachedTokenSource === "signIn") return cachedToken;

  const email = process.env.MAPBIOMAS_ALERT_EMAIL;
  const password = process.env.MAPBIOMAS_ALERT_PASSWORD;
  if (!email || !password) {
    throw new MapBiomasAuthError();
  }

  const response = await rawMapBiomasGraphql<SignInResponse>({
    query: `
      mutation SignIn($email: String!, $password: String!) {
        signIn(email: $email, password: $password)
      }
    `,
    variables: { email, password },
    token: null,
  });

  const token = extractToken(response.data?.signIn);
  if (!token) {
    throw new MapBiomasAuthError("Login MapBiomas Alerta nao retornou token Bearer.");
  }

  cachedToken = token;
  cachedTokenSource = "signIn";
  return token;
}

export async function queryMapBiomasGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
) {
  const token = await signInMapBiomas();
  try {
    return await rawMapBiomasGraphql<T>({ query, variables, token });
  } catch (error) {
    if (!isMapBiomasAuthError(error) || !canFallbackToSignIn()) throw error;
    cachedToken = null;
    cachedTokenSource = null;
    const fallbackToken = await signInMapBiomas({ forceCredentials: true });
    return rawMapBiomasGraphql<T>({ query, variables, token: fallbackToken });
  }
}

export async function getAlertByCode(alertCode: number, carCode?: string) {
  const variables = { alertCode, carCode: carCode || null };

  try {
    const response = await queryMapBiomasGraphql<{ alert?: MapBiomasAlertDetails }>(
      `
        query Alert($alertCode: Int!, $carCode: String) {
          alert(alertCode: $alertCode, carCode: $carCode) {
            alertCode
            areaHa
            detectedAt
            publishedAt
            statusName
            sources
            crossedBiomesList
            crossedCitiesList
            crossedStatesList
            ruralPropertiesList
            ruralPropertiesTotal
            ruralPropertiesCodes
            geometryWkt
            alertImageBbox
            publishedImages
            imagesLabels
            bbox
            boundingBox
            warnings
          }
        }
      `,
      variables,
    );
    return response.data?.alert ?? null;
  } catch (error) {
    if (!isGraphqlFieldError(error)) throw error;
    const fallback = await queryMapBiomasGraphql<{ alert?: MapBiomasAlertDetails }>(
      `
        query Alert($alertCode: Int!, $carCode: String) {
          alert(alertCode: $alertCode, carCode: $carCode) {
            alertCode
            areaHa
            detectedAt
            publishedAt
            statusName
            bbox
            boundingBox
            warnings
          }
        }
      `,
      variables,
    );
    return fallback.data?.alert ?? null;
  }
}

export async function getRuralPropertyAlerts(carCode: string) {
  try {
    const response = await queryMapBiomasGraphql<{ ruralProperty?: MapBiomasAlertDetails }>(
      `
        query RuralProperty($carCode: String!) {
          ruralProperty(carCode: $carCode) {
            propertyCode
            areaHa
            alerts {
              alertCode
              areaHa
              detectedAt
              publishedAt
            }
          }
        }
      `,
      { carCode },
    );
    return response.data?.ruralProperty ?? null;
  } catch (error) {
    if (!isGraphqlFieldError(error)) throw error;
    const fallback = await queryMapBiomasGraphql<{ ruralProperty?: MapBiomasAlertDetails }>(
      `
        query RuralProperty($carCode: String!) {
          ruralProperty(carCode: $carCode) {
            propertyCode
            areaHa
            alerts {
              alertCode
              areaHa
              detectedAt
              publishedAt
              statusName
            }
            boundingBox
          }
        }
      `,
      { carCode },
    );
    return fallback.data?.ruralProperty ?? null;
  }
}

export async function getAlertByCodeWithFallback(alertCode: number, carCode?: string) {
  const scopedAlert = await getAlertByCode(alertCode, carCode);
  if (scopedAlert || !carCode) {
    logMapBiomasDev("mapbiomas.alert.lookup", {
      carCode: carCode ?? null,
      alertCode,
      scopedAlertNull: !scopedAlert,
      fallbackWithoutCarUsed: false,
      fallbackAlertNull: null,
    });
    return {
      alert: scopedAlert,
      fallbackWithoutCarUsed: false,
      scopedAlertWasNull: !scopedAlert,
    };
  }

  const fallbackAlert = await getAlertByCode(alertCode);
  logMapBiomasDev("mapbiomas.alert.lookup", {
    carCode,
    alertCode,
    scopedAlertNull: true,
    fallbackWithoutCarUsed: true,
    fallbackAlertNull: !fallbackAlert,
  });
  return {
    alert: fallbackAlert,
    fallbackWithoutCarUsed: true,
    scopedAlertWasNull: true,
  };
}

export async function getAlertReportLinkOrData(alertCode: number, carCode?: string) {
  const { alert, fallbackWithoutCarUsed, scopedAlertWasNull } =
    await getAlertByCodeWithFallback(alertCode, carCode);
  if (!alert) {
    return {
      alert: null,
      reportUrl: null,
      platformUrl: MAPBIOMAS_PLATFORM_URL,
      message: carCode
        ? "A API MapBiomas nao encontrou esse alerta para o CAR pesquisado. O alerta pode pertencer a outro imovel ou nao estar disponivel na API v2."
        : "A API MapBiomas nao encontrou esse alerta.",
    };
  }

  const reportUrl = extractReportUrl(alert);

  return {
    alert,
    reportUrl,
    platformUrl: MAPBIOMAS_PLATFORM_URL,
    message: buildAlertReportMessage({
      reportUrl: Boolean(reportUrl),
      fallbackWithoutCarUsed,
      scopedAlertWasNull,
    }),
  };
}

async function rawMapBiomasGraphql<T>({
  query,
  variables,
  token,
}: {
  query: string;
  variables: Record<string, unknown>;
  token: string | null;
}) {
  const response = await fetch(
    process.env.MAPBIOMAS_ALERT_API_URL ?? DEFAULT_MAPBIOMAS_ALERT_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new MapBiomasAuthError();
    }
    if (response.status >= 500) {
      throw new MapBiomasUnavailableError();
    }
    throw new Error(`MapBiomas Alerta retornou HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) {
    const message = payload.errors
      .map((item) => item.message)
      .filter(Boolean)
      .join("; ");
    if (/unauth|forbidden|invalid token|jwt|permiss|credencial/i.test(message)) {
      throw new MapBiomasAuthError();
    }
    throw new Error(`MapBiomas GraphQL: ${message}`);
  }

  return payload;
}

export function clearMapBiomasAlertTokenCacheForTests() {
  cachedToken = null;
  cachedTokenSource = null;
}

export function isMapBiomasAuthError(error: unknown) {
  return (
    error instanceof MapBiomasAuthError ||
    (error instanceof Error && error.name === "MapBiomasAuthError")
  );
}

export function isMapBiomasUnavailableError(error: unknown) {
  return (
    error instanceof MapBiomasUnavailableError ||
    (error instanceof Error && error.name === "MapBiomasUnavailableError")
  );
}

function canFallbackToSignIn() {
  return Boolean(
    process.env.MAPBIOMAS_ALERT_TOKEN &&
      process.env.MAPBIOMAS_ALERT_EMAIL &&
      process.env.MAPBIOMAS_ALERT_PASSWORD,
  );
}

function buildAlertReportMessage({
  reportUrl,
  fallbackWithoutCarUsed,
  scopedAlertWasNull,
}: {
  reportUrl: boolean;
  fallbackWithoutCarUsed: boolean;
  scopedAlertWasNull: boolean;
}) {
  if (fallbackWithoutCarUsed && scopedAlertWasNull) {
    return "A API MapBiomas nao encontrou este alerta para o CAR pesquisado, mas retornou dados do alerta sem o filtro de CAR.";
  }
  return reportUrl
    ? "Laudo ou arquivo encontrado na resposta da API MapBiomas Alerta."
    : "A API retornou os dados do laudo, mas nao forneceu arquivo PDF oficial. O GeoGestao pode gerar um PDF interno com esses dados.";
}

function logMapBiomasDev(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(message, payload);
}

function extractToken(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return looksLikeToken(value) ? value : null;
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["token", "accessToken", "access_token", "jwt"]) {
    const token = record[key];
    if (typeof token === "string" && looksLikeToken(token)) return token;
  }

  for (const nested of Object.values(record)) {
    const token = extractToken(nested);
    if (token) return token;
  }

  return null;
}

function looksLikeToken(value: string) {
  return value.trim().length > 20;
}

function extractReportUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(record)) {
    if (typeof child === "string" && isUrl(child) && /report|laudo|pdf|file|url/i.test(key)) {
      return child;
    }
    const nested = extractReportUrl(child);
    if (nested) return nested;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractReportUrl(item);
      if (nested) return nested;
    }
  }

  return null;
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGraphqlFieldError(error: unknown) {
  return (
    error instanceof Error &&
    /Cannot query field|Unknown argument|Field .* doesn't exist|Field must have selections/i.test(
      error.message,
    )
  );
}
