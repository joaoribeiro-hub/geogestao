from __future__ import annotations

import zipfile

import pytest

pytest.importorskip("geopandas")
pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from app.processing.aoi import parse_aoi_file
from app.processing.exporters import write_geojson, write_kml, write_shapefile_zip, write_zip_package
from app.processing.layers import generate_dev_fixture_layers


def test_dev_fixture_generates_environmental_layers_and_outputs(tmp_path):
    aoi_file = tmp_path / "aoi.kml"
    aoi_file.write_text(_kml())
    aoi = parse_aoi_file(aoi_file)

    layers = generate_dev_fixture_layers(aoi, ["vegetacao", "agua", "drenagem"])
    assert {layer.key for layer in layers} == {"vegetacao_existente", "agua_represa", "drenagem_corrego"}

    package_files = {}
    for layer in layers:
        layer_dir = tmp_path / layer.key
        geojson = write_geojson(layer_dir / f"{layer.key}.geojson", layer.geometry.__geo_interface__)
        kml = write_kml(layer_dir / f"{layer.key}.kml", layer.geometry, layer.name)
        shp_zip = write_shapefile_zip(layer_dir / f"{layer.key}.shp.zip", layer.geometry, {"layer": layer.key})
        package_files[f"{layer.key}/{geojson.name}"] = geojson
        package_files[f"{layer.key}/{kml.name}"] = kml
        package_files[f"{layer.key}/{shp_zip.name}"] = shp_zip

        with zipfile.ZipFile(shp_zip) as archive:
            names = set(archive.namelist())
            assert any(name.endswith(".shp") for name in names)
            assert any(name.endswith(".shx") for name in names)
            assert any(name.endswith(".dbf") for name in names)
            assert any(name.endswith(".prj") for name in names)

    package = write_zip_package(tmp_path / "pacote_resultados.zip", package_files)
    assert package.exists()
    with zipfile.ZipFile(package) as archive:
        assert "vegetacao_existente/vegetacao_existente.geojson" in archive.namelist()


def _kml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>
-48.0,-16.0,0 -47.9,-16.0,0 -47.9,-16.1,0 -48.0,-16.1,0 -48.0,-16.0,0
</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""
