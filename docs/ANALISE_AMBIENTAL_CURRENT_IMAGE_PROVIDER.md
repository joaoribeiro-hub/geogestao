# Provider de Imagem Atual

O provider aceita GeoTIFF enviado no job ou procura o resultado recente do BuscaGEO cuja bbox intersecte a AOI e pertença à mesma organização. O arquivo continua no Storage privado; o worker baixa apenas o raster selecionado para o diretório temporário.

```env
CURRENT_IMAGE_PROVIDER_ENABLED=true
CURRENT_IMAGE_SOURCE_PRIORITY=meuimovel,buscageo,dynamic_world,manual
CURRENT_IMAGE_NIR_BAND=4
CURRENT_IMAGE_RED_BAND=3
NDVI_VEGETATION_THRESHOLD=0.35
DYNAMIC_WORLD_ENABLED=false
DYNAMIC_WORLD_MIN_PROBABILITY=0.55
```

O motor ativo `rule_based_ndvi` exige bandas NIR e Red. RGB puro não é promovido silenciosamente a classificação de vegetação. Com `DYNAMIC_WORLD_ENABLED=true` e credenciais GEE válidas, o worker usa a média das probabilidades dos últimos 90 dias, mascara pixels abaixo de `DYNAMIC_WORLD_MIN_PROBABILITY` e vetoriza água, vegetação, cultivo e solo exposto.

Referência oficial do catálogo Dynamic World: https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1
