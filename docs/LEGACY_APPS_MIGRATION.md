# Migracao dos Apps Antigos

Fase: `MODULE-HUB-EXTERNAL-APPS-1`.

## MeuIMOVEL-CAR

Origem auditada:

`C:\Users\srlan\Documents\Codex\2026-05-15\MeuIMOVEL-CAR`

Stack:

- Next.js 15;
- React 19;
- Supabase SSR/JS;
- Leaflet;
- Tailwind.

Tela principal encontrada:

- `src/app/(app)/procurar-car/page.tsx`;
- componente principal `GeoQueryWorkspace`.

Dados/tabelas esperadas pelo app antigo:

- `profiles`;
- `organizations`;
- `clients`;
- `service_cards`;
- `properties`;
- `property_geometries`;
- `geo_data_sources`;
- `car_properties`;
- `incra_properties`;
- `geo_alert_layers`;
- `property_documents`;
- `property_searches`;
- `property_search_results`;
- RPCs `find_sigef_matches_by_car_app` e `find_alerts_by_car_app`.

Status:

- Rota `/modulos/meu-imovel-car` em beta.
- Busca inicial real usando bases GeoQuery/propriedades existentes.
- Migration `046_module_hub_real_port.sql` prepara `module_meu_imovel_queries` e `module_meu_imovel_alerts`.
- Vinculos completos com cliente/servico/documento continuam como proximo incremento.

## BuscaGEO

Origem auditada:

`C:\Users\srlan\Documents\Codex\2026-05-14\files-mentioned-by-the-user-buscar\BuscaGEO`

Stack:

- Next.js 15;
- React 19;
- FastAPI;
- processamento local com GDAL/CBERS.

Telas/rotas principais:

- `src/app/(app)/buscageo/page.tsx`;
- `src/components/buscageo/buscageo-workspace.tsx`;
- backend `backend/app/main.py`.

Fluxo:

- upload de KML/KMZ/Shapefile ZIP;
- preview de imagens CBERS;
- selecao de 1 ou 2 imagens;
- geracao de mosaico GeoTIFF final;
- armazenamento local temporario em `backend/storage/jobs/{jobId}`.

Schema opcional antigo:

- `buscageo_jobs`;
- `buscageo_images`.

Limitacao atual:

- O schema antigo usa `user_id`, nao `organization_id`.
- O processamento pesado ainda depende de backend separado.

Status:

- Rota `/modulos/buscageo` substituida por tela operacional em etapas.
- Upload e parametros criam job em `module_buscageo_jobs`.
- Arquivos seguem `organizations/{organization_id}/modules/buscageo/{job_id}/...`.
- Worker novo em `workers/buscageo` reaproveita `geo.py`, `cbers.py` e `mosaic.py`.
- Busca STAC, preview e GeoTIFF final rodam no worker FastAPI/GDAL, nao no app local antigo.
- Callback protegido atualiza o job no GeoGestao.

## App 2026-06-25

Origem auditada:

`C:\Users\srlan\Documents\Codex\2026-06-25\quero-criar-um-app-local-para\outputs\Gerador_RW5_Local`

Stack:

- Python;
- FastAPI;
- Jinja2;
- pyproj.

Nome real:

- Gerador RW5 Local.

Fluxo:

- upload de `.txt`;
- normalizacao do arquivo;
- geracao de `.rw5`;
- download do RW5 e TXT normalizado;
- arquivos salvos localmente em `data/jobs/{uuid}`.

Status:

- Rota beta `/modulos/gerador-rw5` e o modulo real.
- A rota antiga `/modulos/app-2026-06-25` nao aparece mais no seletor do hub.
- Parser/normalizador de MC 19, PTS 24, exportacao 37 colunas e legado foi portado para TypeScript.
- Writer RW5 gera blocos de base, GPS, G0/G1/G2/G3, antena/equipamento e metricas basicas.

## App 2026-05-29

Origem informada:

`C:\Users\srlan\Documents\Codex\2026-05-29`

Resultado da auditoria:

- Pasta nao encontrada neste ambiente.

Status:

- Criada rota `/modulos/app-2026-05-29` como indisponivel.
- Nenhuma tabela ou funcionalidade foi assumida sem auditoria.
