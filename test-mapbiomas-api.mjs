const API =
  process.env.MAPBIOMAS_ALERT_API_URL ||
  "https://plataforma.alerta.mapbiomas.org/api/v2/graphql";

const EMAIL = process.env.MAPBIOMAS_ALERT_EMAIL || "";
const PASSWORD = process.env.MAPBIOMAS_ALERT_PASSWORD || "";
let TOKEN = process.env.MAPBIOMAS_ALERT_TOKEN || "";

const carCode = process.argv[2];
const alertCodeArg = process.argv[3];

console.log("Script iniciou");
console.log("API:", API);
console.log("CAR:", carCode || "(não informado)");
console.log("ALERTA:", alertCodeArg || "(não informado)");
console.log("Token fixo:", TOKEN ? "sim" : "não");

if (!carCode) {
  console.error("Uso: node test-mapbiomas-api.mjs CODIGO_DO_CAR [CODIGO_DO_ALERTA]");
  process.exit(1);
}

async function graphql(query, variables = {}, token = TOKEN) {
  const headers = { "Content-Type": "application/json" };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log("HTTP:", response.status);
    console.log("Resposta bruta:", text.slice(0, 1000));
    throw new Error("Resposta não veio em JSON");
  }

  return { status: response.status, json };
}

async function signIn() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("MAPBIOMAS_ALERT_EMAIL ou MAPBIOMAS_ALERT_PASSWORD não configurado.");
  }

  const query = `
    mutation SignIn($email: String!, $password: String!) {
      signIn(email: $email, password: $password) {
        token
      }
    }
  `;

  const result = await graphql(query, { email: EMAIL, password: PASSWORD }, "");

  console.log("HTTP signIn:", result.status);

  if (result.json.errors) {
    console.log("Erros signIn:");
    console.dir(result.json.errors, { depth: null });
    throw new Error("signIn falhou");
  }

  TOKEN = result.json?.data?.signIn?.token;

  if (!TOKEN) {
    console.log("Resposta signIn:");
    console.dir(result.json, { depth: null });
    throw new Error("signIn não retornou token");
  }

  console.log("signIn OK. Token recebido.");
}

async function testRuralProperty() {
  const query = `
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
  `;

  return graphql(query, { carCode });
}

async function testAlertDetail(alertCode, useCarCode) {
  const query = `
    query AlertDetail($alertCode: Int!, $carCode: String) {
      alert(alertCode: $alertCode, carCode: $carCode) {
        alertCode
        areaHa
        detectedAt
        publishedAt
        ruralPropertiesCodes
        ruralPropertiesTotal
      }
    }
  `;

  return graphql(query, {
    alertCode: Number(alertCode),
    carCode: useCarCode ? carCode : null,
  });
}

async function main() {
  if (!TOKEN) {
    console.log("Sem token fixo. Tentando login por email/senha...");
    await signIn();
  }

  console.log("\n=== Testando ruralProperty(carCode) ===");
  const rural = await testRuralProperty();

  console.log("HTTP ruralProperty:", rural.status);
  console.dir(rural.json, { depth: null });

  if (rural.json.errors) {
    console.log("A query ruralProperty falhou.");
    return;
  }

  const alerts = rural.json?.data?.ruralProperty?.alerts || [];
  console.log("\nQuantidade de alertas retornados:", alerts.length);

  const alertCode = alertCodeArg || alerts?.[0]?.alertCode;

  if (!alertCode) {
    console.log("Nenhum alertCode encontrado para testar detalhe.");
    return;
  }

  console.log(`\n=== Testando alert(alertCode, carCode): ${alertCode} ===`);
  let detail = await testAlertDetail(alertCode, true);

  console.log("HTTP alert com CAR:", detail.status);
  console.dir(detail.json, { depth: null });

  if (detail.json.errors) {
    console.log("\nFalhou com CAR. Tentando alert(alertCode) sem CAR...");
    detail = await testAlertDetail(alertCode, false);

    console.log("HTTP alert sem CAR:", detail.status);
    console.dir(detail.json, { depth: null });
  }
}

main().catch((error) => {
  console.error("\nFALHA:");
  console.error(error.message || error);
  process.exit(1);
});