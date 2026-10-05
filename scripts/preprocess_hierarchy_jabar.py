from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VEHICLE_FILE = RAW_DIR / "Jumlah Kendaraan Bermotor Menurut Kabupaten_Kota dan Jenis Kendaraan di Provinsi Jawa Barat (unit), 2025.xlsx"
ROAD_FILE = RAW_DIR / "Panjang Jalan Menurut Kabupaten_Kota dan Tingkat Kewenangan Pemerintahan di Provinsi Jawa Barat (km), 2025.xlsx"

OUTPUT_FILE = OUT_DIR / "hierarchy_jabar.csv"

VEHICLE_TYPES = [
    "Mobil Penumpang",
    "Bus",
    "Truk",
    "Sepeda Motor",
]


def normalize_region(name):
    name = str(name).strip()

    if name.startswith("Kota "):
        return name

    return f"Kabupaten {name}"


def read_vehicle_data(path):
    raw = pd.read_excel(path, header=None)

    # Data utama berada pada baris awal.
    # Ambil sampai sebelum baris total "Jawa Barat".
    end_idx = raw.index[
        raw.iloc[:, 0].astype(str).str.strip() == "Jawa Barat"
    ][0]

    df = raw.iloc[1:end_idx, :6].copy()

    df.columns = [
        "kabupaten_kota",
        "Mobil Penumpang",
        "Bus",
        "Truk",
        "Sepeda Motor",
        "total_vehicles",
    ]

    df["kabupaten_kota"] = (
        df["kabupaten_kota"]
        .map(normalize_region)
    )

    numeric_cols = [
        "Mobil Penumpang",
        "Bus",
        "Truk",
        "Sepeda Motor",
        "total_vehicles",
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(
            df[col],
            errors="coerce",
        ).fillna(0)

    return df


def read_road_data(path):
    raw = pd.read_excel(path, header=None)

    end_idx = raw.index[
        raw.iloc[:, 0].astype(str).str.strip() == "Jawa Barat"
    ][0]

    df = raw.iloc[1:end_idx, :5].copy()

    df.columns = [
        "kabupaten_kota",
        "state_road_km",
        "province_road_km",
        "local_road_km",
        "total_road_km",
    ]

    df["kabupaten_kota"] = (
        df["kabupaten_kota"]
        .map(normalize_region)
    )

    numeric_cols = [
        "state_road_km",
        "province_road_km",
        "local_road_km",
        "total_road_km",
    ]

    for col in numeric_cols:
        df[col] = pd.to_numeric(
            df[col],
            errors="coerce",
        ).fillna(0)

    return df


def main():
    vehicle = read_vehicle_data(
        VEHICLE_FILE
    )

    road = read_road_data(
        ROAD_FILE
    )

    # Gabungkan data kendaraan dan panjang jalan
    merged = vehicle.merge(
        road,
        on="kabupaten_kota",
        how="inner",
        validate="one_to_one",
    )

    # Rasio kontekstual.
    # Ini BUKAN indikator kemacetan.
    merged[
        "vehicles_per_road_km"
    ] = (
        merged["total_vehicles"]
        /
        merged["total_road_km"]
        .replace(0, pd.NA)
    )

    # Ubah jenis kendaraan menjadi level ketiga hierarchy
    long_df = merged.melt(
        id_vars=[
            "kabupaten_kota",
            "total_vehicles",
            "state_road_km",
            "province_road_km",
            "local_road_km",
            "total_road_km",
            "vehicles_per_road_km",
        ],
        value_vars=VEHICLE_TYPES,
        var_name="vehicle_type",
        value_name="vehicle_count",
    )

    long_df.insert(
        0,
        "province",
        "Jawa Barat",
    )

    long_df[
        "share_type_pct"
    ] = (
        long_df["vehicle_count"]
        /
        long_df["total_vehicles"]
        * 100
    )

    # Rapikan angka
    long_df[
        "share_type_pct"
    ] = long_df[
        "share_type_pct"
    ].round(2)

    long_df[
        "vehicles_per_road_km"
    ] = long_df[
        "vehicles_per_road_km"
    ].round(2)

    long_df = long_df[
        [
            "province",
            "kabupaten_kota",
            "vehicle_type",
            "vehicle_count",
            "total_vehicles",
            "share_type_pct",
            "state_road_km",
            "province_road_km",
            "local_road_km",
            "total_road_km",
            "vehicles_per_road_km",
        ]
    ]

    long_df = long_df.sort_values(
        [
            "total_vehicles",
            "kabupaten_kota",
            "vehicle_count",
        ],
        ascending=[
            False,
            True,
            False,
        ],
    )

    long_df.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8",
    )

    print("Preprocessing hierarchy selesai.")
    print(f"Output: {OUTPUT_FILE}")
    print()
    print(
        long_df.head(12)
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()
