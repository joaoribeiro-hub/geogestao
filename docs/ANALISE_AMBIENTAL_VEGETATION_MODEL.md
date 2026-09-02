# Motor de Vegetação

`vegetation_model_provider.py` define o contrato `is_available`, `predict` e `metadata`.

- `rule_based_ndvi`: ativo, leve e sem GPU.
- `dynamic_world`: ativo quando habilitado e com credenciais GEE; usa probabilidades médias e exportação recortada da AOI.
- `samgeo_experimental`: catalogado e desativado.
- `custom_trained_model`: preparado, desativado por padrão.
- `rastervision_future`: catalogado para o ciclo de treino futuro.

```env
VEGETATION_MODEL_PROVIDER=rule_based_ndvi
VEGETATION_SEGMENTER_PROVIDER=
GEOAI_ENABLED=false
CUSTOM_VEGETATION_MODEL_ENABLED=false
CUSTOM_VEGETATION_MODEL_PATH=
CUSTOM_VEGETATION_MODEL_VERSION=
```

Referências avaliadas:

- SAMGeo/segment-geospatial: https://github.com/opengeos/segment-geospatial
- GeoAI: https://github.com/opengeos/geoai
- Raster Vision: https://github.com/azavea/raster-vision
- Documentação Raster Vision: https://docs.rastervision.io/en/latest/

Nenhuma dessas dependências pesadas é instalada ou ativada no Render Free nesta fase.
