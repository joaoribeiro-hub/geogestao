from __future__ import annotations

import json

import pytest

pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from app.processing.aoi import parse_aoi_file
from app.processing.exporters import write_geojson, write_json, write_kml
from app.providers.gee import GoogleEarthEngineMapBiomasProvider
from app.providers.local_raster import LocalRasterMapBiomasProvider


def test_export_geojson_kml_and_json(tmp_path):
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml())
    aoi = parse_aoi_file(aoi_file)
    geojson = write_geojson(tmp_path / "limite.geojson", aoi.geometry_geojson)
    kml = write_kml(tmp_path / "limite.kml", aoi.geometry)
    report = write_json(tmp_path / "relatorio.json", {"area_ha": aoi.area_ha})
    assert json.loads(geojson.read_text())["type"] == "FeatureCollection"
    assert "<kml" in kml.read_text()
    assert json.loads(report.read_text())["area_ha"] > 0


def test_gee_disabled_returns_warning(tmp_path):
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml())
    aoi = parse_aoi_file(aoi_file)
    result = GoogleEarthEngineMapBiomasProvider(enabled=False).analyze(aoi, tmp_path)
    assert result.source == "gee_mapbiomas"
    assert result.warnings


def test_local_provider_without_dataset_warns(tmp_path):
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml())
    aoi = parse_aoi_file(aoi_file)
    result = LocalRasterMapBiomasProvider(enabled=True, data_dir=tmp_path / "missing").analyze(aoi, tmp_path)
    assert result.source == "dev_fixture"
    assert "Fixture MapBiomas local nao encontrada" in result.warnings[0]


def _kml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
-48.0,-16.0,0 -47.9,-16.0,0 -47.9,-16.1,0 -48.0,-16.1,0 -48.0,-16.0,0
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""
