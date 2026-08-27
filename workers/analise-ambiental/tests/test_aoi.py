from __future__ import annotations

import pytest

pytest.importorskip("shapely")
pytest.importorskip("pyproj")

from app.processing.aoi import estimate_metric_crs, parse_aoi_file


def test_parse_valid_kml_polygon(tmp_path):
    kml = tmp_path / "area.kml"
    kml.write_text(_kml("-48.0,-16.0,0 -47.9,-16.0,0 -47.9,-16.1,0 -48.0,-16.1,0 -48.0,-16.0,0"))
    result = parse_aoi_file(kml)
    assert result.area_ha > 0
    assert result.metric_crs.startswith("EPSG:327")
    assert len(result.bbox) == 4
    assert result.geometry_geojson["type"] == "Polygon"


def test_parse_invalid_empty_kml(tmp_path):
    kml = tmp_path / "empty.kml"
    kml.write_text("<kml><Document /></kml>")
    with pytest.raises(ValueError):
        parse_aoi_file(kml)


def test_estimate_metric_crs_southern_hemisphere(tmp_path):
    kml = tmp_path / "area.kml"
    kml.write_text(_kml("-48.0,-16.0,0 -47.9,-16.0,0 -47.9,-16.1,0 -48.0,-16.1,0 -48.0,-16.0,0"))
    result = parse_aoi_file(kml)
    assert estimate_metric_crs(result.geometry) == result.metric_crs


def _kml(coordinates: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><Polygon>
<outerBoundaryIs><LinearRing><coordinates>{coordinates}</coordinates></LinearRing></outerBoundaryIs>
</Polygon></Placemark></Document></kml>"""
