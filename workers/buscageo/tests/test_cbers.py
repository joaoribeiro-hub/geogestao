from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_bounds

from app.cbers import create_preview, crop_remote_cbers_image, validate_geotiff


def test_crop_and_preview_with_rasterio_fallback(tmp_path: Path) -> None:
    source_path = tmp_path / "source.tif"
    crop_path = tmp_path / "crop.tif"
    preview_path = tmp_path / "preview.png"
    width = 256
    height = 256
    transform = from_bounds(-49.26, -16.69, -49.24, -16.67, width, height)
    data = np.stack(
        [
            np.full((height, width), 40, dtype=np.uint8),
            np.full((height, width), 120, dtype=np.uint8),
            np.full((height, width), 220, dtype=np.uint8),
        ]
    )

    with rasterio.open(
        source_path,
        "w",
        driver="GTiff",
        width=width,
        height=height,
        count=3,
        dtype="uint8",
        crs="EPSG:4326",
        transform=transform,
    ) as dataset:
        dataset.write(data)

    crop_remote_cbers_image(
        str(source_path),
        (-49.2555, -16.68045, -49.25456, -16.67955),
        crop_path,
    )

    assert validate_geotiff(crop_path)
    with rasterio.open(crop_path) as cropped:
        assert 0 < cropped.width < width
        assert 0 < cropped.height < height
        assert cropped.count == 3

    create_preview(crop_path, preview_path)
    assert preview_path.exists()
    assert preview_path.stat().st_size > 0
