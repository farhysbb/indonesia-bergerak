import argparse
from pathlib import Path

import pandas as pd


def preprocess_od(input_path, output_path):
    df = pd.read_excel(input_path)

    df = df.rename(
        columns={df.columns[0]: "origin"}
    )

    df["origin"] = (
        df["origin"]
        .astype(str)
        .str.strip()
    )

    destination_cols = [
        col for col in df.columns
        if col not in ["origin", "Total Asal"]
    ]

    od = df.melt(
        id_vars="origin",
        value_vars=destination_cols,
        var_name="destination",
        value_name="value"
    )

    od["destination"] = (
        od["destination"]
        .astype(str)
        .str.strip()
    )

    od["value"] = pd.to_numeric(
        od["value"],
        errors="coerce"
    ).fillna(0).astype(int)

    od["is_self_flow"] = (
        od["origin"] == od["destination"]
    )

    od = od.sort_values(
        "value",
        ascending=False
    ).reset_index(drop=True)

    output_path = Path(output_path)
    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    od.to_csv(
        output_path,
        index=False,
        encoding="utf-8-sig"
    )

    print(f"Jumlah provinsi asal   : {od['origin'].nunique()}")
    print(f"Jumlah provinsi tujuan : {od['destination'].nunique()}")
    print(f"Jumlah pasangan OD     : {len(od):,}")
    print(f"Total perjalanan       : {od['value'].sum():,}")
    print(
        f"Self-flow              : "
        f"{od.loc[od['is_self_flow'], 'value'].sum():,}"
    )
    print(
        f"Antarprovinsi          : "
        f"{od.loc[~od['is_self_flow'], 'value'].sum():,}"
    )
    print(f"\nTersimpan di: {output_path}")

    print("\nTop 10 perjalanan antarprovinsi:")
    print(
        od[~od["is_self_flow"]]
        .head(10)
        .to_string(index=False)
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
        help="File Excel matriks OD"
    )

    parser.add_argument(
        "--out",
        default="data/processed/od_long.csv",
        help="Lokasi output CSV"
    )

    args = parser.parse_args()

    preprocess_od(
        args.input,
        args.out
    )


if __name__ == "__main__":
    main()