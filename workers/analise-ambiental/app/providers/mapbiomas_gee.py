from __future__ import annotations

from pathlib import Path
from typing import Any
import base64
import json
import tempfile
import urllib.request
import zipfile

from app.config import Settings
from app.processing.aoi import AoiResult
from app.processing.layers import EnvironmentalLayer

from .mapbiomas_real import MapBiomasRealProvider


class MapBiomasGeeProvider:
    provider_key = "mapbiomas_gee"

    def __init__(self, *, settings: Settings, tmp_dir: Path) -> None:
        self.settings = settings
        self.tmp_dir = tmp_dir

    def analyze(self, aoi: AoiResult, requested_layers: list[str]) -> tuple[list[EnvironmentalLayer], list[str], str]:
        config_warning = self._configuration_warning()
        if config_warning:
            return [], [config_warning], self.provider_key

        try:
            raster_path = self._download_aoi_raster(aoi)
        except ExportRequiredError as exc:
            return [], [str(exc)], "export_required"
        except Exception as exc:
            message = str(exc)
            if "User memory limit exceeded" in message or "Total request size" in message or "Too many pixels" in message:
                return [], [f"Recorte MapBiomas/GEE excedeu limite de download direto; exportacao assincrona sera necessaria. Detalhe: {message}"], "export_required"
            return [], [f"Falha ao consultar MapBiomas/GEE: {message}"], self.provider_key

        layers, warnings = MapBiomasRealProvider(
            raster_source=str(raster_path),
            year=self.settings.mapbiomas_year,
            collection=self.settings.mapbiomas_collection,
            provider_key=self.provider_key,
        ).analyze(aoi, requested_layers)
        return layers, warnings, self.provider_key

    def _configuration_warning(self) -> str | None:
        if not self.settings.mapbiomas_asset_id:
            return _not_configured_message()
        if self.settings.gee_service_account_json_base64:
            return None
        if self.settings.gee_service_account_email and self.settings.gee_private_key:
            return None
        return _not_configured_message()

    def _download_aoi_raster(self, aoi: AoiResult) -> Path:
        ee = _initialize_earth_engine(self.settings)
        image = ee.Image(self.settings.mapbiomas_asset_id)
        band_name = _select_band_name(ee, image, self.settings.mapbiomas_year)
        selected_image = image.select([band_name]).clip(ee.Geometry(aoi.geometry_geojson))
        download_url = selected_image.getDownloadURL(
            {
                "name": f"mapbiomas_{self.settings.mapbiomas_year}",
                "region": aoi.geometry_geojson,
                "scale": 10,
                "crs": "EPSG:4326",
                "format": "GEO_TIFF",
            }
        )
        return _download_geotiff(download_url, self.tmp_dir)


class ExportRequiredError(RuntimeError):
    pass


def _initialize_earth_engine(settings: Settings) -> Any:
    try:
        import ee
    except ImportError as exc:
        raise RuntimeError("Pacote earthengine-api nao instalado no worker. Rode pip install -r requirements-base.txt.") from exc

    if settings.gee_service_account_json_base64:
        raw_json = base64.b64decode(settings.gee_service_account_json_base64).decode("utf-8")
        service_account_info = json.loads(raw_json)
        service_account_email = service_account_info.get("client_email")
        credentials = ee.ServiceAccountCredentials(service_account_email, key_data=raw_json)
    else:
        private_key = settings.gee_private_key.replace("\\n", "\n")
        credentials = ee.ServiceAccountCredentials(
            settings.gee_service_account_email,
            key_data=json.dumps(
                {
                    "type": "service_account",
                    "client_email": settings.gee_service_account_email,
                    "private_key": private_key,
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            ),
        )

    if settings.gee_project_id:
        ee.Initialize(credentials, project=settings.gee_project_id)
    else:
        ee.Initialize(credentials)
    return ee


def _select_band_name(ee: Any, image: Any, year: int) -> str:
    band_names = list(image.bandNames().getInfo() or [])
    preferred = [f"classification_{year}", str(year), f"coverage_{year}"]
    for name in preferred:
        if name in band_names:
            return name
    if len(band_names) == 1:
        return str(band_names[0])
    raise ValueError(
        f"Asset MapBiomas sem banda reconhecida para {year}. Bandas disponiveis: {', '.join(map(str, band_names[:20]))}."
    )


def _download_geotiff(download_url: str, tmp_dir: Path) -> Path:
    tmp_dir.mkdir(parents=True, exist_ok=True)
    download_path = tmp_dir / "mapbiomas_gee_download"
    with urllib.request.urlopen(download_url, timeout=120) as response:
        content = response.read()
        content_type = response.headers.get("content-type", "")

    if content_type.startswith("application/zip") or content[:2] == b"PK":
        zip_path = download_path.with_suffix(".zip")
        zip_path.write_bytes(content)
        with zipfile.ZipFile(zip_path) as archive:
            tif_names = [name for name in archive.namelist() if name.lower().endswith((".tif", ".tiff"))]
            if not tif_names:
                raise ValueError("Download GEE retornou ZIP sem GeoTIFF.")
            raster_path = tmp_dir / Path(tif_names[0]).name
            with archive.open(tif_names[0]) as source:
                raster_path.write_bytes(source.read())
            return raster_path

    raster_path = download_path.with_suffix(".tif")
    raster_path.write_bytes(content)
    return raster_path


def _not_configured_message() -> str:
    return (
        "Provider MapBiomas/GEE não configurado no worker. Configure GEE_PROJECT_ID, "
        "credenciais da service account e MAPBIOMAS_10M_ASSET_ID."
    )
