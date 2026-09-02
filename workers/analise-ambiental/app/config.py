from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import os


WORKER_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    worker_secret: str
    storage_bucket: str
    tmp_dir: Path
    local_fixture_enabled: bool
    local_fixture_dir: Path
    provider: str
    mapbiomas_raster_url: str
    mapbiomas_raster_local_path: str
    mapbiomas_year: int
    mapbiomas_collection: str
    mapbiomas_asset_id: str
    gee_project_id: str
    gee_service_account_email: str
    gee_private_key: str
    gee_service_account_json_base64: str
    gee_enabled: bool
    hidro_provider: str
    ana_bho6_trecho_drenagem_url: str
    ana_bho6_trecho_drenagem_path: str
    ana_bho6_curso_dagua_url: str
    ana_bho6_area_drenagem_url: str
    ana_massas_dagua_url: str
    ana_hidro_cache_dir: Path
    ana_hidro_enable_arcgis_fallback: bool
    poll_enabled: bool
    poll_interval_seconds: int
    poll_limit: int
    debug: bool
    car_provider_enabled: bool = False
    car_provider_mode: str = "manifest"
    car_source_manifest_url: str = ""
    car_cache_dir: Path = WORKER_DIR / "tmp" / "car"
    car_max_download_mb: float = 300
    car_max_aoi_ha: float = 50000
    car_allow_full_state_download: bool = False
    current_image_provider_enabled: bool = True
    current_image_source_priority: tuple[str, ...] = ("meuimovel", "buscageo", "dynamic_world", "manual")
    current_image_nir_band: int = 4
    current_image_red_band: int = 3
    dynamic_world_enabled: bool = False
    dynamic_world_min_probability: float = 0.55
    ndvi_vegetation_threshold: float = 0.35
    vegetation_model_provider: str = "rule_based_ndvi"
    vegetation_segmenter_provider: str = ""
    geoai_enabled: bool = False
    custom_vegetation_model_enabled: bool = False
    custom_vegetation_model_path: str = ""
    custom_vegetation_model_version: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    tmp_dir = Path(os.environ.get("ANALISE_AMBIENTAL_TMP_DIR", WORKER_DIR / "tmp"))
    fixture_dir = Path(os.environ.get("ANALISE_AMBIENTAL_LOCAL_DATA_DIR", WORKER_DIR / "data" / "dev"))
    ana_hidro_cache_dir = Path(os.environ.get("ANA_HIDRO_CACHE_DIR", WORKER_DIR / "data" / "ana"))
    car_cache_dir = Path(os.environ.get("CAR_CACHE_DIR", WORKER_DIR / "tmp" / "car"))
    tmp_dir.mkdir(parents=True, exist_ok=True)
    fixture_dir.mkdir(parents=True, exist_ok=True)
    ana_hidro_cache_dir.mkdir(parents=True, exist_ok=True)
    car_cache_dir.mkdir(parents=True, exist_ok=True)
    return Settings(
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        worker_secret=os.environ.get("ANALISE_AMBIENTAL_WORKER_SECRET", ""),
        storage_bucket=os.environ.get("ANALISE_AMBIENTAL_STORAGE_BUCKET", "documentos"),
        tmp_dir=tmp_dir,
        local_fixture_enabled=_env_bool("ANALISE_AMBIENTAL_LOCAL_FIXTURE_ENABLED", default=True),
        local_fixture_dir=fixture_dir,
        provider=os.environ.get("ANALISE_AMBIENTAL_PROVIDER", "dev_fixture").strip().lower() or "dev_fixture",
        mapbiomas_raster_url=os.environ.get("MAPBIOMAS_RASTER_URL", "").strip(),
        mapbiomas_raster_local_path=os.environ.get("MAPBIOMAS_RASTER_LOCAL_PATH", "").strip(),
        mapbiomas_year=int(os.environ.get("MAPBIOMAS_YEAR", "2025")),
        mapbiomas_collection=os.environ.get("MAPBIOMAS_COLLECTION", "coverage_10m").strip() or "coverage_10m",
        mapbiomas_asset_id=os.environ.get("MAPBIOMAS_10M_ASSET_ID", "").strip(),
        gee_project_id=os.environ.get("GEE_PROJECT_ID", "").strip(),
        gee_service_account_email=os.environ.get("GEE_SERVICE_ACCOUNT_EMAIL", "").strip(),
        gee_private_key=os.environ.get("GEE_PRIVATE_KEY", "").strip(),
        gee_service_account_json_base64=os.environ.get("GEE_SERVICE_ACCOUNT_JSON_BASE64", "").strip(),
        gee_enabled=_env_bool("ANALISE_AMBIENTAL_GEE_ENABLED", default=False),
        hidro_provider=os.environ.get("ANALISE_AMBIENTAL_HIDRO_PROVIDER", "").strip().lower(),
        ana_bho6_trecho_drenagem_url=os.environ.get("ANA_BHO6_TRECHO_DRENAGEM_URL", "").strip(),
        ana_bho6_trecho_drenagem_path=os.environ.get("ANA_BHO6_TRECHO_DRENAGEM_PATH", "").strip(),
        ana_bho6_curso_dagua_url=os.environ.get("ANA_BHO6_CURSO_DAGUA_URL", "").strip(),
        ana_bho6_area_drenagem_url=os.environ.get("ANA_BHO6_AREA_DRENAGEM_URL", "").strip(),
        ana_massas_dagua_url=os.environ.get("ANA_MASSAS_DAGUA_URL", "").strip(),
        ana_hidro_cache_dir=ana_hidro_cache_dir,
        ana_hidro_enable_arcgis_fallback=_env_bool("ANA_HIDRO_ENABLE_ARCGIS_FALLBACK", default=False),
        car_provider_enabled=_env_bool("CAR_PROVIDER_ENABLED", default=False),
        car_provider_mode=os.environ.get("CAR_PROVIDER_MODE", "manifest").strip().lower() or "manifest",
        car_source_manifest_url=os.environ.get("CAR_SOURCE_MANIFEST_URL", "").strip(),
        car_cache_dir=car_cache_dir,
        car_max_download_mb=max(1.0, float(os.environ.get("CAR_MAX_DOWNLOAD_MB", "300"))),
        car_max_aoi_ha=max(1.0, float(os.environ.get("CAR_MAX_AOI_HA", "50000"))),
        car_allow_full_state_download=_env_bool("CAR_ALLOW_FULL_STATE_DOWNLOAD", default=False),
        current_image_provider_enabled=_env_bool("CURRENT_IMAGE_PROVIDER_ENABLED", default=True),
        current_image_source_priority=tuple(
            item.strip().lower()
            for item in os.environ.get("CURRENT_IMAGE_SOURCE_PRIORITY", "meuimovel,buscageo,dynamic_world,manual").split(",")
            if item.strip()
        ),
        current_image_nir_band=max(1, int(os.environ.get("CURRENT_IMAGE_NIR_BAND", "4"))),
        current_image_red_band=max(1, int(os.environ.get("CURRENT_IMAGE_RED_BAND", "3"))),
        dynamic_world_enabled=_env_bool("DYNAMIC_WORLD_ENABLED", default=False),
        dynamic_world_min_probability=min(1.0, max(0.0, float(os.environ.get("DYNAMIC_WORLD_MIN_PROBABILITY", "0.55")))),
        ndvi_vegetation_threshold=min(1.0, max(-1.0, float(os.environ.get("NDVI_VEGETATION_THRESHOLD", "0.35")))),
        vegetation_model_provider=os.environ.get("VEGETATION_MODEL_PROVIDER", "rule_based_ndvi").strip().lower(),
        vegetation_segmenter_provider=os.environ.get("VEGETATION_SEGMENTER_PROVIDER", "").strip().lower(),
        geoai_enabled=_env_bool("GEOAI_ENABLED", default=False),
        custom_vegetation_model_enabled=_env_bool("CUSTOM_VEGETATION_MODEL_ENABLED", default=False),
        custom_vegetation_model_path=os.environ.get("CUSTOM_VEGETATION_MODEL_PATH", "").strip(),
        custom_vegetation_model_version=os.environ.get("CUSTOM_VEGETATION_MODEL_VERSION", "").strip(),
        poll_enabled=_env_bool("ANALISE_AMBIENTAL_POLL_ENABLED", default=False),
        poll_interval_seconds=max(10, int(os.environ.get("ANALISE_AMBIENTAL_POLL_INTERVAL_SECONDS", "60"))),
        poll_limit=max(1, int(os.environ.get("ANALISE_AMBIENTAL_POLL_LIMIT", "3"))),
        debug=_env_bool("ANALISE_AMBIENTAL_DEBUG", default=False),
    )


def _env_bool(name: str, *, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "sim", "on"}
