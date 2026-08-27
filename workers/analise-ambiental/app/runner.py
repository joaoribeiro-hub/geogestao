from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import tempfile
import traceback

from .config import get_settings
from .processing.aoi import parse_aoi_file
from .processing.exporters import write_geojson, write_json, write_kml, write_shapefile_zip, write_zip_package
from .processing.layers import EnvironmentalLayer, generate_dev_fixture_layers, layer_to_report
from .providers.ana_hidrografia import (
    ANA_BHO6_CRS,
    ANA_BHO6_SOURCE,
    ANA_BHO6_VERSION,
    ANA_HIDRO_LAYER_KEY,
    ANA_HIDRO_PROVIDER_KEY,
    AnaHidrografiaOficialProvider,
    wants_hidrografia_oficial,
)
from .providers.mapbiomas_gee import MapBiomasGeeProvider
from .providers.mapbiomas_real import MapBiomasRealProvider
from .supabase_repo import SupabaseJobRepository


LAYER_NAMES = {
    "limite": "Limite da propriedade",
    "vegetacao_existente": "Vegetação existente",
    "vegetacao_nativa": "Vegetação nativa",
    "floresta": "Floresta",
    "agropecuaria": "Agropecuária",
    "agua_represa": "Água/represa",
    "agua": "Água",
    "area_nao_vegetada": "Área não vegetada",
    "drenagem_corrego": "Drenagem/córrego",
    "hidrografia_oficial": "Hidrografia oficial",
    "pacote": "Pacote completo",
}


def process_job(job_id: str) -> None:
    repo: SupabaseJobRepository | None = None
    job: dict[str, Any] = {}
    try:
        repo = SupabaseJobRepository()
        settings = get_settings()
        job = repo.get_job(job_id)
        organization_id = str(job.get("organization_id") or "")
        input_storage_path = str(job.get("input_storage_path") or "")
        if not organization_id:
            raise ValueError("Job sem organization_id.")
        if not input_storage_path:
            raise ValueError("Job sem arquivo de entrada.")
        if not input_storage_path.startswith(f"organizations/{organization_id}/"):
            raise ValueError("Arquivo de entrada fora do path da organizacao.")

        now = _now()
        repo.update_job(
            job_id,
            {
                "status": "lendo_area",
                "progress": 10,
                "started_at": now,
                "updated_at": now,
                "logs": _append_log(job.get("logs"), "Worker iniciou leitura da AOI."),
            },
        )

        with tempfile.TemporaryDirectory(prefix="analise-ambiental-", dir=str(settings.tmp_dir)) as tmp:
            tmp_path = Path(tmp)
            input_path = repo.download_to_path(input_storage_path, tmp_path / "input" / Path(input_storage_path).name)
            aoi = parse_aoi_file(input_path)
            outputs_dir = tmp_path / "outputs"

            repo.update_job(
                job_id,
                {
                    "status": "resolvendo_providers",
                    "progress": 35,
                    "geometry_geojson": aoi.geometry_geojson,
                    "bbox": aoi.bbox,
                    "area_m2": aoi.area_m2,
                    "area_ha": aoi.area_ha,
                    "metric_crs": aoi.metric_crs,
                    "updated_at": _now(),
                    "logs": _append_log(job.get("logs"), "AOI validada e CRS metrico estimado."),
                },
            )

            repo.update_job(job_id, {"status": "limite_extraido", "progress": 25, "updated_at": _now()})
            generated_files: dict[str, Path] = {}
            output_records: list[dict[str, Any]] = []
            warnings: list[str] = []

            limit_outputs = _write_layer_outputs(
                outputs_dir,
                layer_key="limite",
                layer_name=LAYER_NAMES["limite"],
                geometry=aoi.geometry,
                provider="kml",
                confidence="alta",
                official_data=False,
                area_ha=aoi.area_ha,
                length_m=None,
                properties={"source": "kml", "name": str(job.get("original_filename") or "Limite")},
            )
            generated_files.update(limit_outputs)

            requested_layers = [str(item) for item in (job.get("requested_layers") or [])]
            repo.update_job(job_id, {"status": "processando_vegetacao", "progress": 40, "updated_at": _now()})
            raster_source, raster_provider_key = _resolve_mapbiomas_raster_source(repo, job, organization_id, tmp_path)
            environmental_layers, provider_warnings, provider_key = _generate_environmental_layers(
                aoi,
                requested_layers,
                raster_source,
                raster_provider_key,
                tmp_path,
            )
            warnings.extend(provider_warnings)

            if not environmental_layers:
                if not warnings:
                    warnings.append(
                        "Processamento ambiental real pendente; nenhum provider ambiental configurado para gerar camadas."
                    )
                report_payload = _build_report_payload(
                    job,
                    aoi,
                    [],
                    {},
                    warnings,
                    provider=provider_key,
                    official_data=False,
                )
                report_path = write_json(outputs_dir / "relatorio_ambiental.json", report_payload)
                generated_files["relatorio_ambiental_json"] = report_path
                uploaded_outputs = _upload_outputs(repo, organization_id, job_id, generated_files)
                output_records = _records_for_outputs(
                    organization_id,
                    job_id,
                    uploaded_outputs,
                    layer_metadata={"limite": {"provider": "kml", "confidence": "alta", "official_data": False, "area_ha": aoi.area_ha}},
                )
                repo.replace_job_outputs(job_id, organization_id, output_records)
                repo.update_job(
                    job_id,
                    {
                        "status": _status_without_environmental_layers(provider_key, warnings),
                        "progress": 100 if _status_without_environmental_layers(provider_key, warnings) == "concluido" else 35,
                        "output_storage_paths": uploaded_outputs,
                        "result_storage_path": uploaded_outputs.get("relatorio_ambiental_json"),
                        "result_summary": report_payload,
                        "warnings": warnings,
                        "updated_at": _now(),
                        "logs": _append_log(job.get("logs"), "Limite extraido; nenhum output ambiental vetorial foi gerado."),
                    },
                )
                return

            layer_metadata = {
                    "limite": {"provider": "kml", "confidence": "alta", "official_data": False, "area_ha": aoi.area_ha}
            }
            for layer in environmental_layers:
                if layer.key == "agua_represa":
                    repo.update_job(job_id, {"status": "processando_agua", "progress": 55, "updated_at": _now()})
                elif layer.key == "drenagem_corrego":
                    repo.update_job(job_id, {"status": "processando_drenagem", "progress": 65, "updated_at": _now()})
                elif layer.key == ANA_HIDRO_LAYER_KEY:
                    repo.update_job(job_id, {"status": "processando_hidrografia", "progress": 70, "updated_at": _now()})
                layer_outputs = _write_layer_outputs(
                    outputs_dir,
                    layer_key=layer.key,
                    layer_name=layer.name,
                    geometry=layer.geometry,
                    provider=layer.provider,
                    confidence=layer.confidence,
                    official_data=layer.official_data,
                    area_ha=layer.area_ha,
                    length_m=layer.length_m,
                    properties={
                        "layer": layer.key,
                        "provider": layer.provider,
                        "official": layer.official_data,
                        "confidence": layer.confidence,
                    },
                )
                generated_files.update(layer_outputs)
                if layer.warning:
                    warnings.append(layer.warning)
                layer_metadata[layer.key] = {
                    "layer_name": layer.name,
                    "provider": layer.provider,
                    "confidence": layer.confidence,
                    "official_data": layer.official_data,
                    "area_ha": layer.area_ha,
                    "length_m": layer.length_m,
                    **(layer.metadata or {}),
                }

            is_simulated = provider_key == "dev_fixture"
            report_payload = _build_report_payload(
                job,
                aoi,
                environmental_layers,
                {},
                sorted(set(warnings)),
                provider=provider_key,
                official_data=not is_simulated,
                mapbiomas_year=get_settings().mapbiomas_year if provider_key.startswith("mapbiomas_") else None,
                mapbiomas_collection=get_settings().mapbiomas_collection if provider_key.startswith("mapbiomas_") else None,
            )
            report_payload["files"] = sorted(_package_entries(generated_files).keys())
            if is_simulated:
                report_payload["warning"] = "Resultado simulado para teste. Não usar como análise ambiental real."
            report_path = write_json(outputs_dir / "relatorio_ambiental.json", report_payload)
            generated_files["relatorio_ambiental_json"] = report_path

            repo.update_job(
                job_id,
                {"status": "gerando_outputs", "progress": 80, "updated_at": _now()},
            )
            package_path = write_zip_package(outputs_dir / "pacote_resultados.zip", _package_entries(generated_files))
            generated_files["pacote_resultados_zip"] = package_path

            uploaded_outputs = _upload_outputs(repo, organization_id, job_id, generated_files)
            output_records = _records_for_outputs(organization_id, job_id, uploaded_outputs, layer_metadata=layer_metadata)
            repo.replace_job_outputs(job_id, organization_id, output_records)
            finished_at = _now()
            repo.update_job(
                job_id,
                {
                    "status": "simulado" if is_simulated else "concluido",
                    "progress": 100,
                    "output_storage_paths": uploaded_outputs,
                    "result_storage_path": uploaded_outputs.get("relatorio_ambiental_json"),
                    "result_summary": report_payload,
                    "confidence_summary": {
                        "geometry": "alta",
                        "providers": sorted({layer.provider for layer in environmental_layers}),
                        "fixture": is_simulated,
                        "official_data": not is_simulated,
                    },
                    "warnings": sorted(set(warnings)),
                    "error_message": None,
                    "finished_at": finished_at,
                    "updated_at": finished_at,
                    "logs": _append_log(job.get("logs"), "Analise ambiental com camadas concluida pelo worker."),
                },
            )
    except Exception as exc:
        message = str(exc)
        print(f"[analise-ambiental] erro ao processar job {job_id}: {message}")
        if repo is not None:
            try:
                repo.update_job(
                    job_id,
                    {
                        "status": "erro",
                        "progress": 100,
                        "error_message": message,
                        "finished_at": _now(),
                        "updated_at": _now(),
                        "logs": _append_log(job.get("logs"), f"Erro no worker ambiental: {message}"),
                    },
                )
            except Exception as update_exc:
                print(f"[analise-ambiental] nao foi possivel atualizar status de erro: {update_exc}")
        if get_settings().debug:
            traceback.print_exc()


def process_pending_jobs(limit: int | None = None) -> list[str]:
    settings = get_settings()
    repo = SupabaseJobRepository()
    jobs = repo.list_pending_jobs(limit or settings.poll_limit)
    job_ids = [str(job["id"]) for job in jobs]
    for job_id in job_ids:
        process_job(job_id)
    return job_ids


def _generate_environmental_layers(
    aoi: Any,
    requested_layers: list[str],
    raster_source: str | None,
    raster_provider_key: str | None,
    tmp_path: Path,
) -> tuple[list[EnvironmentalLayer], list[str], str]:
    settings = get_settings()
    layers: list[EnvironmentalLayer] = []
    warnings: list[str] = []
    providers: list[str] = []

    if _wants_mapbiomas_layers(requested_layers):
        mapbiomas_layers, mapbiomas_warnings, mapbiomas_provider = _generate_mapbiomas_layers(
            aoi,
            requested_layers,
            raster_source,
            raster_provider_key,
            tmp_path,
        )
        layers.extend(mapbiomas_layers)
        warnings.extend(mapbiomas_warnings)
        if mapbiomas_provider:
            providers.append(mapbiomas_provider)

    if wants_hidrografia_oficial(requested_layers):
        hidro_provider = AnaHidrografiaOficialProvider(settings=settings)
        hidro_layers, hidro_warnings = hidro_provider.analyze(aoi, requested_layers)
        layers.extend(hidro_layers)
        warnings.extend(hidro_warnings)
        providers.append(ANA_HIDRO_PROVIDER_KEY)

    provider_key = _combined_provider_key(providers)
    return layers, warnings, provider_key


def _generate_mapbiomas_layers(
    aoi: Any,
    requested_layers: list[str],
    raster_source: str | None,
    raster_provider_key: str | None,
    tmp_path: Path,
) -> tuple[list[EnvironmentalLayer], list[str], str]:
    settings = get_settings()
    if settings.provider == "mapbiomas_gee":
        return MapBiomasGeeProvider(settings=settings, tmp_dir=tmp_path / "gee").analyze(aoi, requested_layers)

    if raster_source:
        provider = MapBiomasRealProvider(
            raster_source=raster_source,
            year=settings.mapbiomas_year,
            collection=settings.mapbiomas_collection,
            provider_key=raster_provider_key or "mapbiomas_manual_raster",
        )
        layers, warnings = provider.analyze(aoi, requested_layers)
        return layers, warnings, provider.provider_key
    if settings.local_fixture_enabled:
        return (
            generate_dev_fixture_layers(aoi, requested_layers),
            ["Resultado simulado para teste. Não usar como análise ambiental real."],
            "dev_fixture",
        )
    return [], [], settings.provider or "provider_pendente"


def _wants_mapbiomas_layers(requested_layers: list[str]) -> bool:
    normalized = {item.strip().lower() for item in requested_layers if item.strip()}
    if not normalized:
        return True
    mapbiomas_keys = {
        "vegetacao",
        "vegetacao_existente",
        "vegetacao_nativa",
        "floresta",
        "formacao_savanica",
        "vegetacao_campestre",
        "agropecuaria",
        "agua",
        "agua_represa",
        "area_nao_vegetada",
    }
    return bool(normalized.intersection(mapbiomas_keys))


def _combined_provider_key(providers: list[str]) -> str:
    unique = [provider for index, provider in enumerate(providers) if provider and provider not in providers[:index]]
    if not unique:
        return get_settings().provider or "provider_pendente"
    if len(unique) == 1:
        return unique[0]
    return "multi_provider"


def _status_without_environmental_layers(provider_key: str, warnings: list[str]) -> str:
    if provider_key == "export_required":
        return "export_required"
    lower_warnings = " ".join(warnings).lower()
    if provider_key in {ANA_HIDRO_PROVIDER_KEY, "multi_provider"} and not any(
        token in lower_warnings for token in ["não configurado", "nao configurado", "pendente", "falha"]
    ):
        return "concluido"
    return "provider_pendente"


def _resolve_mapbiomas_raster_source(
    repo: SupabaseJobRepository,
    job: dict[str, Any],
    organization_id: str,
    tmp_path: Path,
) -> tuple[str | None, str | None]:
    settings = get_settings()
    raster_storage_path = str(job.get("input_raster_storage_path") or "")
    if raster_storage_path:
        if not raster_storage_path.startswith(f"organizations/{organization_id}/"):
            raise ValueError("Raster MapBiomas fora do path da organizacao.")
        raster_path = repo.download_to_path(raster_storage_path, tmp_path / "input" / Path(raster_storage_path).name)
        return str(raster_path), "mapbiomas_manual_raster"

    if settings.mapbiomas_raster_local_path:
        raster_path = Path(settings.mapbiomas_raster_local_path)
        if not raster_path.exists():
            raise ValueError(f"MAPBIOMAS_RASTER_LOCAL_PATH nao encontrado: {raster_path}")
        return str(raster_path), "mapbiomas_public_raster"

    if settings.mapbiomas_raster_url:
        return settings.mapbiomas_raster_url, "mapbiomas_public_raster"

    return None, None


def _write_layer_outputs(
    outputs_dir: Path,
    *,
    layer_key: str,
    layer_name: str,
    geometry: Any,
    provider: str,
    confidence: str,
    official_data: bool,
    area_ha: float | None,
    length_m: float | None,
    properties: dict[str, Any],
) -> dict[str, Path]:
    layer_dir = outputs_dir / layer_key
    common_properties = {
        **properties,
        "layer_key": layer_key,
        "layer_name": layer_name,
        "provider": provider,
        "confidence": confidence,
        "official_data": official_data,
        "area_ha": area_ha,
        "length_m": length_m,
    }
    return {
        f"{layer_key}_geojson": write_geojson(layer_dir / f"{layer_key}.geojson", geometry.__geo_interface__, common_properties),
        f"{layer_key}_kml": write_kml(layer_dir / f"{layer_key}.kml", geometry, name=layer_name),
        f"{layer_key}_shp_zip": write_shapefile_zip(layer_dir / f"{layer_key}.shp.zip", geometry, common_properties),
    }


def _upload_outputs(
    repo: SupabaseJobRepository,
    organization_id: str,
    job_id: str,
    outputs: dict[str, Path],
) -> dict[str, str]:
    uploaded: dict[str, str] = {}
    for key, local_path in outputs.items():
        if local_path.name == "pacote_resultados.zip":
            storage_path = f"organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/{local_path.name}"
        else:
            relative = local_path.name if local_path.parent.name == "outputs" else f"{local_path.parent.name}/{local_path.name}"
            storage_path = f"organizations/{organization_id}/tools/analise-ambiental/{job_id}/outputs/{relative}"
        content_type = _content_type(local_path)
        uploaded[key] = repo.upload_bytes(local_path.read_bytes(), storage_path, content_type)
    return uploaded


def _records_for_outputs(
    organization_id: str,
    job_id: str,
    uploaded_outputs: dict[str, str],
    *,
    layer_metadata: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for key, storage_path in uploaded_outputs.items():
        layer_key, output_format = _parse_output_key(key)
        metadata = layer_metadata.get(layer_key, {})
        records.append(
            {
                "organization_id": organization_id,
                "job_id": job_id,
                "layer_key": layer_key,
                "layer_name": metadata.get("layer_name") or LAYER_NAMES.get(layer_key, layer_key),
                "output_format": output_format,
                "storage_bucket": get_settings().storage_bucket,
                "storage_path": storage_path,
                "file_name": Path(storage_path).name,
                "area_ha": metadata.get("area_ha"),
                "length_m": metadata.get("length_m"),
                "confidence": metadata.get("confidence"),
                "provider": metadata.get("provider"),
                "official_data": bool(metadata.get("official_data", False)),
            }
        )
    return records


def _parse_output_key(key: str) -> tuple[str, str]:
    if key == "pacote_resultados_zip":
        return "pacote", "zip"
    if key == "relatorio_ambiental_json":
        return "relatorio", "json"
    if key.endswith("_shp_zip"):
        return key.removesuffix("_shp_zip"), "shp_zip"
    if key.endswith("_geojson"):
        return key.removesuffix("_geojson"), "geojson"
    if key.endswith("_kml"):
        return key.removesuffix("_kml"), "kml"
    return key, Path(key).suffix.replace(".", "") or "arquivo"


def _package_entries(outputs: dict[str, Path]) -> dict[str, Path]:
    entries: dict[str, Path] = {}
    for key, path in outputs.items():
        if key == "pacote_resultados_zip":
            continue
        if key == "relatorio_ambiental_json":
            entries[path.name] = path
            continue
        layer_key, _format = _parse_output_key(key)
        entries[f"{layer_key}/{path.name}"] = path
    return entries


def _build_report_payload(
    job: dict[str, Any],
    aoi: Any,
    layers: list[EnvironmentalLayer],
    output_paths: dict[str, str],
    warnings: list[str],
    *,
    provider: str,
    official_data: bool,
    mapbiomas_year: int | None = None,
    mapbiomas_collection: str | None = None,
) -> dict[str, Any]:
    generated_layers = [layer_to_report(layer) for layer in layers]
    provider_details = _provider_details(generated_layers)
    return {
        "job_id": str(job.get("id") or ""),
        "organization_id": str(job.get("organization_id") or ""),
        "original_filename": job.get("original_filename"),
        "source": "analise_ambiental_worker",
        "provider": provider,
        "providers": sorted(provider_details.keys()),
        "provider_details": provider_details,
        "official_data": official_data,
        "mapbiomas_year": mapbiomas_year,
        "mapbiomas_collection": mapbiomas_collection,
        "area_ha": aoi.area_ha,
        "area_total_ha": aoi.area_ha,
        "area_m2": aoi.area_m2,
        "bbox": aoi.bbox,
        "metric_crs": aoi.metric_crs,
        "requested_layers": job.get("requested_layers") or [],
        "generated_layers": generated_layers,
        "classes_found": _classes_found(generated_layers),
        "area_by_class": _area_by_class(generated_layers),
        "files": output_paths,
        "warnings": warnings,
        "generated_at": _now(),
    }


def _provider_details(generated_layers: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    details: dict[str, dict[str, Any]] = {}
    for layer in generated_layers:
        provider = str(layer.get("provider") or "")
        metadata = layer.get("metadata") if isinstance(layer.get("metadata"), dict) else {}
        if provider == ANA_HIDRO_PROVIDER_KEY:
            details[provider] = {
                "source": metadata.get("source") or ANA_BHO6_SOURCE,
                "version": metadata.get("version") or ANA_BHO6_VERSION,
                "crs": metadata.get("crs") or ANA_BHO6_CRS,
                "feature_count": metadata.get("feature_count"),
                "river_names": metadata.get("river_names", []),
                "observation": metadata.get("observation"),
            }
        elif provider:
            details.setdefault(provider, {})
    return details


def _classes_found(generated_layers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    classes: list[dict[str, Any]] = []
    for layer in generated_layers:
        metadata = layer.get("metadata") if isinstance(layer.get("metadata"), dict) else {}
        classes.append(
            {
                "layer_key": layer.get("layer_key"),
                "layer_name": layer.get("layer_name"),
                "codes": metadata.get("class_codes", []),
                "area_ha": layer.get("area_ha"),
                "percent": metadata.get("percent"),
                "provider": layer.get("provider"),
                "color": metadata.get("color"),
            }
        )
    return classes


def _area_by_class(generated_layers: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("layer_key")): {
            "name": item.get("layer_name"),
            "area_ha": item.get("area_ha"),
            "percent": (item.get("metadata") or {}).get("percent") if isinstance(item.get("metadata"), dict) else None,
        }
        for item in generated_layers
    }


def _append_log(current_logs: Any, message: str) -> list[dict[str, str]]:
    logs = current_logs if isinstance(current_logs, list) else []
    return [*logs, {"at": _now(), "message": message}]


def _content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".geojson", ".kml", ".json"}:
        return "text/plain"
    if suffix == ".zip":
        return "application/zip"
    return "application/octet-stream"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
