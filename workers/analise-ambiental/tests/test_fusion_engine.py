from shapely.geometry import box

from app.fusion.fusion_engine import fuse_environmental_sources
from app.processing.layers import EnvironmentalLayer


def layer(key: str, geometry, provider: str) -> EnvironmentalLayer:
    return EnvironmentalLayer(key=key, name=key, geometry=geometry, provider=provider, confidence="teste", official_data=False)


def test_triple_consensus_generates_high_confidence_and_silver_sample():
    result = fuse_environmental_sources([
        layer("vegetacao_mapbiomas", box(-50, -20, -49.9, -19.9), "mapbiomas_gee"),
        layer("vegetacao_car_declarada", box(-49.98, -19.98, -49.92, -19.92), "car_manifest"),
        layer("vegetacao_imagem_atual", box(-49.97, -19.97, -49.91, -19.91), "rule_based_ndvi"),
    ], metric_crs="EPSG:31982")
    high = next(item for item in result.layers if item.key == "vegetacao_alta_confianca")
    assert high.area_ha and high.area_ha > 0
    assert high.metadata["sources_used"] == ["mapbiomas", "car", "current_image"]
    assert next(item for item in result.candidates if item.source_layer == high.key).confidence_tier == "SILVER"


def test_car_mapbiomas_divergence_is_not_hidden():
    result = fuse_environmental_sources([
        layer("vegetacao_car_declarada", box(-50, -20, -49.9, -19.9), "car_manifest"),
        layer("agropecuaria_mapbiomas", box(-49.98, -19.98, -49.92, -19.92), "mapbiomas_gee"),
    ], metric_crs="EPSG:31982")
    divergence = next(item for item in result.layers if item.key == "vegetacao_divergencia")
    assert divergence.metadata["review_required"] is True
    assert next(item for item in result.candidates if item.source_layer == divergence.key).confidence_tier == "DISPUTED"


def test_current_image_can_validate_car_without_mapbiomas():
    result = fuse_environmental_sources([
        layer("vegetacao_car_declarada", box(-50, -20, -49.9, -19.9), "car_manifest"),
        layer("vegetacao_imagem_atual", box(-49.98, -19.98, -49.92, -19.92), "rule_based_ndvi"),
    ], metric_crs="EPSG:31982")
    assert any(item.key == "vegetacao_car_validada_por_imagem_atual" for item in result.layers)
