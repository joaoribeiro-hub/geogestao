from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import json
import os
import re
import urllib.request

import numpy as np
from osgeo import gdal
from PIL import Image

from .settings import CBERS_COLLECTION, DEFAULT_START_DATETIME, URL_ROOT, URL_SEARCH

gdal.UseExceptions()


def configure_gdal_http() -> None:
    gdal.SetConfigOption("GDAL_HTTP_MAX_RETRY", "5")
    gdal.SetConfigOption("GDAL_HTTP_RETRY_DELAY", "10")
    gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    gdal.SetConfigOption("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.tiff,.TIF,.TIFF")


def choose_asset(item: dict) -> tuple[str | None, str | None]:
    assets = item.get("assets", {})
    preferred_names = ["tci", "TCI", "rgb", "visual", "cog", "data", "image"]

    for name in preferred_names:
        asset = assets.get(name)
        if asset and asset.get("href"):
            return name, asset.get("href")

    for name, asset in assets.items():
        href = asset.get("href")
        media_type = asset.get("type", "")
        if not href:
            continue

        href_lower = href.lower()
        type_lower = media_type.lower()
        if (
            href_lower.endswith(".tif")
            or href_lower.endswith(".tiff")
            or "geotiff" in type_lower
            or "tiff" in type_lower
        ):
            return name, href

    return None, None


def search_cbers_images(
    bbox: tuple[float, float, float, float],
    limit: int = 25,
    start_datetime: str = DEFAULT_START_DATETIME,
) -> list[dict]:
    end_datetime = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = {
        "collections": [CBERS_COLLECTION],
        "bbox": list(bbox),
        "datetime": f"{start_datetime}/{end_datetime}",
        "limit": 50,
    }

    request = urllib.request.Request(
        URL_SEARCH,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))

    candidates: list[dict] = []
    for item in result.get("features", []):
        asset_name, href = choose_asset(item)
        if not href:
            continue

        href_abs = urljoin(URL_ROOT, href)
        candidates.append(
            {
                "id": item.get("id", "sem_id"),
                "image_date": item.get("properties", {}).get("datetime", ""),
                "asset_name": asset_name,
                "href": href_abs,
            }
        )

    candidates.sort(key=lambda item: item.get("image_date") or "", reverse=True)
    return candidates[:limit]


def crop_remote_cbers_image(
    href: str,
    bbox: tuple[float, float, float, float],
    output_path: Path,
) -> Path:
    configure_gdal_http()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists():
        output_path.unlink()

    options = gdal.WarpOptions(
        format="GTiff",
        outputBounds=list(bbox),
        outputBoundsSRS="EPSG:4326",
        dstNodata=0,
        multithread=False,
        creationOptions=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"],
    )

    dataset = gdal.Warp(str(output_path), _to_vsi_url(href), options=options)
    if dataset is None:
        raise RuntimeError("Erro ao gerar o recorte.")

    dataset.FlushCache()
    dataset = None
    return output_path


def validate_geotiff(path: Path) -> bool:
    try:
        dataset = gdal.Open(str(path))
        if dataset is None or dataset.RasterCount < 1:
            return False

        for index in range(1, dataset.RasterCount + 1):
            band = dataset.GetRasterBand(index)
            band.ReadRaster(
                0,
                0,
                min(256, dataset.RasterXSize),
                min(256, dataset.RasterYSize),
            )

        dataset = None
        return True
    except Exception:
        return False


def create_preview(original_tif: Path, preview_path: Path, scale: float = 0.25) -> Path:
    dataset = gdal.Open(str(original_tif))
    if dataset is None:
        raise RuntimeError("Erro ao gerar a pre-visualizacao.")

    width = max(1, int(dataset.RasterXSize * scale))
    height = max(1, int(dataset.RasterYSize * scale))
    band_count = min(3, dataset.RasterCount)

    if band_count < 1:
        raise RuntimeError("Imagem sem bandas para preview.")

    arrays: list[np.ndarray] = []
    for band_index in range(1, band_count + 1):
        band = dataset.GetRasterBand(band_index)
        array = band.ReadAsArray(
            0,
            0,
            dataset.RasterXSize,
            dataset.RasterYSize,
            buf_xsize=width,
            buf_ysize=height,
        ).astype(np.float32)

        nodata = band.GetNoDataValue()
        if nodata is not None:
            array[array == nodata] = np.nan
        arrays.append(_stretch_to_byte(array))

    while len(arrays) < 3:
        arrays.append(arrays[-1])

    preview = np.dstack(arrays[:3])
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(preview, mode="RGB").save(preview_path, format="PNG", optimize=True)
    dataset = None
    return preview_path


def safe_filename(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "_", value)
    return value.strip("._") or "arquivo"


def _to_vsi_url(href: str) -> str:
    href = urljoin(URL_ROOT, href)
    if href.startswith("http://") or href.startswith("https://"):
        return "/vsicurl/" + href
    return href


def _stretch_to_byte(array: np.ndarray) -> np.ndarray:
    valid = array[np.isfinite(array)]
    if valid.size == 0:
        return np.zeros_like(array, dtype=np.uint8)

    p2, p98 = np.percentile(valid, [2, 98])
    if p98 <= p2:
        return np.zeros_like(array, dtype=np.uint8)

    output = (array - p2) / (p98 - p2) * 255
    output = np.clip(output, 0, 255)
    return np.where(np.isfinite(output), output, 0).astype(np.uint8)
