const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!folderId) {
  console.error("Defina GOOGLE_DRIVE_FOLDER_ID para apontar para a pasta bruta das bases.");
  process.exit(1);
}

console.log("Importacao direta do Drive esta preparada como etapa operacional futura.");
console.log(`Pasta configurada: ${folderId}`);
console.log("Nesta fase, baixe os ZIPs/GeoJSON do Drive, converta shapefiles para GeoJSON e rode import-geojson.ts.");
console.log("O Drive deve ser origem bruta dos arquivos, nunca a base consultada a cada busca.");
