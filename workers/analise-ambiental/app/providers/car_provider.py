from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import json
import shutil

import geopandas as gpd
from shapely.ops import unary_union

from app.config import Settings
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer
from app.providers.mapbiomas_real import _measure_geometry


CAR_LAYER_NAMES = {
    "vegetacao_car_declarada": "Vegetação declarada no CAR",
    "area_consolidada_car": "Área consolidada declarada no CAR",
    "reserva_legal_car": "Reserva Legal declarada no CAR",
    "app_car": "APP declarada no CAR",
    "app_hidrica_car": "APP hídrica declarada no CAR",
    "nascente_car": "Nascente declarada no CAR",
    "reservatorio_car": "Reservatório declarado no CAR",
    "curso_dagua_car": "Curso d'água declarado no CAR",
}


class CarProvider:
    provider_key = "car_manifest"

    def __init__(self, *, settings: Settings) -> None:
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(
            self.settings.car_provider_enabled
            and self.settings.car_provider_mode == "manifest"
            and self.settings.car_source_manifest_url
        )

    def analyze(
        self,
        aoi: AoiResult,
        requested_layers: list[str],
        source_options: dict[str, Any] | None = None,
    ) -> tuple[list[EnvironmentalLayer], list[str], str | None]:
        if not self.is_configured():
            return [], ["Provider CAR não configurado. Configure CAR_SOURCE_MANIFEST_URL no worker."], None
        if aoi.area_ha > self.settings.car_max_aoi_ha:
            return [], [f"AOI excede o limite do provider CAR ({self.settings.car_max_aoi_ha:g} ha)."], None

        options = source_options or {}
        uf = str(options.get("car_uf") or options.get("uf") or "").strip().lower()
        year = str(options.get("car_year") or options.get("year") or "").strip()
        municipality = str(options.get("car_municipality_code") or options.get("municipality_code") or "").strip()
        if not uf or not year or not municipality:
            return [], ["Para consultar o CAR via manifest, informe UF, ano e código IBGE do município."], None

        manifest = _load_json(self.settings.car_source_manifest_url)
        layer_entries = (((manifest.get("car") or {}).get(uf) or {}).get(year) or {}).get(municipality) or {}
        if not isinstance(layer_entries, dict) or not layer_entries:
            return [], [f"Manifest CAR sem arquivos para {uf.upper()}/{year}/{municipality}."], str(manifest.get("version") or year)

        requested = _requested_car_layers(requested_layers)
        layers: list[EnvironmentalLayer] = []
        warnings: list[str] = []
        for layer_key, entry in layer_entries.items():
            if layer_key not in CAR_LAYER_NAMES or (requested and layer_key not in requested):
                continue
            if not isinstance(entry, dict):
                continue
            try:
                dataset_path = _resolve_dataset(entry, self.settings)
                clipped = _read_clip(dataset_path, aoi)
                if clipped.empty:
                    continue
                geometry = unary_union([geom for geom in clipped.geometry if geom is not None and not geom.is_empty])
                if geometry.is_empty:
                    continue
                if geometry.geom_type not in {"LineString", "MultiLineString"}:
                    geometry = geometry.buffer(0)
                metrics = _measure_geometry(geometry, aoi.metric_crs)
                layers.append(EnvironmentalLayer(
                    key=layer_key,
                    name=CAR_LAYER_NAMES[layer_key],
                    geometry=geometry,
                    provider=self.provider_key,
                    confidence="declaratória",
                    official_data=False,
                    area_ha=metrics["area_ha"],
                    length_m=metrics["length_m"],
                    metadata={
                        "source": entry.get("source") or "SICAR/SIGCAR",
                        "version": entry.get("version") or year,
                        "manifest": self.settings.car_source_manifest_url,
                        "municipality_code": municipality,
                        "feature_count": int(len(clipped)),
                        "declaratory_data": True,
                        "confidence_score": 0.65,
                    },
                ))
            except Exception as exc:
                warnings.append(f"Falha na camada CAR {layer_key}: {exc}")
        return layers, warnings, str(manifest.get("version") or year)


def _load_json(location: str) -> dict[str, Any]:
    local = Path(location.removeprefix("file://"))
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    with urlopen(location, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def _resolve_dataset(entry: dict[str, Any], settings: Settings) -> Path:
    location = str(entry.get("url") or entry.get("path") or "").strip()
    if not location:
        raise ValueError("entrada do manifest sem url/path")
    declared_bytes = int(entry.get("size_bytes") or 0)
    max_bytes = int(settings.car_max_download_mb * 1024 * 1024)
    if declared_bytes and declared_bytes > max_bytes:
        raise ValueError(f"arquivo excede CAR_MAX_DOWNLOAD_MB ({settings.car_max_download_mb:g} MB)")
    local = Path(location.removeprefix("file://"))
    if local.exists():
        if local.stat().st_size > max_bytes:
            raise ValueError(f"arquivo excede CAR_MAX_DOWNLOAD_MB ({settings.car_max_download_mb:g} MB)")
        return local
    if not settings.car_allow_full_state_download and str(entry.get("scope") or "municipality") == "state":
        raise ValueError("download de base estadual foi bloqueado; publique recorte municipal no manifest")
    cache_name = f"{sha256(location.encode('utf-8')).hexdigest()[:16]}-{Path(urlparse(location).path).name or 'layer.fgb'}"
    target = settings.car_cache_dir / cache_name
    if target.exists():
        return target
    request = Request(location, headers={"User-Agent": "GeoGestao-Environmental-Worker/1.0"})
    with urlopen(request, timeout=120) as response:
        content_length = int(response.headers.get("Content-Length") or 0)
        if content_length and content_length > max_bytes:
            raise ValueError(f"arquivo excede CAR_MAX_DOWNLOAD_MB ({settings.car_max_download_mb:g} MB)")
        tmp = target.with_suffix(target.suffix + ".tmp")
        with tmp.open("wb") as handle:
            shutil.copyfileobj(response, handle)
        if tmp.stat().st_size > max_bytes:
            tmp.unlink(missing_ok=True)
            raise ValueError(f"arquivo excede CAR_MAX_DOWNLOAD_MB ({settings.car_max_download_mb:g} MB)")
        tmp.replace(target)
    return target


def _read_clip(path: Path, aoi: AoiResult) -> gpd.GeoDataFrame:
    aoi_gdf = gpd.GeoDataFrame([{"id": "aoi"}], geometry=[aoi.geometry], crs="EPSG:4326")
    source = gpd.read_file(path, bbox=tuple(aoi.bbox))
    if source.empty:
        return source
    if source.crs is None:
        source = source.set_crs("EPSG:4674")
    source = source.to_crs("EPSG:4326")
    source = source[source.geometry.notna() & source.intersects(aoi.geometry)].copy()
    if source.empty:
        return source
    return gpd.clip(source, aoi_gdf)


def _requested_car_layers(requested_layers: list[str]) -> set[str]:
    requested = {item.strip().lower() for item in requested_layers if item.strip()}
    return {item for item in requested if item in CAR_LAYER_NAMES}
