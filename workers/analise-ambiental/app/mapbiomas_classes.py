from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MapBiomasGroup:
    key: str
    name: str
    codes: set[int]
    color: str


# Legenda base do MapBiomas para classes de cobertura e uso da terra.
# A lista fica centralizada para permitir ajustes por coleção sem tocar no
# processamento raster.
MAPBIOMAS_GROUPS: dict[str, MapBiomasGroup] = {
    "floresta": MapBiomasGroup(
        key="floresta",
        name="Floresta",
        codes={3, 5, 6, 49},
        color="#1f8d49",
    ),
    "formacao_savanica": MapBiomasGroup(
        key="formacao_savanica",
        name="Formação savânica",
        codes={4},
        color="#7dc975",
    ),
    "vegetacao_campestre": MapBiomasGroup(
        key="vegetacao_campestre",
        name="Vegetação campestre",
        codes={11, 12, 32, 50},
        color="#d6bc74",
    ),
    "vegetacao_nativa": MapBiomasGroup(
        key="vegetacao_nativa",
        name="Vegetação nativa",
        codes={3, 4, 5, 6, 11, 12, 32, 49, 50},
        color="#2ca25f",
    ),
    "agropecuaria": MapBiomasGroup(
        key="agropecuaria",
        name="Agropecuária",
        codes={9, 15, 18, 19, 20, 21, 36, 39, 40, 41, 46, 47, 48, 62},
        color="#f1c232",
    ),
    "agua": MapBiomasGroup(
        key="agua",
        name="Água",
        codes={26, 31, 33},
        color="#2532e4",
    ),
    "area_nao_vegetada": MapBiomasGroup(
        key="area_nao_vegetada",
        name="Área não vegetada",
        codes={23, 24, 25, 29, 30},
        color="#d7191c",
    ),
}


MINIMUM_REAL_LAYER_KEYS = [
    "vegetacao_nativa",
    "agropecuaria",
    "agua",
]


def all_known_codes() -> set[int]:
    codes: set[int] = set()
    for group in MAPBIOMAS_GROUPS.values():
        codes.update(group.codes)
    return codes
