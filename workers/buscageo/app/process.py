from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import math
import tempfile
import traceback
import uuid

from .cbers import create_preview, crop_remote_cbers_image, safe_filename, search_cbers_images, validate_geotiff
from .geo import expand_bbox, parse_area_file
from .models import WorkerPayload
from .mosaic import apply_cubic_reprojection, copy_final_for_download, process_mosaic
from .settings import MAX_PREVIEW_SCENES
from .storage import callback, download_to_path, upload_file


def read_geometry(payload: WorkerPayload) -> None:
    try:
        if not payload.input_storage_path:
            raise ValueError("Job sem arquivo de entrada.")
        with tempfile.TemporaryDirectory(prefix="buscageo-") as tmp:
            local = _download_input(payload.input_storage_path, Path(tmp))
            parsed = parse_area_file(local)
            bbox = expand_bbox(parsed.bbox, factor=float(payload.parameters.get("bboxFactor") or 1.5))
            _send(
                payload,
                status="geometry_ready",
                progress=25,
                message="Geometria lida e area preparada.",
                geometry={"type": "wkt", "wkt": parsed.geometry_wkt},
                bbox=list(bbox),
                area_ha=_approx_area_ha(parsed.bbox),
                source_epsg=parsed.source_epsg,
                source_wkt=parsed.source_wkt,
            )
    except Exception as exc:
        _fail(payload, str(exc))


def search_scenes(payload: WorkerPayload) -> None:
    try:
        if not payload.input_storage_path:
            raise ValueError("Job sem arquivo de entrada.")
        with tempfile.TemporaryDirectory(prefix="buscageo-") as tmp:
            tmp_path = Path(tmp)
            local = _download_input(payload.input_storage_path, tmp_path)
            parsed = parse_area_file(local)
            bbox = payload.bbox if payload.bbox and len(payload.bbox) == 4 else list(expand_bbox(parsed.bbox, factor=1.5))

            _send(payload, status="searching_scenes", progress=35, message="Consultando catalogo STAC CBERS.")
            start_datetime = _start_datetime(payload.parameters)
            candidates = search_cbers_images(tuple(float(item) for item in bbox), limit=30, start_datetime=start_datetime)
            if not candidates:
                raise ValueError("Nenhuma imagem CBERS encontrada para esta area.")

            scenes: list[dict[str, Any]] = []
            originals_dir = tmp_path / "originals"
            previews_dir = tmp_path / "previews"
            for candidate in candidates:
                if len(scenes) >= MAX_PREVIEW_SCENES:
                    break
                image_id = uuid.uuid4().hex
                stem = safe_filename(f"{candidate['id']}_{candidate['asset_name']}_RECORTE")
                original_path = originals_dir / f"{stem}.tif"
                try:
                    crop_remote_cbers_image(candidate["href"], tuple(float(item) for item in bbox), original_path)
                    if not validate_geotiff(original_path):
                        continue
                    preview_path = previews_dir / f"{image_id}.png"
                    create_preview(original_path, preview_path, scale=0.25)
                except Exception:
                    traceback.print_exc()
                    continue

                original_storage_path = _storage_path(payload, "output/originals", original_path.name)
                preview_storage_path = _storage_path(payload, "preview", preview_path.name)
                upload_file(original_path, original_storage_path, "image/tiff")
                upload_file(preview_path, preview_storage_path, "image/png")
                scenes.append(
                    {
                        "imageId": image_id,
                        "stacId": candidate["id"],
                        "imageDate": candidate["image_date"],
                        "assetName": candidate["asset_name"],
                        "originalStoragePath": original_storage_path,
                        "previewStoragePath": preview_storage_path,
                        "status": "Preview pronta",
                    }
                )
                _send(payload, status="searching_scenes", progress=40 + int((len(scenes) / MAX_PREVIEW_SCENES) * 45), message="Recortando cenas CBERS.")

            if not scenes:
                raise ValueError("Nao foi possivel gerar recortes validos para esta area.")

            _send(
                payload,
                status="scenes_ready",
                progress=100,
                message="Cenas prontas para selecao.",
                geometry={"type": "wkt", "wkt": parsed.geometry_wkt},
                bbox=list(bbox),
                area_ha=_approx_area_ha(parsed.bbox),
                scenes=scenes,
                source_epsg=parsed.source_epsg,
                source_wkt=parsed.source_wkt,
            )
    except Exception as exc:
        _fail(payload, str(exc))


def process_selected(payload: WorkerPayload) -> None:
    try:
        selected_ids = set(payload.selected_scene_ids)
        if not 1 <= len(selected_ids) <= 2:
            raise ValueError("Selecione 1 ou 2 cenas.")
        selected = [scene for scene in payload.scenes if str(scene.get("imageId")) in selected_ids]
        if len(selected) != len(selected_ids):
            raise ValueError("Cena selecionada nao pertence ao job.")

        with tempfile.TemporaryDirectory(prefix="buscageo-") as tmp:
            tmp_path = Path(tmp)
            selected_paths: list[Path] = []
            for scene in selected:
                storage_path = scene.get("originalStoragePath") or scene.get("original_storage_path")
                if not storage_path:
                    raise ValueError("Cena sem GeoTIFF original no Storage.")
                local = tmp_path / "selected" / Path(str(storage_path)).name
                download_to_path(str(storage_path), local)
                selected_paths.append(local)

            def progress(value: int, message: str) -> None:
                _send(payload, status="processing", progress=value, message=message)

            band_8bit_path = process_mosaic(selected_paths, tmp_path / "mosaic", tmp_path / "temp", progress=progress)
            dst_srs = _dst_srs(payload.parameters)
            cubic_path = tmp_path / "mosaic" / "CBERS_MOSAICO_FINAL_CUBIC.tif"
            apply_cubic_reprojection(band_8bit_path, cubic_path, dst_srs=dst_srs)
            final_path, filename = copy_final_for_download(
                cubic_path,
                tmp_path / "download",
                str(selected[0].get("imageDate") or selected[0].get("image_date") or "CBERS"),
            )
            output_storage_path = _storage_path(payload, "output", filename)
            upload_file(final_path, output_storage_path, "image/tiff")
            _send(
                payload,
                status="done",
                progress=100,
                message="GeoTIFF final pronto.",
                output_storage_path=output_storage_path,
                output_filename=filename,
                selected_scenes=list(selected_ids),
                finished_at=_now(),
            )
    except Exception as exc:
        _fail(payload, str(exc))


def _download_input(storage_path: str, tmp_path: Path) -> Path:
    return download_to_path(storage_path, tmp_path / "input" / Path(storage_path).name)


def _storage_path(payload: WorkerPayload, folder: str, filename: str) -> str:
    return f"organizations/{payload.organization_id}/modules/buscageo/{payload.job_id}/{folder}/{safe_filename(filename)}"


def _send(payload: WorkerPayload, **updates: Any) -> None:
    body = {
        "job_id": payload.job_id,
        "organization_id": payload.organization_id,
        "logs": [{"at": _now(), "message": str(updates.get("message") or "BuscaGEO atualizado.")}],
        **updates,
    }
    callback(payload.callback_url, body)


def _fail(payload: WorkerPayload, message: str) -> None:
    _send(payload, status="failed", progress=100, message=message, error_message=message, finished_at=_now())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _approx_area_ha(bbox: tuple[float, float, float, float]) -> float:
    min_x, min_y, max_x, max_y = bbox
    mid_lat = (min_y + max_y) / 2
    width_m = abs(max_x - min_x) * 111_320 * max(0.1, math.cos(math.radians(mid_lat)))
    height_m = abs(max_y - min_y) * 110_540
    return round((width_m * height_m) / 10_000, 2)


def _dst_srs(parameters: dict[str, Any]) -> str | None:
    source_epsg = parameters.get("source_epsg")
    try:
        if source_epsg and int(source_epsg) != 4326:
            return f"EPSG:{int(source_epsg)}"
    except (TypeError, ValueError):
        return None
    return None


def _start_datetime(parameters: dict[str, Any]) -> str:
    value = str(parameters.get("startDate") or "").strip()
    if value:
        return f"{value}T00:00:00Z" if len(value) == 10 else value
    return "2023-03-01T00:00:00Z"
