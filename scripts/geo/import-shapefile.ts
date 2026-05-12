console.log("Importacao de shapefile completo preparada para GEOQUERY-1.");
console.log("Fluxo recomendado nesta fase:");
console.log("1. Baixe o ZIP da base no Google Drive.");
console.log("2. Garanta que o ZIP contem .shp, .shx, .dbf e .prj.");
console.log("3. Converta para GeoJSON com ogr2ogr ou ferramenta GIS confiavel.");
console.log("4. Rode scripts/geo/import-geojson.ts para normalizar atributos e gerar a previa.");
console.log("5. Importe a previa para as tabelas GeoQuery no Supabase de teste.");
