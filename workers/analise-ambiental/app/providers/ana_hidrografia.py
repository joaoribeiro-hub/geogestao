from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import urlretrieve
import shutil
import zipfile

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from app.config import Settings
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer


ANA_HIDRO_PROVIDER_KEY = "ana_hidrografia_oficial"
ANA_HIDRO_LAYER_KEY = "hidrografia_oficial"
ANA_HIDRO_LAYER_NAME = "Hidrografia oficial"
ANA_BHO6_SOURCE = "ANA/SNIRH BHO 6"
ANA_BHO6_VERSION = "6.2.4"
ANA_BHO6_CRS = "EPSG:4674"
ANA_BHO6_TARGET_FILE = "GEOFT_BHO_TRECHO_DRENAGEM.gpkg"


class AnaHidrografiaOficialProvider:
    provider_key = ANA_HIDRO_PROVIDER_KEY

    def __init__(self, *, settings: Settings) -> None:
        self.settings = settings

    def is_configured(self) -> bool:
        return _is_configured(self.settings)

    def analyze(self, aoi: AoiResult, requested_layers: list[str]) -> tuple[list[EnvironmentalLayer], list[str]]:
        if not wants_hidrografia_oficial(requested_layers):
            return [], []
        if not self.is_configured():
            return [], [
                "Provider Hidrografia oficial ANA/BHO6 não configurado no worker. Configure ANALISE_AMBIENTAL_HIDRO_PROVIDER=ana_bho6_gpkg e ANA_BHO6_TRECHO_DRENAGEM_URL ou ANA_BHO6_TRECHO_DRENAGEM_PATH."
            ]

        dataset_path = _ensure_bho6_dataset(self.settings)
        try:
            clipped = _read_and_clip_bho6(dataset_path, aoi)
        except Exception as exc:
            return [], [f"Falha ao processar hidrografia oficial ANA/BHO6: {exc}"]

        if clipped.empty:
            return [], ["Hidrografia oficial ANA/BHO6 consultada, mas nenhum trecho de drenagem intercepta a propriedade."]

        linework = _merge_linework(clipped.geometry)
        if linework.is_empty:
            return [], ["Hidrografia oficial ANA/BHO6 consultada, mas o recorte não gerou linhas válidas."]

        metrics = _measure_geometry(linework, aoi.metric_crs)
        names = _collect_names(clipped)
        feature_count = int(len(clipped))
        return [
            EnvironmentalLayer(
                key=ANA_HIDRO_LAYER_KEY,
                name=ANA_HIDRO_LAYER_NAME,
                geometry=linework,
                provider=self.provider_key,
                confidence="alta",
                official_data=True,
                area_ha=None,
                length_m=metrics["length_m"],
                metadata={
                    "source": ANA_BHO6_SOURCE,
                    "version": ANA_BHO6_VERSION,
                    "crs": ANA_BHO6_CRS,
                    "feature_count": feature_count,
                    "river_names": names,
                    "dataset": dataset_path.name,
                    "observation": "Hidrografia oficial vetorial da ANA/SNIRH BHO 6 recortada pela AOI.",
                    "color": "#2563eb",
                },
            )
        ], []


def wants_hidrografia_oficial(requested_layers: list[str]) -> bool:
    normalized = {item.strip().lower() for item in requested_layers if item.strip()}
    return bool(normalized.intersection({"hidrografia", "hidrografia_oficial", "ana_hidrografia_oficial"}))


def _is_configured(settings: Settings) -> bool:
    if settings.hidro_provider not in {"ana_bho6_gpkg", "ana_hidrografia_oficial"}:
        return False
    if settings.ana_bho6_trecho_drenagem_path and Path(settings.ana_bho6_trecho_drenagem_path).exists():
        return True
    return bool(settings.ana_bho6_trecho_drenagem_url)


def _ensure_bho6_dataset(settings: Settings) -> Path:
    configured_path = Path(settings.ana_bho6_trecho_drenagem_path) if settings.ana_bho6_trecho_drenagem_path else None
    if configured_path and configured_path.exists():
        return configured_path

    url = settings.ana_bho6_trecho_drenagem_url
    if not url:
        raise ValueError("ANA_BHO6_TRECHO_DRENAGEM_URL não configurada.")

    cache_dir = settings.ana_hidro_cache_dir
    cached_gpkg = cache_dir / ANA_BHO6_TARGET_FILE
    if cached_gpkg.exists():
        return cached_gpkg

    filename = _download_filename(url)
    download_path = cache_dir / filename
    if not download_path.exists():
        tmp_path = download_path.with_suffix(download_path.suffix + ".tmp")
        urlretrieve(url, tmp_path)
        tmp_path.replace(download_path)

    if download_path.suffix.lower() == ".zip":
        with zipfile.ZipFile(download_path) as archive:
            gpkg_names = [name for name in archive.namelist() if name.lower().endswith(".gpkg")]
            preferred = next((name for name in gpkg_names if Path(name).name.upper() == ANA_BHO6_TARGET_FILE), None)
            selected = preferred or (gpkg_names[0] if gpkg_names else None)
            if not selected:
                raise ValueError("Arquivo ZIP da ANA/BHO6 não contém GPKG.")
            archive.extract(selected, cache_dir)
            extracted = cache_dir / selected
            if extracted != cached_gpkg:
                cached_gpkg.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(extracted), cached_gpkg)
                _remove_empty_parents(extracted.parent, cache_dir)
        return cached_gpkg

    if download_path.suffix.lower() == ".gpkg":
        if download_path.name != ANA_BHO6_TARGET_FILE:
            shutil.copyfile(download_path, cached_gpkg)
            return cached_gpkg
        return download_path

    raise ValueError("ANA_BHO6_TRECHO_DRENAGEM_URL deve apontar para .gpkg ou .zip contendo GPKG.")


def _download_filename(url: str) -> str:
    parsed = urlparse(url)
    name = Path(parsed.path).name
    return name or ANA_BHO6_TARGET_FILE


def _remove_empty_parents(path: Path, stop_at: Path) -> None:
    current = path
    while current != stop_at and current.exists():
        try:
            current.rmdir()
        except OSError:
            return
        current = current.parent


def _read_and_clip_bho6(dataset_path: Path, aoi: AoiResult) -> gpd.GeoDataFrame:
    aoi_gdf = gpd.GeoDataFrame([{"id": "aoi"}], geometry=[aoi.geometry], crs="EPSG:4326").to_crs(ANA_BHO6_CRS)
    aoi_geom = aoi_gdf.geometry.iloc[0]
    min_x, min_y, max_x, max_y = aoi_geom.bounds
    gdf = gpd.read_file(dataset_path, bbox=(min_x, min_y, max_x, max_y))
    if gdf.empty:
        return gdf
    if gdf.crs is None:
        gdf = gdf.set_crs(ANA_BHO6_CRS)
    if str(gdf.crs).upper() != ANA_BHO6_CRS:
        gdf = gdf.to_crs(ANA_BHO6_CRS)
    intersecting = gdf[gdf.geometry.notna() & gdf.intersects(aoi_geom)].copy()
    if intersecting.empty:
        return intersecting
    clipped = gpd.clip(intersecting, aoi_gdf)
    if clipped.empty:
        return clipped
    return clipped.to_crs("EPSG:4326")


def _merge_linework(geometries: Any) -> BaseGeometry:
    lines: list[BaseGeometry] = []
    for geometry in geometries:
        lines.extend(_extract_linework(geometry))
    if not lines:
        return LineString()
    merged = unary_union(lines)
    if not merged.is_valid:
        merged = merged.buffer(0)
    return merged


def _extract_linework(geometry: BaseGeometry | None) -> list[BaseGeometry]:
    if geometry is None or geometry.is_empty:
        return []
    if isinstance(geometry, (LineString, MultiLineString)):
        return [geometry]
    if geometry.geom_type == "GeometryCollection":
        lines: list[BaseGeometry] = []
        for part in geometry.geoms:
            lines.extend(_extract_linework(part))
        return lines
    return []


def _measure_geometry(geometry: BaseGeometry, metric_crs: str) -> dict[str, float | None]:
    transformer = Transformer.from_crs("EPSG:4326", metric_crs, always_xy=True)
    metric_geometry = transform(transformer.transform, geometry)
    length_m = round(float(metric_geometry.length), 2) if metric_geometry.length > 0 else None
    return {"area_ha": None, "length_m": length_m}


def _collect_names(gdf: gpd.GeoDataFrame) -> list[str]:
    candidate_columns = [
        column
        for column in gdf.columns
        if column != "geometry" and ("nome" in column.lower() or "rio" in column.lower() or "curso" in column.lower())
    ]
    names: list[str] = []
    for column in candidate_columns:
        for value in gdf[column].dropna().tolist():
            text = str(value).strip()
            if text and text not in names:
                names.append(text)
            if len(names) >= 20:
                return names
    return names
