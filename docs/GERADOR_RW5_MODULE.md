# Modulo Gerador RW5

Fase: `MODULE-HUB-REAL-PORT-1`.

## Origem Auditada

ZIP auditado:

`Gerador_RW5_Local.zip`

Arquivos usados como referencia:

- `app/converter/detect.py`
- `app/converter/input_normalizer.py`
- `app/converter/parse_pts.py`
- `app/converter/parse_mc.py`
- `app/converter/parse_legacy.py`
- `app/converter/equipment.py`
- `app/converter/metrics.py`
- `app/converter/rw5_writer.py`

## Rota

- `/modulos/gerador-rw5`

## Funcional

- Upload de TXT/PTS/MC/CSV.
- Nome do RW5 de saida.
- CRS UTM de origem, com padrao `EPSG:31982`.
- Equipamento: Auto/detectar, CHC i93, CHC i83, CHC i50 ou manual.
- Tipo de antena RW5.
- Offset HR/antena.
- Previa com formato, encoding, delimitador, bases, pontos, antena e equipamento sugerido.
- Geracao e download `.rw5`.
- Historico por `module_rw5_jobs` quando migrations 045/046 estao aplicadas.

## Logica Portada

A versao TypeScript porta a normalizacao central do app Python:

- MC 19 colunas.
- PTS 24 colunas.
- Exportacao com 37 colunas.
- Layout legado com latitude/longitude.
- Deteccao de antena CHC.
- Metricas GNSS padrao quando o arquivo nao informa tudo.
- Writer com linhas `JB`, `MO`, `BP`, `GPS`, `G0`, `G1`, `G2`, `G3` e comentarios de qualidade.

Quando o arquivo nao traz latitude/longitude, o modulo converte UTM SIRGAS para coordenadas RW5 para EPSG:31982/31983 usando formula interna. Nao depende de `pyproj` dentro do Next.

## Limites

- A conversao cobre os layouts auditados, mas ainda deve ser validada com bases reais de campo antes de ser tratada como conversor definitivo.
- OCR, leitura binaria proprietaria e validadores de equipamento muito especificos ficam fora desta fase.

## Storage

- `organizations/{organization_id}/modules/gerador-rw5/{job_id}/original`
- `organizations/{organization_id}/modules/gerador-rw5/{job_id}/resultado.rw5`

## Como Testar

1. Abrir `/modulos/gerador-rw5`.
2. Enviar TXT/PTS/MC.
3. Conferir formato, base, pontos e antena detectados.
4. Ajustar CRS/equipamento/antena/offset se necessario.
5. Clicar `Gerar RW5`.
6. Baixar o arquivo `.rw5`.
