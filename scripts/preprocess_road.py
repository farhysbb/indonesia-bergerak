import os
import argparse
from pathlib import Path

os.environ["SHAPE_RESTORE_SHX"] = "YES"

import geopandas as gpd
import pandas as pd
from pyproj import Geod


WGS84 = "EPSG:4326"
GEOD = Geod(ellps="WGS84")


def length_km(geometry):
    if geometry is None or geometry.is_empty:
        return 0.0

    return abs(GEOD.geometry_length(geometry)) / 1000


def area_km2(geometry):
    if geometry is None or geometry.is_empty:
        return 0.0

    area, _ = GEOD.geometry_area_perimeter(geometry)

    return abs(area) / 1_000_000


def load_boundaries(path):
    gdf = gpd.read_file(path)

    if gdf.crs is None:
        raise ValueError("CRS batas kab/kota tidak ditemukan.")

    gdf = gdf.to_crs(WGS84)

    required = ["KDPKAB", "WADMKK", "WADMPR"]

    for col in required:
        if col not in gdf.columns:
            raise ValueError(
                f"Kolom {col} tidak ditemukan.\n"
                f"Kolom tersedia: {list(gdf.columns)}"
            )

    gdf = gdf[
        gdf["KDPKAB"].notna()
    ].copy()

    gdf["geometry"] = gdf.geometry.make_valid()

    gdf = gdf[
        gdf.geometry.notna()
        & ~gdf.geometry.is_empty
    ]

    gdf["kode_kabkota"] = (
        gdf["KDPKAB"]
        .astype(str)
        .str.strip()
    )

    gdf["kabupaten_kota"] = gdf["WADMKK"]
    gdf["provinsi"] = gdf["WADMPR"]

    # Gabungkan polygon yang memiliki kode kab/kota sama
    gdf = gdf.dissolve(
        by="kode_kabkota",
        aggfunc={
            "kabupaten_kota": "first",
            "provinsi": "first"
        },
        as_index=False
    )

    return gdf[
        [
            "kode_kabkota",
            "kabupaten_kota",
            "provinsi",
            "geometry"
        ]
    ]


def load_roads(path):
    roads = gpd.read_file(path)

    if roads.crs is None:
        raise ValueError("CRS jaringan jalan tidak ditemukan.")

    roads = roads.to_crs(WGS84)

    roads = roads[
        roads.geometry.notna()
        & ~roads.geometry.is_empty
    ].copy()

    roads["geometry"] = roads.geometry.make_valid()

    roads = roads[
        roads.geom_type.isin(
            ["LineString", "MultiLineString"]
        )
    ]

    return roads[["geometry"]]


def calculate_road_summary(boundaries, roads):
    boundaries = boundaries.copy()

    boundaries["area_km2"] = (
        boundaries.geometry.apply(area_km2)
    )

    print("Memotong jalan berdasarkan kabupaten/kota...")

    intersection = gpd.overlay(
        roads,
        boundaries[
            ["kode_kabkota", "geometry"]
        ],
        how="intersection",
        keep_geom_type=True
    )

    intersection["road_length_km"] = (
        intersection.geometry.apply(length_km)
    )

    road_length = (
        intersection
        .groupby("kode_kabkota")["road_length_km"]
        .sum()
        .reset_index()
    )

    boundaries = boundaries.merge(
        road_length,
        on="kode_kabkota",
        how="left"
    )

    boundaries["road_length_km"] = (
        boundaries["road_length_km"]
        .fillna(0)
    )

    # km jalan nasional per 100 km² wilayah
    boundaries["road_density"] = (
        boundaries["road_length_km"]
        / boundaries["area_km2"]
        * 100
    )

    # Titik untuk proportional symbol map
    points = boundaries.representative_point()

    boundaries["symbol_lon"] = points.x
    boundaries["symbol_lat"] = points.y

    return boundaries


def save_outputs(gdf, csv_path, geojson_path):
    csv_path = Path(csv_path)
    geojson_path = Path(geojson_path)

    csv_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    geojson_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    summary = gdf.drop(
        columns="geometry"
    ).copy()

    numeric_cols = [
        "road_length_km",
        "area_km2",
        "road_density",
        "symbol_lon",
        "symbol_lat"
    ]

    summary[numeric_cols] = (
        summary[numeric_cols]
        .round(4)
    )

    summary.to_csv(
        csv_path,
        index=False,
        encoding="utf-8-sig"
    )

    gdf.to_file(
        geojson_path,
        driver="GeoJSON"
    )

    print()
    print(f"Jumlah kab/kota : {len(summary)}")
    print(
        f"Total jalan     : "
        f"{summary['road_length_km'].sum():,.2f} km"
    )
    print(
        f"Tanpa jalan     : "
        f"{(summary['road_length_km'] == 0).sum()}"
    )
    print()
    print(f"CSV     : {csv_path}")
    print(f"GeoJSON : {geojson_path}")

    print()
    print(summary.head(10).to_string(index=False))


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--kab",
        required=True,
        help="Path shapefile batas kab/kota"
    )

    parser.add_argument(
        "--jalan",
        required=True,
        help="Path Jalan_Nasional_PerRuas.shp"
    )

    parser.add_argument(
        "--csv",
        default="data/processed/road_summary.csv"
    )

    parser.add_argument(
        "--geojson",
        default="data/processed/kabkota.geojson"
    )

    args = parser.parse_args()

    print("Membaca batas kabupaten/kota...")
    boundaries = load_boundaries(args.kab)

    print(
        f"Ditemukan {len(boundaries)} "
        f"kabupaten/kota"
    )

    print("Membaca jaringan jalan nasional...")
    roads = load_roads(args.jalan)

    print(
        f"Ditemukan {len(roads)} "
        f"ruas/segmen jalan"
    )

    result = calculate_road_summary(
        boundaries,
        roads
    )

    save_outputs(
        result,
        args.csv,
        args.geojson
    )


if __name__ == "__main__":
    main()