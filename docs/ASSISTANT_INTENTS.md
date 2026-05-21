# Assistente IA - Base Privada de Intents

## Objetivo

A fase `AI-ASSISTANT-INTENTS-1` permite importar exemplos reais de frases/intents para o Assistente IA do GeoGestao.

Essa base ajuda o app a reconhecer pedidos como servicos de hoje, resumo de cliente, tarefas, interacoes, financeiro, propostas, contratos, documentos e comandos parecidos.

## Segurança

- Nao commitar arquivos reais de frases/intents.
- Nao colocar o conteudo do dataset no frontend.
- Nao enviar o dataset inteiro para Gemini, OpenAI ou outro provedor.
- Usar `SUPABASE_SERVICE_ROLE_KEY` somente em scripts admin locais.
- O Assistente consulta poucos exemplos relevantes por mensagem, normalmente ate 12.
- Dados reais devem ficar em pasta privada, por exemplo `data/private/assistant/`.

O `.gitignore` bloqueia:

```txt
data/private/
*.local.txt
geogestao_assistente_frases_*.txt
```

## Migration

Execute no Supabase de teste:

```sql
-- supabase/migrations/022_assistant_intent_examples_dataset.sql
```

Ela cria/ajusta:

- `assistant_intents.category`
- `assistant_intents.updated_at`
- `assistant_intent_examples`
- `assistant_dataset_imports`
- indices para busca textual
- RLS basica para escrita/admin e busca controlada via RPC limitada
- funcao `find_assistant_intent_examples`, que retorna poucos exemplos similares para o servidor

## Formato aceito

O importador aceita formatos tolerantes:

- TSV/CSV com cabecalho, como `Frase`, `Sinonimo`, `Funcao`
- JSONL
- linhas `frase -> intent`
- linhas `texto: ... | intent: ...`
- frase sem intent, salva como `pendente_classificacao`

## Dry-run

No PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto-de-teste.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="sua-service-role-do-projeto-de-teste"
npm run assistant:import-intents -- --file="data/private/assistant/geogestao_assistente_frases_30000.txt" --dry-run
```

No CMD:

```bat
set NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-de-teste.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-do-projeto-de-teste
npm run assistant:import-intents -- --file=data/private/assistant/geogestao_assistente_frases_30000.txt --dry-run
```

Dry-run nao grava dados.

## Importar de verdade

Depois de conferir o dry-run:

```powershell
npm run assistant:import-intents -- --file="data/private/assistant/geogestao_assistente_frases_30000.txt" --confirm
```

O script deduplica por `intent_id + normalized_text + source`.

## Conferir no Supabase

```sql
select count(*) from public.assistant_intent_examples;

select i.name, count(e.id) as exemplos
from public.assistant_intents i
left join public.assistant_intent_examples e on e.intent_id = i.id
group by i.name
order by exemplos desc;

select *
from public.assistant_dataset_imports
order by imported_at desc
limit 5;
```

## Uso pelo Assistente

O fluxo e:

1. O usuario envia mensagem.
2. O detector local roda primeiro.
3. Se a confianca local for alta, executa sem Gemini.
4. Se precisar de Gemini, a API busca poucos exemplos similares no Supabase via `find_assistant_intent_examples`.
5. Gemini classifica intent e parametros, sem executar SQL.
6. A action registry executa somente acoes permitidas.

O modelo externo nunca recebe a base completa.

## Feedback sanitizado

Correcoes feitas pelo botao "Nao" geram dois registros:

1. feedback bruto em `assistant_feedback`, privado da organizacao;
2. exemplo global sanitizado em `assistant_global_learning_examples`, com dados reais substituidos por placeholders como `[MEMBRO]`, `[CLIENTE]`, `[IMOVEL]`, `[VALOR]`, `[DATA]`, `[EMAIL]` e `[DOCUMENTO]`.

Esses exemplos globais podem orientar a deteccao de intents para todas as empresas sem expor dados privados.
