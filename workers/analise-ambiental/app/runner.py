from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import tempfile
import traceback

from shapely.geometry import mapping

from .config import get_settings
from .fusion.fusion_engine import FusionResult, fuse_environmental_sources
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
from .providers.car_provider import CarProvider
from .providers.current_image_provider import CurrentImageProvider, DynamicWorldProvider
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
    "hidrografia_ana_oficial": "Hidrografia ANA oficial",
    "vegetacao_mapbiomas": "Vegetação MapBiomas",
    "agropecuaria_mapbiomas": "Agropecuária MapBiomas",
    "agua_mapbiomas": "Água MapBiomas",
    "area_nao_vegetada_mapbiomas": "Área não vegetada MapBiomas",
    "vegetacao_car_declarada": "Vegetação declarada no CAR",
    "area_consolidada_car": "Área consolidada declarada no CAR",
    "reserva_legal_car": "Reserva Legal declarada no CAR",
    "app_hidrica_car": "APP hídrica declarada no CAR",
    "vegetacao_imagem_atual": "Vegetação na imagem atual",
    "solo_exposto_imagem_atual": "Solo exposto na imagem atual",
    "vegetacao_final": "Vegetação final",
    "vegetacao_alta_confianca": "Vegetação de alta confiança",
    "vegetacao_media_confianca": "Vegetação de média confiança",
    "vegetacao_divergencia": "Divergência de vegetação",
    "conflito_ambiental": "Conflito ambiental",
    "possivel_app_hidrica_ausente": "Possível APP hídrica ausente",
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
            requested_sources = [str(item).strip().lower() for item in (job.get("requested_sources") or ["mapbiomas"])]
            source_options = job.get("source_options") if isinstance(job.get("source_options"), dict) else {}
            repo.update_job(job_id, {"status": "processando_vegetacao", "progress": 40, "updated_at": _now()})
            raster_source, raster_provider_key = _resolve_mapbiomas_raster_source(repo, job, organization_id, tmp_path)
            current_raster_source, current_image_source, current_image_warning = _resolve_current_image_source(
                repo, job, organization_id, aoi.bbox, tmp_path, requested_sources,
            )
            environmental_layers, provider_warnings, provider_key = _generate_environmental_layers(
                aoi,
                requested_layers,
                requested_sources,
                source_options,
                raster_source,
                raster_provider_key,
                current_raster_source,
                current_image_source,
                tmp_path,
            )
            if current_image_warning:
                provider_warnings.append(current_image_warning)
            environmental_layers = _source_specific_layers(environmental_layers)
            warnings.extend(provider_warnings)

            fusion_result = FusionResult(layers=[], candidates=[], summary={}, warnings=[])
            if len(_present_source_groups(environmental_layers)) >= 2:
                repo.update_job(job_id, {"status": "fundindo_fontes", "progress": 72, "updated_at": _now()})
                fusion_result = fuse_environmental_sources(environmental_layers, metric_crs=aoi.metric_crs)
                environmental_layers.extend(fusion_result.layers)
                warnings.extend(fusion_result.warnings)

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
                        **(layer.metadata or {}),
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

            training_summary = _persist_training_candidates(
                repo, job, fusion_result, raster_storage_path=job.get("current_image_storage_path") or job.get("input_raster_storage_path")
            )

            is_simulated = provider_key == "dev_fixture"
            all_sources_official = bool(environmental_layers) and all(layer.official_data for layer in environmental_layers if layer.provider != "fusion_engine")
            report_payload = _build_report_payload(
                job,
                aoi,
                environmental_layers,
                {},
                sorted(set(warnings)),
                provider=provider_key,
                official_data=all_sources_official,
                mapbiomas_year=get_settings().mapbiomas_year if provider_key.startswith("mapbiomas_") else None,
                mapbiomas_collection=get_settings().mapbiomas_collection if provider_key.startswith("mapbiomas_") else None,
            )
            report_payload["fusion"] = fusion_result.summary
            report_payload["training"] = training_summary
            report_payload.update(_source_report_sections(environmental_layers))
            report_payload["methodology"] = _multisource_methodology()
            report_payload["limitations"] = _multisource_limitations(requested_sources, _present_source_groups(environmental_layers))
            report_payload["files"] = sorted(_package_entries(generated_files).keys())
            if is_simulated:
                report_payload["warning"] = "Resultado simulado para teste. Não usar como análise ambiental real."
            report_path = write_json(outputs_dir / "relatorio_ambiental.json", report_payload)
            generated_files["relatorio_ambiental_json"] = report_path
            multifonte_report_path = write_json(outputs_dir / "relatorio_multifonte.json", report_payload)
            generated_files["relatorio_multifonte_json"] = multifonte_report_path

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
                    "fusion_summary": fusion_result.summary,
                    "training_summary": training_summary,
                    "current_image_source": current_image_source,
                    "confidence_summary": {
                        "geometry": "alta",
                        "providers": sorted({layer.provider for layer in environmental_layers}),
                        "fixture": is_simulated,
                        "official_data": all_sources_official,
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
    requested_sources: list[str],
    source_options: dict[str, Any],
    raster_source: str | None,
    raster_provider_key: str | None,
    current_raster_source: str | None,
    current_image_source: str | None,
    tmp_path: Path,
) -> tuple[list[EnvironmentalLayer], list[str], str]:
    settings = get_settings()
    layers: list[EnvironmentalLayer] = []
    warnings: list[str] = []
    providers: list[str] = []

    requested_source_set = set(requested_sources or ["mapbiomas"])

    if "mapbiomas" in requested_source_set and _wants_mapbiomas_layers(requested_layers):
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

    if "ana" in requested_source_set or wants_hidrografia_oficial(requested_layers):
        hidro_provider = AnaHidrografiaOficialProvider(settings=settings)
        hidro_requested_layers = requested_layers if wants_hidrografia_oficial(requested_layers) else [*requested_layers, "hidrografia_oficial"]
        hidro_layers, hidro_warnings = hidro_provider.analyze(aoi, hidro_requested_layers)
        layers.extend(hidro_layers)
        warnings.extend(hidro_warnings)
        providers.append(ANA_HIDRO_PROVIDER_KEY)

    if "car" in requested_source_set:
        car_provider = CarProvider(settings=settings)
        car_layers, car_warnings, manifest_version = car_provider.analyze(aoi, requested_layers, source_options)
        layers.extend(car_layers)
        warnings.extend(car_warnings)
        if car_layers:
            providers.append(car_provider.provider_key)
        if manifest_version:
            for layer in car_layers:
                if layer.metadata is not None:
                    layer.metadata.setdefault("manifest_version", manifest_version)

    if "current_image" in requested_source_set:
        if current_raster_source:
            current_provider = CurrentImageProvider(settings=settings)
            current_options = {**source_options, "current_image_source": current_image_source or "geotiff"}
            current_layers, current_warnings = current_provider.analyze(aoi, current_raster_source, current_options)
            layers.extend(current_layers)
            warnings.extend(current_warnings)
            if current_layers:
                providers.append(current_provider.provider_key)
        elif source_options.get("current_image_mode") == "dynamic_world":
            dynamic_provider = DynamicWorldProvider(settings=settings, tmp_dir=tmp_path / "dynamic-world")
            current_layers, current_warnings = dynamic_provider.analyze(aoi)
            layers.extend(current_layers)
            warnings.extend(current_warnings)
            if current_layers:
                providers.append(dynamic_provider.provider_key)
        else:
            warnings.append("Imagem atual solicitada, mas nenhum GeoTIFF compatível foi encontrado ou enviado.")

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


def _resolve_current_image_source(
    repo: SupabaseJobRepository,
    job: dict[str, Any],
    organization_id: str,
    bbox: list[float],
    tmp_path: Path,
    requested_sources: list[str],
) -> tuple[str | None, str | None, str | None]:
    if "current_image" not in set(requested_sources):
        return None, None, None
    storage_path = str(job.get("current_image_storage_path") or "")
    source = str(job.get("current_image_source") or "manual")
    if storage_path:
        if not storage_path.startswith(f"organizations/{organization_id}/"):
            raise ValueError("Imagem atual fora do path da organização.")
        local = repo.download_to_path(storage_path, tmp_path / "current-image" / Path(storage_path).name)
        return str(local), source, None

    options = job.get("source_options") if isinstance(job.get("source_options"), dict) else {}
    if options.get("current_image_mode") not in {"recent", "auto", None, ""}:
        return None, source, None
    recent = repo.find_recent_geotiff_for_aoi(organization_id, bbox)
    if not recent:
        return None, None, "Nenhum GeoTIFF recente do BuscaGEO intersectando a AOI foi encontrado."
    recent_path = str(recent["storage_path"])
    local = repo.download_to_path(recent_path, tmp_path / "current-image" / Path(recent_path).name)
    return str(local), str(recent.get("module_key") or "buscageo"), None


def _source_specific_layers(layers: list[EnvironmentalLayer]) -> list[EnvironmentalLayer]:
    """Keep legacy keys and add explicit source keys required by the multifonte report."""
    result = list(layers)
    aliases = {
        "vegetacao_nativa": "vegetacao_mapbiomas",
        "floresta": "floresta_mapbiomas",
        "agropecuaria": "agropecuaria_mapbiomas",
        "agua": "agua_mapbiomas",
        "area_nao_vegetada": "area_nao_vegetada_mapbiomas",
        "hidrografia_oficial": "hidrografia_ana_oficial",
    }
    existing = {layer.key for layer in result}
    for layer in layers:
        alias = aliases.get(layer.key)
        if not alias or alias in existing:
            continue
        if alias.endswith("_mapbiomas") and "mapbiomas" not in layer.provider:
            continue
        if alias == "hidrografia_ana_oficial" and "ana" not in layer.provider:
            continue
        result.append(EnvironmentalLayer(
            key=alias,
            name=LAYER_NAMES.get(alias, layer.name),
            geometry=layer.geometry,
            provider=layer.provider,
            confidence=layer.confidence,
            official_data=layer.official_data,
            warning=layer.warning,
            area_ha=layer.area_ha,
            length_m=layer.length_m,
            metadata={**(layer.metadata or {}), "source_layer_key": layer.key},
        ))
        existing.add(alias)
    return result


def _present_source_groups(layers: list[EnvironmentalLayer]) -> set[str]:
    groups: set[str] = set()
    for layer in layers:
        provider = layer.provider.lower()
        if "mapbiomas" in provider:
            groups.add("mapbiomas")
        elif provider.startswith("car"):
            groups.add("car")
        elif "ana" in provider:
            groups.add("ana")
        elif provider in {"rule_based_ndvi", "dynamic_world", "current_image"}:
            groups.add("current_image")
    return groups


def _persist_training_candidates(
    repo: SupabaseJobRepository,
    job: dict[str, Any],
    fusion: FusionResult,
    *,
    raster_storage_path: Any,
) -> dict[str, Any]:
    organization_id = str(job.get("organization_id") or "")
    user_id = str(job.get("user_id") or "")
    rows = [
        {
            "organization_id": organization_id,
            "job_id": str(job.get("id") or ""),
            "source_layer": candidate.source_layer,
            "final_class": candidate.final_class,
            "geometry": mapping(candidate.geometry),
            "raster_storage_path": raster_storage_path or None,
            "aoi_storage_path": job.get("input_storage_path"),
            "label_source": candidate.label_source,
            "confidence_score": candidate.confidence_score,
            "confidence_tier": candidate.confidence_tier,
            "validation_status": candidate.validation_status,
            "fingerprint": candidate.fingerprint,
            "created_by": user_id,
            "metadata": candidate.metadata,
        }
        for candidate in fusion.candidates
    ]
    repo.upsert_training_samples(rows)
    return {
        "eligible_samples": len(rows),
        "gold_samples_created": sum(1 for item in rows if item["confidence_tier"] == "GOLD"),
        "silver_samples_created": sum(1 for item in rows if item["confidence_tier"] == "SILVER"),
        "bronze_samples_created": sum(1 for item in rows if item["confidence_tier"] == "BRONZE"),
        "disputed_samples": sum(1 for item in rows if item["confidence_tier"] == "DISPUTED"),
        "user_validated_count": 0,
        "user_corrected_count": 0,
        "observation": "As amostras validadas podem ser usadas futuramente para treinar um modelo próprio de vegetação do GeoGestão.",
    }


def _multisource_methodology() -> dict[str, Any]:
    return {
        "mapbiomas": "Classificação de cobertura e uso observada por sensoriamento remoto; peso base 0.75.",
        "car": "Dado cadastral declaratório; peso base 0.65 e nunca tratado como verdade absoluta.",
        "ana": "Hidrografia vetorial oficial ANA/BHO6; peso base 0.95.",
        "current_image": "Observação atual por NDVI inicial; peso 0.65, dependente de bandas NIR/Red.",
        "fusion": "Interseções e diferenças espaciais determinísticas preservam consenso e divergência em camadas separadas.",
    }


def _multisource_limitations(requested_sources: list[str], present_sources: set[str]) -> list[str]:
    missing = sorted(set(requested_sources) - present_sources)
    result = ["Resultado indicativo; divergências exigem revisão técnica e não são ocultadas."]
    if missing:
        result.append(f"Fontes solicitadas sem evidência gerada: {', '.join(missing)}.")
    return result


def _source_report_sections(layers: list[EnvironmentalLayer]) -> dict[str, Any]:
    sections: dict[str, dict[str, Any]] = {
        "mapbiomas": {"layers": [], "area_by_class": {}},
        "car": {"layers": [], "area_by_class": {}, "declaratory": True},
        "current_image": {"layers": [], "area_by_class": {}, "method": None},
        "ana": {"layers": [], "feature_count": 0, "length_m": 0},
    }
    for layer in layers:
        provider = layer.provider.lower()
        if provider == "fusion_engine":
            continue
        source = "mapbiomas" if "mapbiomas" in provider else "car" if provider.startswith("car") else "ana" if "ana" in provider else "current_image" if provider in {"rule_based_ndvi", "dynamic_world", "current_image"} else None
        if not source:
            continue
        sections[source]["layers"].append(layer.key)
        if layer.area_ha is not None:
            sections[source]["area_by_class"][layer.key] = layer.area_ha
        if source == "current_image":
            sections[source]["method"] = (layer.metadata or {}).get("method") or layer.provider
        if source == "ana":
            sections[source]["feature_count"] += int((layer.metadata or {}).get("feature_count") or 0)
            sections[source]["length_m"] += float(layer.length_m or 0)
    return sections


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
    if key == "relatorio_multifonte_json":
        return "relatorio_multifonte", "json"
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
        if key in {"relatorio_ambiental_json", "relatorio_multifonte_json"}:
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
