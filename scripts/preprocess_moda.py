from pathlib import Path
import pandas as pd

# ============================================================
# PATH
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"

OUT_DIR.mkdir(parents=True, exist_ok=True)

KERETA_FILE = RAW_DIR / "Jumlah Penumpang Kereta Api, 2026.xlsx"
UDARA_FILE = RAW_DIR / "Jumlah Penumpang Pesawat (Angkutan Udara) Domestik di 5 Bandara Utama, 2026.xlsx"
LAUT_FILE = RAW_DIR / "Total Penumpang Pelayaran dalam Negeri di Pelabuhan Utama, 2026.xlsx"

OUTPUT_FILE = OUT_DIR / "moda_transportasi_2026.csv"

MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
]

AIRPORTS = [
    "Kualanamu-Medan",
    "Soekarno Hatta-Jakarta",
    "Juanda-Surabaya",
    "Hasanudin-Makassar",
    "Ngurah Rai-Bali",
]

PORTS = [
    "Belawan",
    "Tanjung Priok",
    "Tanjung Perak",
    "Balikpapan",
    "Makassar",
]


# ============================================================
# HELPERS
# ============================================================

def clean_numeric(values):
    """
    Mengubah nilai Excel menjadi numerik.
    "-", sel kosong, atau teks non-numerik menjadi NaN.
    """
    return pd.to_numeric(
        values.astype(str)
        .str.strip()
        .str.replace(",", "", regex=False),
        errors="coerce",
    )


def find_row(df, label):
    """
    Cari satu baris berdasarkan teks pada kolom pertama.
    """
    first_col = (
        df.iloc[:, 0]
        .astype(str)
        .str.strip()
        .str.casefold()
    )

    matches = df.index[
        first_col == label.strip().casefold()
    ].tolist()

    if not matches:
        raise ValueError(f'Baris "{label}" tidak ditemukan.')

    return matches[0]


# ============================================================
# KERETA API
# ============================================================

def preprocess_kereta(path):
    df = pd.read_excel(path, header=None)

    total_row = find_row(df, "Total")

    # B:I = Januari–Agustus.
    values = clean_numeric(
        df.iloc[total_row, 1:1 + len(MONTHS)]
    ).reset_index(drop=True)

    # Satuan pada sumber: RIBU ORANG.
    # Untuk web, dikonversi ke ORANG.
    values_people = values * 1000

    return values_people


# ============================================================
# ANGKUTAN UDARA DOMESTIK
# ============================================================

def preprocess_udara(path):
    df = pd.read_excel(path, header=None)

    # Gunakan hanya 5 bandara utama yang disebut pada judul sumber.
    # "Bandara Lainnya" sengaja tidak dimasukkan.
    rows = []

    for airport in AIRPORTS:
        row_index = find_row(df, airport)

        # B:I = Keberangkatan Januari–Agustus.
        values = clean_numeric(
            df.iloc[row_index, 1:1 + len(MONTHS)]
        ).reset_index(drop=True)

        rows.append(values)

    result = pd.concat(rows, axis=1).sum(axis=1, min_count=1)

    return result


# ============================================================
# PELAYARAN DALAM NEGERI
# ============================================================

def preprocess_laut(path):
    df = pd.read_excel(path, header=None)

    rows = []

    for port in PORTS:
        row_index = find_row(df, port)

        # B:I = Total Keberangkatan Januari–Agustus.
        values = clean_numeric(
            df.iloc[row_index, 1:1 + len(MONTHS)]
        ).reset_index(drop=True)

        rows.append(values)

    result = pd.concat(rows, axis=1).sum(axis=1, min_count=1)

    return result


# ============================================================
# MAIN
# ============================================================

def main():
    kereta = preprocess_kereta(KERETA_FILE)
    udara = preprocess_udara(UDARA_FILE)
    laut = preprocess_laut(LAUT_FILE)

    result = pd.DataFrame({
        "month_order": range(1, len(MONTHS) + 1),
        "month": MONTHS,

        # Data riil / absolut.
        "kereta_people":
            kereta.round().astype("Int64"),

        "udara_5_bandara_departures":
            udara.round().astype("Int64"),

        "laut_5_pelabuhan_departures":
            laut.round().astype("Int64"),
    })

    # --------------------------------------------------------
    # VALIDASI
    # Jika struktur Excel berubah, script berhenti agar tidak
    # diam-diam menghasilkan angka salah.
    # --------------------------------------------------------

    expected_january = {
        "kereta_people": 48_101_000,
        "udara_5_bandara_departures": 2_573_296,
        "laut_5_pelabuhan_departures": 165_412,
    }

    for column, expected in expected_january.items():
        actual = int(result.loc[0, column])

        if actual != expected:
            raise ValueError(
                f"Validasi gagal untuk {column}. "
                f"Didapat {actual:,}; seharusnya {expected:,}. "
                "Periksa apakah struktur file sumber berubah."
            )

    result.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8",
    )

    print("Preprocessing selesai.")
    print(f"Output: {OUTPUT_FILE}")
    print()
    print(result.to_string(index=False))


if __name__ == "__main__":
    main()
