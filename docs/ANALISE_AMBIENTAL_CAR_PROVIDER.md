# Provider CAR

## Princípio

O CAR é declaratório e não substitui MapBiomas ou validação técnica. Bases estaduais brutas não entram no repositório nem no Supabase Storage. O worker consulta somente recortes municipais publicados em FlatGeobuf por um manifest externo.

## Configuração

```env
CAR_PROVIDER_ENABLED=true
CAR_PROVIDER_MODE=manifest
CAR_SOURCE_MANIFEST_URL=https://storage.example/environmental_sources_manifest.json
CAR_CACHE_DIR=/tmp/car
CAR_MAX_DOWNLOAD_MB=300
CAR_MAX_AOI_HA=50000
CAR_ALLOW_FULL_STATE_DOWNLOAD=false
```

Hospede os FGB em Cloudflare R2, S3 compatível ou servidor que permita download autenticado/HTTPS. O cache do Render é temporário; a fonte externa continua sendo a origem persistente.

## Preparação

```powershell
python -m app.tools.prepare_car_base --input "C:\bases\car_go" --uf go --year 2024 --layer vegetacao_car_declarada --municipality-column cod_municipio --output ".data\environmental_sources"
```

O script normaliza para EPSG:4674, separa por município, grava FGB, contagem, bbox, tamanho e atualiza o manifest idempotentemente por UF/ano/município/camada. Sem código ou coluna municipal, ele recusa gerar uma base estadual única.
