from __future__ import annotations

from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    output_dir = settings.local_fixture_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    raster_path = output_dir / "mapbiomas_fixture.tif"
    width = height = 100
    data = np.zeros((height, width), dtype=np.uint8)
    data[10:65, 10:70] = 3
    data[62:88, 35:90] = 33

    transform = from_origin(-48.1, -15.8, 0.002, 0.002)
    with rasterio.open(
        raster_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
        nodata=0,
    ) as dataset:
        dataset.write(data, 1)

    kml_path = output_dir / "aoi_fixture.kml"
    kml_path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>AOI fixture</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -48.06,-15.84,0 -47.94,-15.84,0 -47.94,-15.94,0 -48.06,-15.94,0 -48.06,-15.84,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
""",
        encoding="utf-8",
    )
    print(f"Fixture criada em: {output_dir}")


if __name__ == "__main__":
    main()
