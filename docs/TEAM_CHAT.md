# Chat da Equipe

## Conceito

O Chat da equipe e um painel flutuante por organizacao. Ele fica separado do Assistente IA e do Checklist diario.

Todos os usuarios ativos da mesma organizacao podem enviar e ler mensagens. Usuarios de outra organizacao nao acessam mensagens, leituras ou contadores.

## Tabelas

- `team_chat_messages`: mensagens da organizacao, com remetente, texto e soft delete.
- `team_chat_reads`: ultimo horario de leitura por usuario e organizacao.
- `organization_activity_log`: registra envio de mensagem com preview seguro.

## Realtime e fallback

O widget assina Supabase Realtime em `team_chat_messages` filtrado por `organization_id`.

Tambem existe polling leve como fallback:

- quando o painel esta aberto, recarrega mensagens periodicamente;
- quando fechado, atualiza os badges periodicamente.

## Badges

O botao flutuante do Chat da equipe mostra:

- badge normal: mensagens nao lidas enviadas por membros/admins operacionais;
- badge vermelho: mensagens nao lidas enviadas pelo owner/proprietario.

Mensagens do proprio usuario nao contam como nao lidas. Ao abrir o chat, o app atualiza `team_chat_reads.last_read_at` e zera os badges ate chegarem novas mensagens.

Se `last_read_at` ainda nao existir, a contagem usa a data de entrada do usuario na organizacao como limite inicial.

## Seguranca

As policies da migration `029_team_comms_checklist_badges.sql` exigem:

- usuario autenticado;
- membership ativo na organizacao;
- `sender_user_id = auth.uid()` ao enviar;
- leitura somente da propria organizacao;
- soft delete apenas pelo remetente ou owner.

Nenhuma rota usa `service_role` no frontend.

## Assistente IA

Nesta fase, o Assistente IA nao consulta mensagens do Chat da equipe. As mensagens podem ser fonte futura de contexto interno, mas nao devem virar treinamento global nem exemplos de intents automaticamente.
