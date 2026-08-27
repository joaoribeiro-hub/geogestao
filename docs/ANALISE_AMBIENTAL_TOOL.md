# Análise Ambiental

Fases: `FERRAMENTAS-HUB-1` e `TOOLS-NEXT-PHASES-1`.

Rota: `/ferramentas/analise-ambiental`.

## Objetivo

Preparar o módulo de análise ambiental rural por KML/KMZ, com camadas de vegetação, corpos d'água, drenagens, hidrografia oficial e exportações geoespaciais.

## Diretrizes

- Frontend cria job e exibe status/resultado.
- Processamento raster pesado fica em worker Python.
- Não processar raster no navegador.
- Não usar Supabase Edge Function para GDAL/Rasterio/hidrologia pesada.
- Google Earth Engine passa a ser o provider real principal quando configurado no worker.
- MapBiomas User Toolkit é referência de GEE, assets/classes/paletas e exportação; não foi copiado como dependência funcional.
- Provider local por GeoTIFF/COG deve continuar possível.

## Funcional agora

- Upload de KML/KMZ/ZIP da área da propriedade.
- Validação de tamanho máximo de 50 MB.
- Arquivo salvo no bucket privado `documentos`.
- Criação de job em `module_environmental_analysis_jobs`.
- Status inicial `worker_pendente`.
- Histórico de jobs por `organization_id`.
- Acionamento manual do worker Python quando configurado.
- Consulta de status/progresso.
- Download de outputs por signed URL temporária.
- Worker Python separado em `workers/analise-ambiental`.
- Parser KML/KMZ/ZIP, cálculo de bbox/área, CRS métrico estimado e exportações base.
- Provider local `dev_fixture` para validar vegetação, água/represa e drenagem/córrego sem dados externos, sempre marcado como simulado.
- Provider `mapbiomas_gee` para buscar MapBiomas automaticamente no Earth Engine, recortar pela propriedade e vetorizar pixels por classe.
- Provider `ana_hidrografia_oficial` para recortar a BHO 6 da ANA/SNIRH e gerar hidrografia oficial vetorial quando o worker estiver configurado com o GPKG.
- Modo avançado com GeoTIFF manual continua disponível para teste/desenvolvimento.
- Outputs por camada com KML, GeoJSON e SHP.zip.
- Pacote completo `pacote_resultados.zip`.
- Sem integração externa fictícia.

Migration: `049_tools_next_phases.sql`.
Complemento do worker: `050_analise_ambiental_worker.sql`.
Complemento de camadas/outputs: `051_analise_ambiental_layers_outputs.sql`.
Complemento MapBiomas real: `052_analise_ambiental_mapbiomas_real.sql`.
Complemento GEE automático: `053_analise_ambiental_gee_auto.sql`.

## Próxima fase

- Implementar exportação assíncrona GEE para polígonos grandes que excedam `ee.Image.getDownloadURL`.
- Implementar hidrologia provável por DEM e fontes complementares. A hidrografia oficial ANA/BHO6 já é suportada via provider vetorial configurável.
- Validar com grandes polígonos e arquivos reais de produção.

## Teste MapBiomas/GEE real

Para testar o fluxo principal:

1. Configurar no worker `ANALISE_AMBIENTAL_PROVIDER=mapbiomas_gee`.
2. Configurar credenciais GEE e `MAPBIOMAS_10M_ASSET_ID`.
3. Abrir `/ferramentas/analise-ambiental`.
4. Enviar apenas o KML/KMZ/ZIP da propriedade.
5. Processar o job pelo worker.

O resultado real deve aparecer como `MapBiomas/GEE real`, com camadas separadas (`Vegetação nativa`, `Floresta`, `Agropecuária`, `Água`, `Área não vegetada`) e botões KML/GeoJSON/SHP por camada.

O campo GeoTIFF fica recolhido em `Modo avançado: usar GeoTIFF próprio` e não é parte do fluxo principal.

## Teste Hidrografia oficial ANA/BHO6

Para habilitar a opção `Hidrografia oficial` na tela:

```env
ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg
ANA_BHO6_TRECHO_DRENAGEM_PATH=C:\bases\ana\GEOFT_BHO_TRECHO_DRENAGEM.gpkg
```

Ou configure `ANA_BHO6_TRECHO_DRENAGEM_URL` para um `.gpkg` ou `.zip` contendo o GPKG. O worker baixa uma vez para `ANA_HIDRO_CACHE_DIR` e reutiliza.

Ao selecionar `Hidrografia oficial`, o worker:

1. reprojeta a AOI para `EPSG:4674`;
2. abre `GEOFT_BHO_TRECHO_DRENAGEM.gpkg`;
3. filtra por bbox;
4. recorta/intersecta pela propriedade;
5. gera `hidrografia_oficial.kml`, `hidrografia_oficial.geojson` e `hidrografia_oficial.shp.zip`.

O relatório JSON deve mostrar fonte `ANA/SNIRH BHO 6`, versão `6.2.4` e provider `ana_hidrografia_oficial`.

`Água` e `Hidrografia oficial` são camadas diferentes: `Água` é classificação raster MapBiomas; `Hidrografia oficial` é vetor oficial ANA/BHO6.
