from __future__ import annotations

from pathlib import Path

import pytest

gpd = pytest.importorskip("geopandas")
pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from shapely.geometry import LineString

from app.config import Settings
from app.processing.aoi import parse_aoi_file
from app.providers.ana_hidrografia import AnaHidrografiaOficialProvider


def test_ana_hidrografia_provider_clips_bho6_gpkg(tmp_path):
    gpkg_path = tmp_path / "GEOFT_BHO_TRECHO_DRENAGEM.gpkg"
    _write_sample_bho6(gpkg_path)
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml(), encoding="utf-8")
    aoi = parse_aoi_file(aoi_file)

    provider = AnaHidrografiaOficialProvider(settings=_settings(tmp_path, gpkg_path))
    layers, warnings = provider.analyze(aoi, ["hidrografia_oficial"])

    assert warnings == []
    assert len(layers) == 1
    layer = layers[0]
    assert layer.key == "hidrografia_oficial"
    assert layer.provider == "ana_hidrografia_oficial"
    assert layer.official_data is True
    assert (layer.length_m or 0) > 0
    assert (layer.metadata or {}).get("source") == "ANA/SNIRH BHO 6"
    assert (layer.metadata or {}).get("version") == "6.2.4"
    assert (layer.metadata or {}).get("feature_count") == 1
    assert "Córrego Teste" in ((layer.metadata or {}).get("river_names") or [])


def test_ana_hidrografia_provider_requires_configuration(tmp_path):
    provider = AnaHidrografiaOficialProvider(settings=_settings(tmp_path, None))
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml(), encoding="utf-8")
    aoi = parse_aoi_file(aoi_file)

    layers, warnings = provider.analyze(aoi, ["hidrografia_oficial"])

    assert layers == []
    assert any("não configurado" in warning for warning in warnings)


def _write_sample_bho6(path: Path) -> None:
    data = gpd.GeoDataFrame(
        [
            {"nome": "Córrego Teste", "geometry": LineString([(-47.99, -16.02), (-47.95, -16.05)])},
            {"nome": "Rio Fora", "geometry": LineString([(-47.7, -16.2), (-47.6, -16.3)])},
        ],
        crs="EPSG:4674",
    )
    data.to_file(path, driver="GPKG")


def _settings(tmp_path: Path, gpkg_path: Path | None) -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        worker_secret="",
        storage_bucket="documentos",
        tmp_dir=tmp_path / "tmp",
        local_fixture_enabled=False,
        local_fixture_dir=tmp_path / "fixture",
        provider="mapbiomas_gee",
        mapbiomas_raster_url="",
        mapbiomas_raster_local_path="",
        mapbiomas_year=2024,
        mapbiomas_collection="coverage_10m",
        mapbiomas_asset_id="",
        gee_project_id="",
        gee_service_account_email="",
        gee_private_key="",
        gee_service_account_json_base64="",
        gee_enabled=False,
        hidro_provider="ana_bho6_gpkg",
        ana_bho6_trecho_drenagem_url="",
        ana_bho6_trecho_drenagem_path=str(gpkg_path) if gpkg_path else "",
        ana_bho6_curso_dagua_url="",
        ana_bho6_area_drenagem_url="",
        ana_massas_dagua_url="",
        ana_hidro_cache_dir=tmp_path / "ana",
        ana_hidro_enable_arcgis_fallback=False,
        poll_enabled=False,
        poll_interval_seconds=60,
        poll_limit=3,
        debug=False,
    )


def _kml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
-48.0,-16.0,0 -47.94,-16.0,0 -47.94,-16.06,0 -48.0,-16.06,0 -48.0,-16.0,0
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""
