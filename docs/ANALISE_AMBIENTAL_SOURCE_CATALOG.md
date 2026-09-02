# Catálogo de Fontes Ambientais

| Fonte | Natureza | Persistência | Uso |
|---|---|---|---|
| MapBiomas/GEE | Classificação por sensoriamento remoto | Asset GEE configurado | Cobertura e uso do solo |
| CAR/SICAR/SIGCAR | Declaratória/cadastral | FGB municipal externo + manifest | AVN, RL, APP, área consolidada, reservatórios |
| ANA/SNIRH BHO6 | Vetorial oficial | GPKG configurado/cache do worker | Hidrografia oficial |
| BuscaGEO/GeoTIFF manual | Imagem recente | Storage privado da organização | NDVI e validação temporal |

## Manifest CAR

Cada entrada deve informar formato, URL/path, fonte, versão, escopo municipal, tamanho, bbox e contagem. O worker bloqueia base marcada como estadual quando `CAR_ALLOW_FULL_STATE_DOWNLOAD=false` e também bloqueia arquivos maiores que `CAR_MAX_DOWNLOAD_MB`.

## Revisão manual

Revise obrigatoriamente divergências, resultados de NDVI, CAR sem confirmação por imagem e qualquer análise com fonte ausente. CAR não é verdade absoluta; MapBiomas também pode conter erro temporal ou de classificação.
