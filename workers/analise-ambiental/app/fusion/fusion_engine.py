from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Any

from pyproj import Transformer
from shapely.geometry import GeometryCollection, mapping
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from app.processing.layers import EnvironmentalLayer


SOURCE_WEIGHTS = {
    "mapbiomas": 0.75,
    "car": 0.65,
    "ana": 0.95,
    "current_image": 0.70,
}


@dataclass(frozen=True)
class TrainingCandidate:
    source_layer: str
    final_class: str
    geometry: BaseGeometry
    label_source: str
    confidence_score: float
    confidence_tier: str
    validation_status: str
    fingerprint: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class FusionResult:
    layers: list[EnvironmentalLayer]
    candidates: list[TrainingCandidate]
    summary: dict[str, Any]
    warnings: list[str]


def fuse_environmental_sources(
    source_layers: list[EnvironmentalLayer],
    *,
    metric_crs: str,
) -> FusionResult:
    """Fuse only evidence that is actually present; missing sources never become synthetic evidence."""
    by_key = {layer.key: layer for layer in source_layers if not layer.geometry.is_empty}
    map_vegetation = _union(by_key, ["vegetacao_mapbiomas", "vegetacao_nativa", "floresta_mapbiomas", "floresta"])
    map_non_vegetation = _union(by_key, ["agropecuaria_mapbiomas", "agropecuaria", "area_nao_vegetada_mapbiomas", "area_nao_vegetada"])
    map_water = _union(by_key, ["agua_mapbiomas", "agua"])
    car_vegetation = _union(by_key, ["vegetacao_car_declarada", "reserva_legal_car", "app_car", "app_hidrica_car"])
    car_consolidated = _union(by_key, ["area_consolidada_car"])
    car_app = _union(by_key, ["app_hidrica_car"])
    car_reservoir = _union(by_key, ["reservatorio_car"])
    current_vegetation = _union(by_key, ["vegetacao_imagem_atual"])
    current_non_vegetation = _union(by_key, ["agropecuaria_imagem_atual", "solo_exposto_imagem_atual"])
    current_water = _union(by_key, ["agua_imagem_atual"])
    ana_hydro = _union(by_key, ["hidrografia_ana_oficial", "hidrografia_oficial", "curso_dagua_ana", "trecho_drenagem_ana"])
    ana_water = _union(by_key, ["massa_dagua_ana"])
    has_car_evidence = any(layer.provider.startswith("car") for layer in by_key.values())

    layers: list[EnvironmentalLayer] = []
    candidates: list[TrainingCandidate] = []

    high = _intersection(map_vegetation, car_vegetation, current_vegetation)
    _append_layer(layers, "vegetacao_alta_confianca", "Vegetação de alta confiança", high, metric_crs, 0.90,
                  ["mapbiomas", "car", "current_image"], "consenso_triplo", False)

    medium_map_image = _difference(_intersection(map_vegetation, current_vegetation), car_vegetation)
    _append_layer(layers, "vegetacao_media_confianca", "Vegetação de média confiança", medium_map_image, metric_crs, 0.76,
                  ["mapbiomas", "current_image"], "mapbiomas_e_imagem_sem_declaracao_car", False)

    car_validated = _difference(_intersection(car_vegetation, current_vegetation), map_vegetation)
    _append_layer(layers, "vegetacao_car_validada_por_imagem_atual", "Vegetação CAR validada por imagem atual", car_validated,
                  metric_crs, 0.72, ["car", "current_image"], "car_e_imagem_sem_mapbiomas", False)

    divergence_car_map = _intersection(car_vegetation, map_non_vegetation)
    divergence_car_current = _intersection(car_vegetation, current_non_vegetation)
    divergence = _union_geometries([divergence_car_map, divergence_car_current])
    _append_layer(layers, "vegetacao_divergencia", "Divergência de vegetação", divergence, metric_crs, 0.35,
                  ["car", "mapbiomas", "current_image"], "fontes_divergentes", True)

    conflict_consolidated = _intersection(car_consolidated, _union_geometries([map_vegetation, current_vegetation]))
    conflict = _union_geometries([conflict_consolidated, divergence])
    _append_layer(layers, "conflito_ambiental", "Conflito ambiental", conflict, metric_crs, 0.30,
                  ["car", "mapbiomas", "current_image"], "area_consolidada_ou_vegetacao_divergente", True)

    final_vegetation = _union_geometries([high, medium_map_image, car_validated])
    _append_layer(layers, "vegetacao_final", "Vegetação final", final_vegetation, metric_crs, 0.79,
                  ["mapbiomas", "car", "current_image"], "uniao_das_regras_de_vegetacao_valida", False)

    hydro_with_app = _intersection(ana_hydro, car_app) if has_car_evidence else GeometryCollection()
    possible_missing_app = _difference(ana_hydro, car_app) if has_car_evidence else GeometryCollection()
    _append_layer(layers, "hidrografia_com_app_declarada", "Hidrografia com APP declarada", hydro_with_app, metric_crs, 0.82,
                  ["ana", "car"], "hidrografia_ana_intersecta_app_car", False)
    _append_layer(layers, "possivel_app_hidrica_ausente", "Possível APP hídrica ausente", possible_missing_app, metric_crs, 0.60,
                  ["ana", "car"], "hidrografia_ana_sem_app_car", True)

    water_high = _intersection(map_water, ana_water, car_reservoir)
    water_map_only = _difference(map_water, _union_geometries([ana_water, car_reservoir, current_water]))
    reservoir_declared = _difference(car_reservoir, _union_geometries([map_water, ana_water, current_water]))
    _append_layer(layers, "agua_alta_confianca", "Água de alta confiança", water_high, metric_crs, 0.90,
                  ["mapbiomas", "ana", "car"], "consenso_agua_triplo", False)
    _append_layer(layers, "agua_detectada_mapbiomas", "Água detectada pelo MapBiomas", water_map_only, metric_crs, 0.60,
                  ["mapbiomas"], "agua_apenas_mapbiomas", True)
    _append_layer(layers, "reservatorio_declarado_car", "Reservatório declarado no CAR", reservoir_declared, metric_crs, 0.55,
                  ["car"], "reservatorio_apenas_car", True)

    for layer in layers:
        tier = "SILVER" if layer.key == "vegetacao_alta_confianca" else "DISPUTED" if (layer.metadata or {}).get("review_required") else "BRONZE"
        candidates.append(_training_candidate(layer, tier))

    summary = {
        "source_weights": SOURCE_WEIGHTS,
        "sources_present": _sources_present(by_key),
        "vegetacao_final_ha": _area_for(layers, "vegetacao_final"),
        "alta_confianca_ha": _area_for(layers, "vegetacao_alta_confianca"),
        "media_confianca_ha": _area_for(layers, "vegetacao_media_confianca"),
        "divergencia_ha": _area_for(layers, "vegetacao_divergencia"),
        "conflito_ambiental_ha": _area_for(layers, "conflito_ambiental"),
    }
    warnings = []
    if not car_vegetation and any(key.startswith("vegetacao_car") for key in by_key):
        warnings.append("Camadas CAR foram consultadas, mas não continham vegetação válida na AOI.")
    return FusionResult(layers=layers, candidates=candidates, summary=summary, warnings=warnings)


def _append_layer(
    target: list[EnvironmentalLayer], key: str, name: str, geometry: BaseGeometry, metric_crs: str,
    confidence_score: float, sources: list[str], rule: str, review_required: bool,
) -> None:
    if geometry.is_empty:
        return
    area_ha, length_m = _measure(geometry, metric_crs)
    target.append(EnvironmentalLayer(
        key=key,
        name=name,
        geometry=geometry,
        provider="fusion_engine",
        confidence=_confidence_label(confidence_score),
        official_data=False,
        area_ha=area_ha,
        length_m=length_m,
        metadata={
            "confidence_score": confidence_score,
            "confidence_label": _confidence_label(confidence_score),
            "sources_used": sources,
            "source_agreement": not review_required,
            "source_conflict": review_required,
            "rule_applied": rule,
            "review_required": review_required,
            "notes": "Fusão espacial determinística; revisar antes de uso técnico conclusivo.",
        },
    ))


def _training_candidate(layer: EnvironmentalLayer, tier: str) -> TrainingCandidate:
    payload = f"{layer.key}:{layer.geometry.wkb_hex}"
    return TrainingCandidate(
        source_layer=layer.key,
        final_class=_final_class(layer.key),
        geometry=layer.geometry,
        label_source="consensus_auto",
        confidence_score=float((layer.metadata or {}).get("confidence_score") or 0),
        confidence_tier=tier,
        validation_status="candidate",
        fingerprint=sha256(payload.encode("utf-8")).hexdigest(),
        metadata={**(layer.metadata or {}), "geometry_geojson": mapping(layer.geometry)},
    )


def _union(by_key: dict[str, EnvironmentalLayer], keys: list[str]) -> BaseGeometry:
    return _union_geometries([by_key[key].geometry for key in keys if key in by_key])


def _union_geometries(geometries: list[BaseGeometry]) -> BaseGeometry:
    valid = [geometry for geometry in geometries if geometry is not None and not geometry.is_empty]
    if not valid:
        return GeometryCollection()
    result = unary_union(valid)
    return result if result.geom_type in {"LineString", "MultiLineString"} else result.buffer(0)


def _intersection(*geometries: BaseGeometry) -> BaseGeometry:
    valid = [geometry for geometry in geometries if geometry is not None and not geometry.is_empty]
    if len(valid) != len(geometries) or not valid:
        return GeometryCollection()
    result = valid[0]
    for geometry in valid[1:]:
        result = result.intersection(geometry)
        if result.is_empty:
            break
    return result.buffer(0) if not result.is_empty and result.geom_type not in {"LineString", "MultiLineString"} else result


def _difference(source: BaseGeometry, subtract: BaseGeometry) -> BaseGeometry:
    if source.is_empty:
        return GeometryCollection()
    result = source if subtract.is_empty else source.difference(subtract)
    return result.buffer(0) if not result.is_empty and result.geom_type not in {"LineString", "MultiLineString"} else result


def _measure(geometry: BaseGeometry, metric_crs: str) -> tuple[float | None, float | None]:
    metric = transform(Transformer.from_crs("EPSG:4326", metric_crs, always_xy=True).transform, geometry)
    area = round(float(metric.area) / 10_000, 4) if metric.area > 0 else None
    length = round(float(metric.length), 2) if metric.length > 0 else None
    return area, length


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "alta"
    if score >= 0.65:
        return "média"
    return "revisão"


def _final_class(layer_key: str) -> str:
    if "agua" in layer_key or "reservatorio" in layer_key:
        return "agua"
    if "agro" in layer_key:
        return "agropecuaria"
    if "solo" in layer_key:
        return "solo_exposto"
    if "vegetacao" in layer_key:
        return "vegetacao"
    return "outro"


def _area_for(layers: list[EnvironmentalLayer], key: str) -> float:
    layer = next((item for item in layers if item.key == key), None)
    return float(layer.area_ha or 0) if layer else 0.0


def _sources_present(by_key: dict[str, EnvironmentalLayer]) -> list[str]:
    present: set[str] = set()
    for layer in by_key.values():
        provider = layer.provider.lower()
        if "mapbiomas" in provider:
            present.add("mapbiomas")
        elif provider.startswith("car"):
            present.add("car")
        elif "ana" in provider:
            present.add("ana")
        elif provider in {"rule_based_ndvi", "dynamic_world", "current_image"}:
            present.add("current_image")
    return sorted(present)
