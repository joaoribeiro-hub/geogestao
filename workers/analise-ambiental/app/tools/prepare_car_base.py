from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
from typing import Any
import json

import geopandas as gpd
import pandas as pd

from app.providers.car_provider import CAR_LAYER_NAMES


def prepare_car_base(
    input_path: Path,
    output_dir: Path,
    *,
    uf: str,
    year: str,
    layer: str,
    municipality_code: str | None = None,
    municipality_column: str | None = None,
    base_url: str | None = None,
) -> Path:
    if layer not in CAR_LAYER_NAMES:
        raise ValueError(f"Camada CAR inválida: {layer}")
    files = _input_files(input_path)
    frames = [gpd.read_file(path) for path in files]
    if not frames:
        raise ValueError("Nenhum arquivo vetorial CAR encontrado.")
    frame = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=frames[0].crs)
    if frame.crs is None:
        raise ValueError("Base CAR sem CRS; informe CRS no arquivo antes de preparar.")
    frame = frame[frame.geometry.notna() & ~frame.geometry.is_empty].to_crs("EPSG:4674")
    if municipality_column:
        if municipality_column not in frame.columns:
            raise ValueError(f"Coluna municipal ausente: {municipality_column}")
        groups = ((str(code), group.copy()) for code, group in frame.groupby(frame[municipality_column].astype(str)))
    elif municipality_code:
        groups = iter([(municipality_code, frame)])
    else:
        raise ValueError("Informe municipality_code ou municipality_column; base estadual inteira não será gerada.")

    manifest_path = output_dir / "environmental_sources_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"version": "1", "car": {}}
    for code, municipal in groups:
        target_dir = output_dir / "car" / uf.lower() / str(year) / code
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{layer}.fgb"
        municipal.to_file(target, driver="FlatGeobuf")
        relative = target.relative_to(output_dir).as_posix()
        entry = {
            "format": "fgb",
            "url": f"{base_url.rstrip('/')}/{relative}" if base_url else str(target.resolve()),
            "source": "SICAR/SIGCAR",
            "version": str(year),
            "scope": "municipality",
            "feature_count": int(len(municipal)),
            "bbox": [float(value) for value in municipal.total_bounds],
            "size_bytes": target.stat().st_size,
        }
        manifest.setdefault("car", {}).setdefault(uf.lower(), {}).setdefault(str(year), {}).setdefault(code, {})[layer] = entry
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def _input_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    extensions = {".shp", ".gpkg", ".geojson", ".json", ".fgb"}
    return [candidate for candidate in path.rglob("*") if candidate.suffix.lower() in extensions]


def main() -> None:
    parser = ArgumentParser(description="Converte recortes CAR para FlatGeobuf municipal e atualiza o manifest.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--uf", required=True)
    parser.add_argument("--year", required=True)
    parser.add_argument("--layer", required=True, choices=sorted(CAR_LAYER_NAMES))
    parser.add_argument("--municipality-code")
    parser.add_argument("--municipality-column")
    parser.add_argument("--base-url")
    args = parser.parse_args()
    result = prepare_car_base(args.input, args.output, uf=args.uf, year=args.year, layer=args.layer,
                              municipality_code=args.municipality_code, municipality_column=args.municipality_column,
                              base_url=args.base_url)
    print(result)


if __name__ == "__main__":
    main()
