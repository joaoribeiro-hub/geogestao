# Desenhar GEO

Fases: `FERRAMENTAS-HUB-1` e `TOOLS-NEXT-PHASES-1`.

Rota: `/ferramentas/desenhar-geo`.

## Objetivo

Reconstruir perímetros por:

- azimute + distância;
- rumo + distância;
- deflexão + distância.

## Decisões técnicas

- Azimute, rumo e deflexão definem direção, não georreferenciamento.
- Modo local usa `V01 = E 0 / N 0`.
- Modo georreferenciado exigirá coordenada inicial e CRS/EPSG informado.
- Não fixar zona UTM automaticamente.
- Não gerar KML falso com coordenadas `0,0`.
- DXF pode funcionar em modo local.
- DWG dependerá de conversor externo configurado, como ODA File Converter.

## Funcional agora

- Motor TypeScript testável para DMS, rumo quadrantal, deflexão, vértices e fechamento.
- Workspace com tabela editável de divisas.
- Cálculo local por azimute, rumo ou deflexão.
- Visualização SVG local/projetada.
- Tabelas de vértices e divisas calculadas.
- Download DXF inicial com camadas `PERIMETRO`, `VERTICES`, `ROTULOS_VERTICES` e `ROTULOS_DIVISAS`.
- KML continua bloqueado quando a referência espacial é local.

## Próxima fase

- Melhorar rótulos CAD, rotação de textos e blocos com atributos.
- Exportar KML apenas com CRS/coordenada inicial reais.
- Adicionar importação em massa de memorial.
- DWG com conversor ODA configurado.
