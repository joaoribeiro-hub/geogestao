# Modulo Gerador RW5

Fase atual: logica final por arquivo isolado, baseada em `PROMPT_CODEX_RW5_LOGICA_FINAL.md`.

## Rota e fluxo

- Rota: `/modulos/gerador-rw5`.
- Entrada: um arquivo TXT, PTS, MC, CSV ou XLSX por conversao.
- A tela exige nome da obra, data/hora de criacao, software version, CRS e perfil de equipamento.
- A previa mostra formato, modo de base, ID preservado, pontos, equipamento sugerido, coordenadas e TDOP calculados.
- A geracao devolve o RW5 e um relatorio estruturado de validacao.
- Apos gerar, `Baixar latitude / longitude` baixa um TXT tabulado com `Nome`, `latitude` e `longitude`. Os valores sao exatamente os mesmos `LA`/`LN` usados no RW5, incluindo a conversao UTM quando a entrada nao fornece coordenadas validas.

## Parser

O parser reconhece os layouts TXT auditados e o XLSX final de 24 colunas. A leitura XLSX respeita referencias de celula, inclusive celulas vazias autocontidas, para impedir deslocamento entre Codigo, metricas, RECPTOR, HR e horarios.

A primeira base valida decide o modo:

- `B_...`: `registered_base`, com `--Base Configuration by Local Coordinate`;
- `base_...`: `linked_base`, sem o bloco de configuracao da base.

O ID e preservado exatamente. Pontos e metadados nunca sao completados a partir de outro arquivo.

## Coordenadas e qualidade

- Entrada padrao: `EPSG:31982`; `EPSG:31983` tambem pode ser selecionado.
- Latitude/longitude ausentes sao calculadas da UTM e escritas como DMS compacto RW5 com 12 casas.
- `GPS EL` usa 6 casas; `--GS` usa N/E/H com 4 casas.
- HDOP, VDOP, PDOP e AGE Avg usam 4 casas e nao incluem SD.
- TDOP e calculado por `sqrt(GDOP^2 - PDOP^2)` somente quando nao veio no arquivo.
- AGE ausente so recebe valor quando o usuario informa o padrao; nunca e preenchido silenciosamente com zero.

## Equipamentos

Os perfis ficam em `src/lib/modules/rw5/equipment_profiles.json` e sao selecionados por chave unica com modelo e serial. SN e firmware nao sao deduzidos do ID da base.

Perfis confirmados e completos:

- i83 / SN 4005499 / FW 1.3.8;
- i93 / SN 3247131 / FW 2.2.2.1;
- i93 / SN 3905877 / FW 1.3.8.2.

O laudo confirma os seriais i50 3399386 e 3400353, mas nao informa firmware. Esses perfis permanecem bloqueados para writer ate o FW ser cadastrado. O perfil i90/SN 3781866 vindo do RW5 de referencia exige selecao explicita porque o laudo associa o mesmo serial ao i93.

## Validacao

O relatorio inclui arquivo, modo, base, linhas lidas/ignoradas, pontos, perfis, data da obra, primeira medicao, quantidade de LA/LN e TDOP calculados, AGE padrao, avisos e erros bloqueantes.

Bloqueiam a geracao: base ausente, ponto invalido, campos obrigatorios da obra ausentes, perfil ambiguo/inexistente ou perfil sem SN/FW e parametros de antena.

## Storage

- `organizations/{organization_id}/modules/gerador-rw5/{job_id}/original`
- `organizations/{organization_id}/modules/gerador-rw5/{job_id}/resultado.rw5`

## Como testar

1. Abra `/modulos/gerador-rw5` e envie apenas um arquivo.
2. Clique em `Pre-visualizar` e confira `registered_base`/`linked_base`, ID, receptor e pontos.
3. Informe nome e data/hora da obra e selecione o perfil exato do rover e, em `B_`, da base.
4. Gere e baixe o RW5.
5. Em `B_`, confirme Base Configuration e ID original em G0/G1; em `base_`, confirme que o bloco nao existe.
6. Para i50 sem firmware, confirme o bloqueio de validacao em vez de `SN/FW` inventado.

Nao houve alteracao de banco nesta fase.
