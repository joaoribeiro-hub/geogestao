from functools import lru_cache
from supabase import create_client, Client
from .config import get_settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.service_role_key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios no worker documental.")
    return create_client(settings.supabase_url, settings.service_role_key)
