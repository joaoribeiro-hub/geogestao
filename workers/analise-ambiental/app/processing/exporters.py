from __future__ import annotations

from pathlib import Path
from typing import Any
import json
import shutil
import tempfile
import zipfile

from shapely.geometry.base import BaseGeometry


def write_geojson(path: Path, geometry_geojson: dict[str, Any], properties: dict[str, Any] | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    feature = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": properties or {},
                "geometry": geometry_geojson,
            }
        ],
    }
    path.write_text(json.dumps(feature, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_kml(path: Path, geometry: BaseGeometry, name: str = "Limite da propriedade") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    coordinates = _geometry_coordinates_kml(geometry)
    kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{_xml_escape(name)}</name>
    {coordinates}
  </Document>
</kml>
"""
    path.write_text(kml, encoding="utf-8")
    return path


def write_json(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def write_shapefile_zip(
    zip_path: Path,
    geometry: BaseGeometry,
    properties: dict[str, Any] | None = None,
    crs: str = "EPSG:4326",
) -> Path:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="shp-export-") as tmp:
        tmp_path = Path(tmp)
        stem = zip_path.stem
        shp_path = tmp_path / f"{stem}.shp"
        _write_geopandas_shapefile(shp_path, geometry, properties or {}, crs)
        cpg_path = tmp_path / f"{stem}.cpg"
        if not cpg_path.exists():
            cpg_path.write_text("UTF-8", encoding="utf-8")
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file_path in tmp_path.glob(f"{stem}.*"):
                archive.write(file_path, arcname=file_path.name)
    return zip_path


def write_zip_package(zip_path: Path, files: dict[str, Path]) -> Path:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for relative_name, file_path in files.items():
            if file_path.exists():
                archive.write(file_path, arcname=relative_name)
    return zip_path


def _geometry_coordinates_kml(geometry: BaseGeometry) -> str:
    if geometry.geom_type == "Polygon":
        return _polygon_to_kml(geometry)
    if geometry.geom_type == "MultiPolygon":
        return "\n".join(_polygon_to_kml(polygon) for polygon in geometry.geoms)
    if geometry.geom_type == "LineString":
        return _line_to_kml(geometry)
    if geometry.geom_type == "MultiLineString":
        return "\n".join(_line_to_kml(line) for line in geometry.geoms)
    raise ValueError("KML de saida suporta Polygon/MultiPolygon/LineString/MultiLineString.")


def _polygon_to_kml(polygon: BaseGeometry) -> str:
    ring = " ".join(f"{x},{y},0" for x, y in polygon.exterior.coords)
    return f"""<Placemark>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>{ring}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>"""


def _line_to_kml(line: BaseGeometry) -> str:
    coordinates = " ".join(f"{x},{y},0" for x, y in line.coords)
    return f"""<Placemark>
      <LineString><coordinates>{coordinates}</coordinates></LineString>
    </Placemark>"""


def _write_geopandas_shapefile(
    shp_path: Path,
    geometry: BaseGeometry,
    properties: dict[str, Any],
    crs: str,
) -> None:
    import geopandas as gpd

    normalized_properties = {
        _shp_field_name(key): _shp_value(value)
        for key, value in properties.items()
        if isinstance(value, (str, int, float, bool)) or value is None
    }
    gdf = gpd.GeoDataFrame([normalized_properties], geometry=[geometry], crs=crs)
    gdf.to_file(shp_path, driver="ESRI Shapefile", encoding="UTF-8")


def _shp_field_name(value: str) -> str:
    normalized = "".join(char if char.isalnum() else "_" for char in value.lower())
    return (normalized or "campo")[:10]


def _shp_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return int(value)
    return value


def _xml_escape(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
