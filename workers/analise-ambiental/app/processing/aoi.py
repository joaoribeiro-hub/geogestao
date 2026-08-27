from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
import math
import zipfile

from pyproj import CRS, Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union


@dataclass(frozen=True)
class AoiResult:
    geometry: BaseGeometry
    geometry_geojson: dict[str, Any]
    bbox: list[float]
    area_m2: float
    area_ha: float
    metric_crs: str


def parse_aoi_file(path: Path) -> AoiResult:
    kml_text = _read_kml_text(path)
    geometry = _geometry_from_kml(kml_text)
    if geometry.is_empty:
        raise ValueError("AOI vazia ou sem poligono valido.")
    if geometry.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError("A AOI precisa ser Polygon ou MultiPolygon.")
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    if geometry.is_empty or not geometry.is_valid:
        raise ValueError("Poligono invalido no KML/KMZ/ZIP.")

    bbox = [float(value) for value in geometry.bounds]
    metric_crs = estimate_metric_crs(geometry)
    transformer = Transformer.from_crs("EPSG:4326", metric_crs, always_xy=True)
    metric_geometry = transform(transformer.transform, geometry)
    area_m2 = float(metric_geometry.area)
    return AoiResult(
        geometry=geometry,
        geometry_geojson=mapping(geometry),
        bbox=bbox,
        area_m2=area_m2,
        area_ha=round(area_m2 / 10_000, 4),
        metric_crs=metric_crs,
    )


def estimate_metric_crs(geometry: BaseGeometry) -> str:
    centroid = geometry.centroid
    lon = float(centroid.x)
    lat = float(centroid.y)
    zone = int(math.floor((lon + 180) / 6) + 1)
    epsg = 32700 + zone if lat < 0 else 32600 + zone
    CRS.from_epsg(epsg)
    return f"EPSG:{epsg}"


def _read_kml_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".kml":
        return path.read_text(encoding="utf-8-sig")
    if suffix in {".kmz", ".zip"}:
        with zipfile.ZipFile(path) as archive:
            kml_names = [name for name in archive.namelist() if name.lower().endswith(".kml")]
            if not kml_names:
                raise ValueError("Arquivo ZIP/KMZ sem KML interno.")
            with archive.open(kml_names[0]) as kml_file:
                return kml_file.read().decode("utf-8-sig")
    raise ValueError("Formato nao suportado. Envie KML, KMZ ou ZIP.")


def _geometry_from_kml(kml_text: str) -> BaseGeometry:
    root = ElementTree.fromstring(kml_text)
    polygons: list[Polygon] = []
    for coordinates in root.iter():
        if _local_name(coordinates.tag) != "coordinates" or not coordinates.text:
            continue
        ring = _parse_coordinates(coordinates.text)
        if len(ring) >= 4 and ring[0] == ring[-1]:
            polygon = Polygon(ring)
            if polygon.is_valid and polygon.area > 0:
                polygons.append(polygon)
    if not polygons:
        raise ValueError("Nenhum poligono KML reconhecido.")
    merged = unary_union(polygons)
    if isinstance(merged, Polygon):
        return merged
    if isinstance(merged, MultiPolygon):
        return merged
    return shape(mapping(merged)).buffer(0)


def _parse_coordinates(text: str) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for raw_point in text.replace("\n", " ").replace("\t", " ").split():
        pieces = raw_point.split(",")
        if len(pieces) < 2:
            continue
        try:
            points.append((float(pieces[0]), float(pieces[1])))
        except ValueError:
            continue
    if points and points[0] != points[-1]:
        points.append(points[0])
    return points


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag
