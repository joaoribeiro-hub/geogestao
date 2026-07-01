from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import zipfile

from osgeo import ogr, osr


@dataclass(frozen=True)
class ParsedArea:
    geometry_wkt: str
    bbox: tuple[float, float, float, float]
    source_epsg: int | None
    source_wkt: str | None


def parse_area_file(upload_path: Path) -> ParsedArea:
    vector_path = _prepare_vector_path(upload_path)
    dataset = ogr.Open(str(vector_path))

    if dataset is None:
        raise ValueError("Nao foi possivel ler o arquivo enviado.")

    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    _set_traditional_axis(target_srs)

    envelopes: list[tuple[float, float, float, float]] = []
    geometry_union = None
    source_epsg: int | None = None
    source_wkt: str | None = None

    for layer_index in range(dataset.GetLayerCount()):
        layer = dataset.GetLayerByIndex(layer_index)
        if layer is None:
            continue

        source_srs = layer.GetSpatialRef()
        if source_srs is None:
            source_srs = osr.SpatialReference()
            source_srs.ImportFromEPSG(4326)

        _set_traditional_axis(source_srs)

        if source_epsg is None:
            authority = source_srs.GetAuthorityCode(None)
            source_epsg = int(authority) if authority and authority.isdigit() else None
            source_wkt = source_srs.ExportToWkt()

        transform = osr.CoordinateTransformation(source_srs, target_srs)
        layer.ResetReading()

        for feature in layer:
            geometry = feature.GetGeometryRef()
            if geometry is None or geometry.IsEmpty():
                continue

            transformed = geometry.Clone()
            transformed.Transform(transform)

            min_x, max_x, min_y, max_y = transformed.GetEnvelope()
            envelopes.append((min_x, min_y, max_x, max_y))

            if geometry_union is None:
                geometry_union = transformed.Clone()
            else:
                geometry_union = geometry_union.Union(transformed)

    dataset = None

    if not envelopes or geometry_union is None:
        raise ValueError("Nao foi possivel ler a geometria do arquivo enviado.")

    bbox = _merge_envelopes(envelopes)
    return ParsedArea(
        geometry_wkt=geometry_union.ExportToWkt(),
        bbox=bbox,
        source_epsg=source_epsg,
        source_wkt=source_wkt,
    )


def expand_bbox(
    bbox: tuple[float, float, float, float],
    factor: float = 1.5,
) -> tuple[float, float, float, float]:
    min_x, min_y, max_x, max_y = bbox
    width = max_x - min_x
    height = max_y - min_y

    if width <= 0 or height <= 0:
        raise ValueError("A geometria enviada nao possui area suficiente.")

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    expanded_width = width * factor
    expanded_height = height * factor

    return (
        center_x - expanded_width / 2,
        center_y - expanded_height / 2,
        center_x + expanded_width / 2,
        center_y + expanded_height / 2,
    )


def _prepare_vector_path(upload_path: Path) -> Path:
    suffix = upload_path.suffix.lower()

    if suffix == ".zip":
        extract_dir = upload_path.parent / "shapefile"
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(upload_path) as archive:
            _safe_extract(archive, extract_dir)

        shp_files = list(extract_dir.rglob("*.shp"))
        if not shp_files:
            raise ValueError("O ZIP enviado nao contem um arquivo .shp.")

        required_extensions = {".shp", ".shx", ".dbf", ".prj"}
        available = {path.suffix.lower() for path in shp_files[0].parent.iterdir()}
        missing = required_extensions - available
        if missing:
            missing_text = ", ".join(sorted(missing))
            raise ValueError(f"O Shapefile ZIP esta incompleto: {missing_text}.")

        return shp_files[0]

    if suffix == ".kmz":
        extract_dir = upload_path.parent / "kmz"
        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(upload_path) as archive:
            _safe_extract(archive, extract_dir)

        kml_files = list(extract_dir.rglob("*.kml"))
        if not kml_files:
            raise ValueError("O KMZ enviado nao contem um arquivo KML.")
        return kml_files[0]

    if suffix == ".kml":
        return upload_path

    raise ValueError("Envie um arquivo KML, KMZ ou ZIP de Shapefile.")


def _merge_envelopes(
    envelopes: Iterable[tuple[float, float, float, float]],
) -> tuple[float, float, float, float]:
    min_x_values: list[float] = []
    min_y_values: list[float] = []
    max_x_values: list[float] = []
    max_y_values: list[float] = []

    for min_x, min_y, max_x, max_y in envelopes:
        min_x_values.append(min_x)
        min_y_values.append(min_y)
        max_x_values.append(max_x)
        max_y_values.append(max_y)

    return (min(min_x_values), min(min_y_values), max(max_x_values), max(max_y_values))


def _set_traditional_axis(srs: osr.SpatialReference) -> None:
    try:
        srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    except AttributeError:
        pass


def _safe_extract(archive: zipfile.ZipFile, target_dir: Path) -> None:
    target_root = target_dir.resolve()
    for member in archive.infolist():
        destination = (target_dir / member.filename).resolve()
        try:
            destination.relative_to(target_root)
        except ValueError:
            raise ValueError("Arquivo compactado contem caminho invalido.")
    archive.extractall(target_dir)
