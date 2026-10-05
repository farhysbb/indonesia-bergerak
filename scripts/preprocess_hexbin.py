from pathlib import Path
import math
import os

# Membantu bila .shx hilang/rusak tetapi .shp/.dbf masih tersedia.
os.environ["SHAPE_RESTORE_SHX"] = "YES"

import geopandas as gpd
import pandas as pd
from pyproj import Geod
from shapely.geometry import Polygon


# ============================================================
# PATH
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

ROAD_FILE = (
    ROOT
    / "data"
    / "raw"
    / "jalan_nasional"
    / "jalan_nasional.shp"
)

OUTPUT_FILE = (
    ROOT
    / "data"
    / "processed"
    / "road_hex.geojson"
)

OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# KONFIGURASI
# ============================================================

# Hexagon dibuat dalam CRS meter agar ukuran sel seragam.
# 30 km = radius pusat ke sudut hexagon.
#
# Bila ingin lebih detail:
# 20_000 -> lebih banyak hexagon
#
# Bila ingin lebih ringan:
# 40_000 -> lebih sedikit hexagon
HEX_RADIUS_M = 30_000

# Equal-area global CRS; cocok untuk membuat grid dengan
# ukuran sel yang konsisten secara spasial.
GRID_CRS = "EPSG:6933"

# Geodesic WGS84 dipakai untuk menghitung panjang ruas hasil
# pemotongan sehingga panjang jalan tetap dihitung di permukaan bumi.
GEOD = Geod(ellps="WGS84")


# ============================================================
# HELPER
# ============================================================

def make_hexagon(cx, cy, radius):
    """
    Membuat satu flat-top hexagon.
    """
    points = []

    for angle_deg in range(0, 360, 60):
        angle = math.radians(angle_deg)

        points.append(
            (
                cx + radius * math.cos(angle),
                cy + radius * math.sin(angle),
            )
        )

    return Polygon(points)


def build_hex_grid(bounds, radius):
    """
    Membuat grid hexagon yang menutupi bounding box jalan.
    """
    minx, miny, maxx, maxy = bounds

    hex_height = math.sqrt(3) * radius
    x_step = 1.5 * radius

    polygons = []
    ids = []

    x = minx - radius
    col = 0
    hex_id = 1

    while x <= maxx + radius:
        y_offset = (
            hex_height / 2
            if col % 2
            else 0
        )

        y = (
            miny
            - hex_height
            + y_offset
        )

        while y <= maxy + hex_height:
            polygons.append(
                make_hexagon(
                    x,
                    y,
                    radius,
                )
            )

            ids.append(
                f"hex_{hex_id:05d}"
            )

            hex_id += 1
            y += hex_height

        x += x_step
        col += 1

    return gpd.GeoDataFrame(
        {
            "hex_id": ids,
        },
        geometry=polygons,
        crs=GRID_CRS,
    )


def geometry_length_km(geometry):
    """
    Panjang geodesik geometry dalam kilometer.
    """
    if geometry is None or geometry.is_empty:
        return 0.0

    return abs(
        GEOD.geometry_length(
            geometry
        )
    ) / 1000


# ============================================================
# MAIN
# ============================================================

def main():
    print(
        "Membaca jaringan jalan nasional..."
    )

    roads = gpd.read_file(
        ROAD_FILE
    )

    if roads.empty:
        raise ValueError(
            "Layer jalan nasional kosong."
        )

    if roads.crs is None:
        raise ValueError(
            "CRS shapefile jalan tidak terdefinisi."
        )

    # Hilangkan geometry kosong.
    roads = roads[
        roads.geometry.notna()
        & ~roads.geometry.is_empty
    ].copy()

    # Grid dibuat pada CRS meter.
    roads_grid = roads.to_crs(
        GRID_CRS
    )

    print(
        "Membuat grid hexagon..."
    )

    hex_grid = build_hex_grid(
        roads_grid.total_bounds,
        HEX_RADIUS_M,
    )

    # Hanya simpan hex yang berpotensi bersinggungan
    # dengan jaringan jalan.
    road_union = (
        roads_grid.geometry
        .union_all()
    )

    hex_grid = hex_grid[
        hex_grid.intersects(
            road_union
        )
    ].copy()

    print(
        f"Hexagon kandidat: {len(hex_grid):,}"
    )

    print(
        "Memotong ruas jalan dengan grid..."
    )

    intersections = gpd.overlay(
        roads_grid[
            ["geometry"]
        ],
        hex_grid[
            [
                "hex_id",
                "geometry",
            ]
        ],
        how="intersection",
        keep_geom_type=False,
    )

    if intersections.empty:
        raise ValueError(
            "Tidak ada hasil intersection jalan × hexagon."
        )

    # Hitung panjang geodesik setelah dikembalikan ke WGS84.
    intersections_wgs84 = (
        intersections.to_crs(
            "EPSG:4326"
        )
    )

    intersections_wgs84[
        "road_length_km"
    ] = (
        intersections_wgs84
        .geometry
        .apply(
            geometry_length_km
        )
    )

    summary = (
        intersections_wgs84
        .groupby(
            "hex_id",
            as_index=False,
        )[
            "road_length_km"
        ]
        .sum()
    )

    summary[
        "road_length_km"
    ] = (
        summary[
            "road_length_km"
        ]
        .round(3)
    )

    # Join kembali ke geometry hex.
    result = (
        hex_grid
        .merge(
            summary,
            on="hex_id",
            how="inner",
        )
    )

    result = result[
        result[
            "road_length_km"
        ] > 0
    ].copy()

    # Luas setiap hex disimpan sebagai metadata.
    result[
        "hex_area_km2"
    ] = (
        result.geometry.area
        / 1_000_000
    ).round(1)

    result = result.to_crs(
        "EPSG:4326"
    )

    result = result[
        [
            "hex_id",
            "road_length_km",
            "hex_area_km2",
            "geometry",
        ]
    ]

    result.to_file(
        OUTPUT_FILE,
        driver="GeoJSON",
    )

    print()
    print(
        "Preprocessing hexbin selesai."
    )

    print(
        f"Output: {OUTPUT_FILE}"
    )

    print(
        f"Hexagon dengan jalan: {len(result):,}"
    )

    print(
        "Total panjang jalan pada hex:"
        f" {result['road_length_km'].sum():,.2f} km"
    )

    print(
        "Rentang panjang jalan per hex:"
        f" {result['road_length_km'].min():,.2f}"
        " – "
        f"{result['road_length_km'].max():,.2f} km"
    )


if __name__ == "__main__":
    main()
