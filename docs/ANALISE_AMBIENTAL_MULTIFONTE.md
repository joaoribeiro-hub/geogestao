# Análise Ambiental Multifonte

## Arquitetura

O worker mantém cada fonte separada e aplica `app/fusion/fusion_engine.py` somente às geometrias realmente geradas:

- MapBiomas/GEE: observação/classificação de cobertura, peso base 0,75.
- CAR/SICAR/SIGCAR: dado cadastral declaratório, peso base 0,65.
- ANA/BHO6: hidrografia oficial, peso base 0,95.
- Imagem atual: NDVI inicial, peso base 0,65; Dynamic World e modelos futuros ficam explícitos no catálogo.

Concordância não apaga a camada original. Divergência gera `vegetacao_divergencia`, `conflito_ambiental` ou `possivel_app_hidrica_ausente` e exige revisão.

## Outputs

O pacote mantém KML, GeoJSON e SHP.zip por fonte e adiciona `vegetacao_final`, níveis de confiança, divergências e `relatorio_multifonte.json`. O relatório inclui áreas por fonte, metodologia, limitações, resumo da fusão e resumo das amostras de treino.

## Treinamento futuro

Consenso forte cria candidato SILVER. Divergências são DISPUTED. A validação humana transforma amostras em GOLD; correções guardam a classe corrigida e o usuário que validou. O endpoint `/api/analise-ambiental/training-dataset/export` entrega `labels.geojson`, `manifest.json`, `raster_index.json` e `metadata.json` em ZIP.

Esta fase não treina modelo, não exige GPU e não ativa SAMGeo/Raster Vision.
