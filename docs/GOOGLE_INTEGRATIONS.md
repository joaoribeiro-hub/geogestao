# Google Integrations

Atualizacao `AGENTS-TASKS-SYNC-FIX-1`: se as variaveis Google nao existem no servidor, Minha Conta mostra uma mensagem amigavel em vez de JSON cru. Isso e configuracao do Google Cloud/OAuth e do ambiente do projeto, nao configuracao do Supabase Auth.

Redirects OAuth recomendados:

- local: `http://localhost:3000/api/integrations/google/callback`
- producao: `https://DOMINIO/api/integrations/google/callback`

Variaveis server-side:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Fase: `INTEGRATIONS-AGENTS-TASKS-IMPORT-1`.

O GeoGestao mantém Supabase Storage como armazenamento principal. Google Drive e Google Calendar são integrações opcionais por usuário.

## Variáveis

Server-side only:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`

Nunca usar essas variáveis com prefixo `NEXT_PUBLIC_`.

## Rotas

- `/api/integrations/google/connect?provider=google_drive`
- `/api/integrations/google/connect?provider=google_calendar`
- `/api/integrations/google/callback`
- `/api/integrations/google/disconnect`
- `/api/integrations/google/status`
- `/api/integrations/google/drive/quota`
- `/api/integrations/google/drive/upload`
- `/api/integrations/google/drive/download`

## Segurança

Tokens OAuth ficam em `user_integrations` criptografados com AES-GCM. O frontend recebe apenas status, e-mail da conta e ações de conectar/desconectar.

## Drive

Quando o usuário escolhe Google Drive no upload de documentos, o backend valida organização, permissão, MIME e tamanho. O arquivo é enviado ao Drive conectado do usuário e os metadados ficam em `documents`.

Pasta raiz:

`GeoGestao/organizations/{organization_id}/...`

Download por outro membro da mesma empresa passa pelo backend, que valida `organization_id` e usa a integração do dono do arquivo. O arquivo não vira público.

## Calendar

Lembretes internos continuam no Supabase. Quando destinatários possuem Google Calendar conectado, o backend tenta criar evento no calendário primário de cada usuário e registra resultado em `calendar_event_syncs`.

Falha de sync não bloqueia o lembrete interno.
