from __future__ import annotations

from pathlib import Path
from typing import Callable
import os
import shutil

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

ProgressCallback = Callable[[int, str], None]

EXCLUDE_TERMS = ["IGNORAR", "CBERS_FINAL", "MOSAICO", "MEDIANA", "MEDOID", "_TEMP"]


def process_mosaic(
    selected_paths: list[Path],
    output_dir: Path,
    temp_dir: Path,
    progress: ProgressCallback | None = None,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

    files = _filter_input_files(selected_paths)
    if not 1 <= len(files) <= 2:
        raise ValueError("Selecione 1 ou 2 imagens para processar.")

    ref = gdal.Open(str(files[0]))
    if ref is None:
        raise RuntimeError("Nao foi possivel abrir a imagem base.")

    xsize = ref.RasterXSize
    ysize = ref.RasterYSize
    gt = ref.GetGeoTransform()
    proj = ref.GetProjection()
    min_x = gt[0]
    max_y = gt[3]
    max_x = gt[0] + gt[1] * xsize
    min_y = gt[3] + gt[5] * ysize
    xres = abs(gt[1])
    yres = abs(gt[5])
    ref = None

    _update(progress, 30, "Imagem base carregada")

    def align_to_reference(path: Path) -> Path:
        output = temp_dir / f"aligned_{path.name}"
        if output.exists():
            output.unlink()

        options = gdal.WarpOptions(
            format="GTiff",
            dstSRS=proj,
            outputBounds=[min_x, min_y, max_x, max_y],
            xRes=xres,
            yRes=yres,
            srcNodata=0,
            dstNodata=0,
            resampleAlg="bilinear",
            multithread=False,
            creationOptions=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"],
        )

        dataset = gdal.Warp(str(output), str(path), options=options)
        if dataset is None:
            raise RuntimeError("Falha ao alinhar imagem.")

        dataset.FlushCache()
        dataset = None
        return output

    aligned_files = [align_to_reference(path) for path in files]
    _update(progress, 45, "Realinhamento concluido")

    def read_rgb(path: Path) -> np.ndarray:
        dataset = gdal.Open(str(path))
        if dataset is None:
            raise RuntimeError("Nao foi possivel abrir imagem selecionada.")

        if dataset.RasterCount < 3:
            raise RuntimeError("Imagem selecionada nao possui 3 bandas RGB.")

        bands: list[np.ndarray] = []
        for index in [1, 2, 3]:
            band = dataset.GetRasterBand(index)
            array = band.ReadAsArray().astype(np.float32)
            nodata = band.GetNoDataValue()
            if nodata is not None:
                array[array == nodata] = np.nan
            bands.append(array)

        dataset = None
        rgb = np.stack(bands)
        black_mask = np.nansum(rgb, axis=0) <= 0
        rgb[:, black_mask] = np.nan
        return rgb

    def normalize_to_reference(rgb: np.ndarray, rgb_ref: np.ndarray) -> np.ndarray:
        corrected = rgb.copy()

        for band_index in range(3):
            src = rgb[band_index]
            ref_band = rgb_ref[band_index]
            overlap = np.isfinite(src) & np.isfinite(ref_band)

            if np.count_nonzero(overlap) > 1000:
                src_values = src[overlap]
                ref_values = ref_band[overlap]
            else:
                src_values = src[np.isfinite(src)]
                ref_values = ref_band[np.isfinite(ref_band)]

            if src_values.size < 1000 or ref_values.size < 1000:
                continue

            src_p2, src_p98 = np.percentile(src_values, [2, 98])
            ref_p2, ref_p98 = np.percentile(ref_values, [2, 98])
            if src_p98 <= src_p2 or ref_p98 <= ref_p2:
                continue

            adjusted = (src - src_p2) / (src_p98 - src_p2)
            adjusted = adjusted * (ref_p98 - ref_p2) + ref_p2
            corrected[band_index] = adjusted

        return corrected

    def save_float(output_path: Path, rgb: np.ndarray, nodata: float = -9999) -> None:
        driver = gdal.GetDriverByName("GTiff")
        output = driver.Create(
            str(output_path),
            xsize,
            ysize,
            3,
            gdal.GDT_Float32,
            options=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"],
        )
        output.SetGeoTransform(gt)
        output.SetProjection(proj)

        for index in range(3):
            band = output.GetRasterBand(index + 1)
            array = np.where(np.isnan(rgb[index]), nodata, rgb[index]).astype(np.float32)
            band.WriteArray(array)
            band.SetNoDataValue(nodata)

        output.FlushCache()
        output = None

    def save_byte(output_path: Path, rgb8: np.ndarray) -> None:
        driver = gdal.GetDriverByName("GTiff")
        output = driver.Create(
            str(output_path),
            xsize,
            ysize,
            3,
            gdal.GDT_Byte,
            options=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"],
        )
        output.SetGeoTransform(gt)
        output.SetProjection(proj)

        for index in range(3):
            output.GetRasterBand(index + 1).WriteArray(rgb8[index])

        output.FlushCache()
        output = None

    rgb_base = read_rgb(aligned_files[0])
    mosaico = rgb_base.copy()

    if len(aligned_files) == 2:
        secondary = read_rgb(aligned_files[1])
        secondary = normalize_to_reference(secondary, rgb_base)
        _update(progress, 60, "Normalizacao de cores concluida")

        mosaic_valid = np.isfinite(mosaico).all(axis=0)
        secondary_valid = np.isfinite(secondary).all(axis=0)
        fill = (~mosaic_valid) & secondary_valid
        for band_index in range(3):
            mosaico[band_index, fill] = secondary[band_index, fill]
    else:
        _update(progress, 60, "Imagem unica preparada")

    _update(progress, 75, "Mosaico criado")

    float_path = output_dir / "CBERS_MOSAICO_CORRIGIDO.tif"
    save_float(float_path, mosaico)

    band_8bit = _stretch_per_band_8bit(mosaico)
    band_path = output_dir / "CBERS_MOSAICO_CORRIGIDO_VISUAL_BANDA_8BIT.tif"
    save_byte(band_path, band_8bit)
    _update(progress, 85, "Arquivo 8bit por banda criado")

    return band_path


def apply_cubic_reprojection(
    input_tif: Path,
    output_tif: Path,
    dst_srs: str | None = None,
) -> Path:
    output_tif.parent.mkdir(parents=True, exist_ok=True)
    if output_tif.exists():
        output_tif.unlink()

    dataset = gdal.Open(str(input_tif))
    if dataset is None:
        raise RuntimeError("Nao foi possivel abrir o arquivo para reprojecao.")

    target_srs = dst_srs or dataset.GetProjection() or None
    dataset = None

    options = gdal.WarpOptions(
        format="GTiff",
        dstSRS=target_srs,
        resampleAlg="cubic",
        multithread=False,
        creationOptions=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"],
    )

    output = gdal.Warp(str(output_tif), str(input_tif), options=options)
    if output is None:
        raise RuntimeError("Falha na reprojecao cubic.")

    output.FlushCache()
    output = None
    return output_tif


def copy_final_for_download(input_tif: Path, output_dir: Path, image_date: str) -> tuple[Path, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    date_part = (image_date or "CBERS")[:10]
    filename = f"{date_part}.tif" if date_part != "CBERS" else "CBERS.tif"
    output_path = output_dir / filename

    if output_path.exists():
        filename = f"{date_part}_CBERS.tif" if date_part != "CBERS" else "CBERS_FINAL.tif"
        output_path = output_dir / filename

    shutil.copy2(input_tif, output_path)
    return output_path, filename


def _filter_input_files(paths: list[Path]) -> list[Path]:
    filtered: list[Path] = []
    seen: set[str] = set()

    for path in paths:
        name = path.name
        name_upper = name.upper()
        key = os.path.abspath(path).lower()

        if key in seen:
            continue
        if not name_upper.endswith((".TIF", ".TIFF")):
            continue
        if any(term in name_upper for term in EXCLUDE_TERMS):
            continue

        filtered.append(path)
        seen.add(key)

    return filtered


def _stretch_per_band_8bit(rgb: np.ndarray) -> np.ndarray:
    output_bands: list[np.ndarray] = []

    for index in range(3):
        array = rgb[index]
        valid = array[np.isfinite(array)]

        if valid.size == 0:
            output_bands.append(np.zeros_like(array, dtype=np.uint8))
            continue

        p2, p98 = np.percentile(valid, [2, 98])
        if p98 <= p2:
            output_bands.append(np.zeros_like(array, dtype=np.uint8))
            continue

        output = (array - p2) / (p98 - p2) * 255
        output = np.clip(output, 0, 255)
        output_bands.append(np.where(np.isnan(output), 0, output).astype(np.uint8))

    return np.stack(output_bands)


def _update(progress: ProgressCallback | None, value: int, message: str) -> None:
    if progress:
        progress(value, message)
