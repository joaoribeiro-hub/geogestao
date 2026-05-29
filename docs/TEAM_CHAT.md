# Chat da Equipe

## Conceito

O Chat da equipe e um painel flutuante por organizacao. Ele fica separado do Assistente IA e do Checklist diario.

Todos os usuarios ativos da mesma organizacao podem enviar e ler mensagens. Usuarios de outra organizacao nao acessam mensagens, leituras ou contadores.

O painel tem dois modos:

- `Geral da empresa`: conversa aberta para todos os membros ativos da organizacao.
- `Direto`: conversa privada entre o usuario logado e um membro especifico da mesma organizacao.

## Tabelas

- `team_chat_messages`: mensagens da organizacao, com remetente, texto, escopo `general` ou `direct`, destinatario direto opcional, `conversation_key` e soft delete.
- `team_chat_reads`: ultimo horario de leitura por usuario, organizacao e `conversation_key`.
- `organization_activity_log`: registra envio de mensagem com preview seguro.

Conversas gerais usam `conversation_key = general`.

Conversas diretas usam chave estavel no formato:

```text
direct:<menor_user_id>:<maior_user_id>
```

## Realtime e fallback

O widget assina Supabase Realtime em `team_chat_messages` filtrado por `organization_id`.

Tambem existe polling leve como fallback:

- quando o painel esta aberto, recarrega mensagens periodicamente;
- quando fechado, atualiza os badges periodicamente.

## Badges

O botao flutuante do Chat da equipe mostra:

- badge normal: mensagens nao lidas enviadas por membros/admins operacionais;
- badge vermelho: mensagens nao lidas enviadas pelo owner/proprietario.

Mensagens do proprio usuario nao contam como nao lidas. Ao abrir uma conversa, o app atualiza `team_chat_reads.last_read_at` apenas daquela `conversation_key`. Assim, abrir o geral nao zera uma conversa direta que ainda nao foi aberta.

Se `last_read_at` ainda nao existir, a contagem usa a data de entrada do usuario na organizacao como limite inicial.

Os badges contam mensagens nao lidas tanto do geral quanto das conversas diretas visiveis para o usuario.

## Filtro de data

O painel abre por padrao em `Hoje`.

Filtros disponiveis:

- Hoje;
- Ontem;
- Data personalizada.

O filtro vale para conversa geral e direta. Badges de nao lidas continuam independentes do filtro visual, porque representam tudo que chegou depois da ultima leitura de cada conversa.

## Seguranca

As policies das migrations `029_team_comms_checklist_badges.sql` e `031_notifications_chat_direct_refine.sql` exigem:

- usuario autenticado;
- membership ativo na organizacao;
- `sender_user_id = auth.uid()` ao enviar;
- leitura do geral apenas para membros da propria organizacao;
- leitura de conversa direta apenas para remetente ou destinatario;
- direct somente para membro ativo da mesma organizacao;
- soft delete pelo remetente; owner tambem pode moderar mensagens gerais.

Nenhuma rota usa `service_role` no frontend.

## Assistente IA

Nesta fase, o Assistente IA nao consulta mensagens do Chat da equipe. As mensagens podem ser fonte futura de contexto interno, mas nao devem virar treinamento global nem exemplos de intents automaticamente.
