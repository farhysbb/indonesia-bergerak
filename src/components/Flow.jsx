import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";

const ALL = "Semua Provinsi";
const ACCESS_DATE = "3 Oktober 2026";

const SOURCE = {
  publisher: "Badan Pusat Statistik (BPS)",
  publication: "Statistik Wisatawan Nusantara",
  table: "Jumlah Perjalanan Wisatawan Nusantara Menurut Provinsi Asal dan Provinsi Tujuan",
  year: "2025",
  url: "https://www.bps.go.id/id/publication/2026/04/30/06948320ebe75b7678b09c56/domestic-tourism-statistics-2025.html",
};

const ACCENT = "#E9FF4F";
const TEXT = "#FFFFFF";
const MUTED = "#EDECED";
const PANEL = "rgba(255,255,255,0.04)";

const TOOLTIP_STYLE = {
  bgcolor: "#263126",
  bordercolor: "#E9FF4F",
  font: {
    color: "#FFFFFF",
    family: "Inter, system-ui, sans-serif",
    size: 12,
  },
  align: "left",
  namelength: -1,
};

const MATRIX_COLORS = [
  "#C9D8FF",
  "#91AEF2",
  "#587BD1",
  "#263F8F",
];

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function quantile(sortedValues, q) {
  if (!sortedValues.length) return 0;

  const position = (sortedValues.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;

  if (sortedValues[base + 1] !== undefined) {
    return (
      sortedValues[base] +
      rest * (sortedValues[base + 1] - sortedValues[base])
    );
  }

  return sortedValues[base];
}

function getQuartiles(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  return {
    q25: quantile(sorted, 0.25),
    q50: quantile(sorted, 0.5),
    q75: quantile(sorted, 0.75),
  };
}

function classify4(value, thresholds) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= thresholds.q25) return 1;
  if (value <= thresholds.q50) return 2;
  if (value <= thresholds.q75) return 3;
  return 4;
}

const MATRIX_SCALE = [
  [0.0, "rgba(255,255,255,0.04)"],
  [0.199, "rgba(255,255,255,0.04)"],
  [0.2, MATRIX_COLORS[0]],
  [0.399, MATRIX_COLORS[0]],
  [0.4, MATRIX_COLORS[1]],
  [0.599, MATRIX_COLORS[1]],
  [0.6, MATRIX_COLORS[2]],
  [0.799, MATRIX_COLORS[2]],
  [0.8, MATRIX_COLORS[3]],
  [1.0, MATRIX_COLORS[3]],
];

function SourceLine() {
  return (
    <div className="visual-source-line">
      <strong>Sumber: BPS</strong>
      <span>
        {SOURCE.publication} · {SOURCE.year} · Diakses {ACCESS_DATE}
      </span>
      <a href={SOURCE.url} target="_blank" rel="noreferrer">
        Buka publikasi
      </a>
    </div>
  );
}

function Flow() {
  const [data, setData] = useState([]);
  const [origin, setOrigin] = useState(ALL);
  const [destination, setDestination] = useState(ALL);
  const [topN, setTopN] = useState(25);
  const [showSelfFlow, setShowSelfFlow] = useState(false);
  const [matrixMode, setMatrixMode] = useState("percent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse("/data/od_long.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,

      complete: (result) => {
        const cleaned = result.data
          .map((row) => ({
            origin: String(row.origin ?? "").trim(),
            destination: String(row.destination ?? "").trim(),
            value: Number(row.value) || 0,
            is_self_flow:
              row.is_self_flow === true ||
              String(row.is_self_flow).toLowerCase() === "true",
          }))
          .filter(
            (row) => row.origin && row.destination && row.value >= 0
          );

        setData(cleaned);
        setLoading(false);
      },

      error: (err) => {
        console.error(err);
        setError("Gagal membaca od_long.csv.");
        setLoading(false);
      },
    });
  }, []);

  const provinces = useMemo(() => {
    const names = new Set();

    data.forEach((row) => {
      names.add(row.origin);
      names.add(row.destination);
    });

    return [...names].sort((a, b) => a.localeCompare(b, "id"));
  }, [data]);

  const denominatorRows = useMemo(() => {
    return data.filter((row) => {
      if (!showSelfFlow && row.origin === row.destination) return false;
      return true;
    });
  }, [data, showSelfFlow]);

  const originTotals = useMemo(() => {
    const totals = new Map();

    denominatorRows.forEach((row) => {
      totals.set(
        row.origin,
        (totals.get(row.origin) || 0) + row.value
      );
    });

    return totals;
  }, [denominatorRows]);

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (!showSelfFlow && row.origin === row.destination) return false;
      if (origin !== ALL && row.origin !== origin) return false;
      if (destination !== ALL && row.destination !== destination) return false;
      return true;
    });
  }, [data, origin, destination, showSelfFlow]);

  const totalTrips = useMemo(() => {
    return filteredData.reduce((sum, row) => sum + row.value, 0);
  }, [filteredData]);

  const topRoute = useMemo(() => {
    if (!filteredData.length) return null;

    return [...filteredData].sort((a, b) => b.value - a.value)[0];
  }, [filteredData]);

  const dominantOrigin = useMemo(() => {
    const totals = new Map();

    filteredData.forEach((row) => {
      totals.set(row.origin, (totals.get(row.origin) || 0) + row.value);
    });

    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  }, [filteredData]);

  const dominantDestination = useMemo(() => {
    const totals = new Map();

    filteredData.forEach((row) => {
      totals.set(
        row.destination,
        (totals.get(row.destination) || 0) + row.value
      );
    });

    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  }, [filteredData]);

  const sankeyRows = useMemo(() => {
    return [...filteredData]
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }, [filteredData, topN]);

  const sankey = useMemo(() => {
    const origins = [...new Set(sankeyRows.map((row) => row.origin))];
    const destinations = [
      ...new Set(sankeyRows.map((row) => row.destination)),
    ];

    const nodeKeys = [
      ...origins.map((name) => `O|${name}`),
      ...destinations.map((name) => `D|${name}`),
    ];

    const nodeLabels = [
      ...origins.map((name) => name),
      ...destinations.map((name) => name),
    ];

    const index = new Map(nodeKeys.map((key, i) => [key, i]));

    return {
      labels: nodeLabels,
      source: sankeyRows.map((row) => index.get(`O|${row.origin}`)),
      target: sankeyRows.map((row) => index.get(`D|${row.destination}`)),
      values: sankeyRows.map((row) => row.value),
      nodeColors: [
        ...origins.map(() => ACCENT),
        ...destinations.map(() => MUTED),
      ],
      customdata: sankeyRows.map((row) => [
        row.origin,
        row.destination,
        formatNumber(row.value),
      ]),
      nodeMeta: [
        ...origins.map((name) => ["Provinsi asal", name]),
        ...destinations.map((name) => ["Provinsi tujuan", name]),
      ],
    };
  }, [sankeyRows]);

  const matrix = useMemo(() => {
    const origins = [
      ...new Set(filteredData.map((row) => row.origin)),
    ].sort((a, b) => a.localeCompare(b, "id"));

    const destinations = [
      ...new Set(filteredData.map((row) => row.destination)),
    ].sort((a, b) => a.localeCompare(b, "id"));

    const lookup = new Map();

    filteredData.forEach((row) => {
      lookup.set(`${row.origin}|${row.destination}`, row.value);
    });

    const rawValues = origins.map((originName) =>
      destinations.map(
        (destinationName) =>
          lookup.get(`${originName}|${destinationName}`) || 0
      )
    );

    const percentages = origins.map((originName, i) => {
      const denominator = originTotals.get(originName) || 0;

      return destinations.map((_, j) =>
        denominator > 0 ? (rawValues[i][j] / denominator) * 100 : 0
      );
    });

    const valuesForClass = (
      matrixMode === "percent" ? percentages : rawValues
    ).flat();

    const thresholds = getQuartiles(valuesForClass);

    const classes = (
      matrixMode === "percent" ? percentages : rawValues
    ).map((row) => row.map((value) => classify4(value, thresholds)));

    let highest = null;

    origins.forEach((originName, i) => {
      destinations.forEach((destinationName, j) => {
        const pct = percentages[i][j];
        const count = rawValues[i][j];

        if (
          count > 0 &&
          (!highest || pct > highest.percent)
        ) {
          highest = {
            origin: originName,
            destination: destinationName,
            percent: pct,
            count,
          };
        }
      });
    });

    return {
      origins,
      destinations,
      rawValues,
      percentages,
      classes,
      thresholds,
      highest,
    };
  }, [filteredData, originTotals, matrixMode]);

  if (loading) {
    return (
      <section id="flow" className="story-section">
        <p>Memuat data perjalanan...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section id="flow" className="story-section">
        <p>{error}</p>
      </section>
    );
  }

  const matrixValues =
    matrixMode === "percent" ? matrix.percentages : matrix.rawValues;

  return (
    <section id="flow" className="story-section flow-section">
      
<div className="section-cover section-cover-flow">
  <div className="section-cover-content">
    <p className="eyebrow">01 — FLOW</p>

    <h2>
      Ke Mana Perjalanan Antarprovinsi Mengalir?
    </h2>

    <p>
      Bagian ini membaca hubungan provinsi asal dan provinsi tujuan
      wisatawan nusantara. Sankey menonjolkan volume dan arah arus,
      sedangkan OD Matrix memperlihatkan pola tujuan setiap provinsi.
    </p>
  </div>
</div>

      <div className="filters flow-filters reveal-up">
        <div className="field">
          <label htmlFor="flow-origin">Provinsi asal</label>
          <select
            id="flow-origin"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
          >
            <option value={ALL}>{ALL}</option>
            {provinces.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="flow-destination">Provinsi tujuan</label>
          <select
            id="flow-destination"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value={ALL}>{ALL}</option>
            {provinces.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-small">
          <label htmlFor="flow-top">Top arus Sankey</label>
          <select
            id="flow-top"
            value={topN}
            onChange={(event) => setTopN(Number(event.target.value))}
          >
            {[15, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                Top {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="checkbox flow-checkbox reveal-up">
        <input
          type="checkbox"
          checked={showSelfFlow}
          onChange={(event) => setShowSelfFlow(event.target.checked)}
        />
        Tampilkan perjalanan di dalam provinsi yang sama
      </label>

      <div className="metrics reveal-up">
        <div className="metric-card">
          <span>Total perjalanan pada filter</span>
          <strong>{formatNumber(totalTrips)}</strong>
          <small>perjalanan</small>
        </div>

        <div className="metric-card">
          <span>Provinsi dalam data</span>
          <strong>{provinces.length}</strong>
          <small>provinsi</small>
        </div>

        <div className="metric-card">
          <span>Arus terbesar pada filter</span>
          <strong>{topRoute ? formatNumber(topRoute.value) : "—"}</strong>
          <small>
            {topRoute
              ? `${topRoute.origin} → ${topRoute.destination}`
              : "Tidak ada data"}
          </small>
        </div>
      </div>

      <article className="chart-card reveal-up">
        <div className="viz-heading">
          <div>
            <span className="viz-kicker">VISUAL 1 · SANKEY</span>
            <h3>Arus Perjalanan Antarprovinsi</h3>
            <p>Satuan: jumlah perjalanan</p>
          </div>
        </div>

        <Plot
          data={[
            {
              type: "sankey",
              orientation: "h",
              arrangement: "snap",
              node: {
                label: sankey.labels,
                color: sankey.nodeColors,
                pad: 14,
                thickness: 15,
                line: {
                  width: 0.6,
                  color: "rgba(255,255,255,0.45)",
                },
                customdata: sankey.nodeMeta,
                hovertemplate:
                  "<b>%{customdata[1]}</b><br>" +
                  "%{customdata[0]}" +
                  "<extra></extra>",
              },
              link: {
                source: sankey.source,
                target: sankey.target,
                value: sankey.values,
                color: "rgba(233,255,79,0.22)",
                customdata: sankey.customdata,
                hovertemplate:
                  "<b>%{customdata[0]} → %{customdata[1]}</b><br>" +
                  "Jumlah perjalanan: %{customdata[2]}<extra></extra>",
              },
            },
          ]}
          layout={{
            autosize: true,
            height: 620,
            margin: { l: 15, r: 15, t: 20, b: 15 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            hoverlabel: TOOLTIP_STYLE,
            font: {
              color: TEXT,
              family: "Inter, system-ui, sans-serif",
              size: 11,
            },
          }}
          config={{
            responsive: true,
            displaylogo: false,
          }}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />

        <SourceLine />
      </article>

      <div className="interpretation-card reveal-up">
        <span className="card-label">INTERPRETASI SANKEY</span>
        <h3>Apa yang paling menonjol?</h3>
        {topRoute ? (
          <p>
            Pada filter saat ini, arus terbesar adalah
            <strong> {topRoute.origin} → {topRoute.destination}</strong>
            {" "}dengan <strong>{formatNumber(topRoute.value)} perjalanan</strong>.
            {dominantOrigin && (
              <>
                {" "}Secara agregat, <strong>{dominantOrigin[0]}</strong> menjadi
                asal dengan volume keluar terbesar pada tampilan ini.
              </>
            )}
            {dominantDestination && (
              <>
                {" "}Sementara <strong>{dominantDestination[0]}</strong> menerima
                volume masuk terbesar.
              </>
            )}
          </p>
        ) : (
          <p>Tidak ada arus yang memenuhi filter saat ini.</p>
        )}
        <p className="method-caution">
          Ketebalan link menyatakan volume perjalanan dan arah dibaca dari sisi
          asal ke sisi tujuan. Top N hanya membatasi arus yang ditampilkan di
          Sankey agar pola utama tetap terbaca; data dasar tidak dihapus.
        </p>
      </div>

      <article className="chart-card reveal-up">
        <div className="viz-heading viz-heading-row">
          <div>
            <span className="viz-kicker">VISUAL 2 · OD MATRIX</span>
            <h3>Pola Tujuan Menurut Provinsi Asal</h3>
            <p>
              Satuan aktif: {matrixMode === "percent" ? "% dari total perjalanan asal" : "jumlah perjalanan"}
            </p>
          </div>

          <div className="segmented-control" aria-label="Mode OD Matrix">
            <button
              type="button"
              className={matrixMode === "percent" ? "active" : ""}
              onClick={() => setMatrixMode("percent")}
            >
              % dari Asal
            </button>
            <button
              type="button"
              className={matrixMode === "count" ? "active" : ""}
              onClick={() => setMatrixMode("count")}
            >
              Jumlah Perjalanan
            </button>
          </div>
        </div>

        <div className="matrix-legend" aria-label="Legenda OD Matrix">
          <span>Rendah</span>
          {MATRIX_COLORS.map((color, index) => (
            <i key={color} style={{ background: color }} title={`Kelas ${index + 1}`} />
          ))}
          <span>Tinggi</span>
        </div>

        <Plot
          data={[
            {
              type: "heatmap",
              x: matrix.destinations,
              y: matrix.origins,
              z: matrix.classes,
              zmin: 0,
              zmax: 4,
              colorscale: MATRIX_SCALE,
              showscale: false,
              customdata: matrix.origins.map((_, i) =>
                matrix.destinations.map((__, j) => [
                  formatNumber(matrix.percentages[i][j], 2),
                  formatNumber(matrix.rawValues[i][j]),
                  matrixMode === "percent"
                    ? `${formatNumber(matrixValues[i][j], 2)}%`
                    : `${formatNumber(matrixValues[i][j])} perjalanan`,
                ])
              ),
              hovertemplate:
                "<b>%{y} → %{x}</b><br>" +
                "Persentase dari asal: %{customdata[0]}%<br>" +
                "Jumlah perjalanan: %{customdata[1]}<extra></extra>",
              xgap: 1,
              ygap: 1,
            },
          ]}
          layout={{
            autosize: true,
            height: Math.max(620, matrix.origins.length * 18 + 260),
            margin: { l: 130, r: 20, t: 20, b: 150 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: PANEL,
            hoverlabel: TOOLTIP_STYLE,
            font: {
              color: TEXT,
              family: "Inter, system-ui, sans-serif",
              size: 10,
            },
            xaxis: {
              title: { text: "Provinsi Tujuan", font: { color: MUTED } },
              tickangle: -55,
              tickfont: { color: MUTED, size: 9 },
              side: "bottom",
              automargin: true,
            },
            yaxis: {
              title: { text: "Provinsi Asal", font: { color: MUTED } },
              tickfont: { color: MUTED, size: 9 },
              autorange: "reversed",
              automargin: true,
            },
          }}
          config={{ responsive: true, displaylogo: false }}
          useResizeHandler
          style={{ width: "100%", height: "100%" }}
        />

        <SourceLine />
      </article>

      <div className="interpretation-card reveal-up">
        <span className="card-label">INTERPRETASI OD MATRIX</span>
        <h3>Membaca konsentrasi tujuan</h3>
        {matrix.highest ? (
          <p>
            Sel dengan proporsi tujuan terbesar pada tampilan saat ini adalah
            <strong> {matrix.highest.origin} → {matrix.highest.destination}</strong>
            {" "}sebesar <strong>{matrix.highest.percent.toFixed(2)}%</strong> dari
            seluruh perjalanan yang berasal dari {matrix.highest.origin}
            {" "}({formatNumber(matrix.highest.count)} perjalanan).
          </p>
        ) : (
          <p>Tidak ada sel bernilai positif pada filter saat ini.</p>
        )}
        <p>
          Pada mode persentase, setiap baris dinormalisasi terhadap
          <strong> seluruh tujuan dari provinsi asal tersebut</strong>, bukan hanya
          Top N Sankey atau tujuan yang sedang disorot. Karena itu warna matrix
          menekankan struktur tujuan relatif, bukan sekadar besarnya provinsi.
        </p>
      </div>

      <div className="method-grid reveal-up">
        <article className="method-card">
          <span className="card-label">ENCODING VISUAL</span>
          <h3>Mengapa dua teknik ini?</h3>
          <p>
            Pada Sankey, <strong>posisi kiri–kanan</strong> membedakan asal dan
            tujuan, sementara <strong>ketebalan link</strong> mengodekan jumlah
            perjalanan sehingga arus dominan cepat terlihat. Pada OD Matrix,
            <strong>posisi baris–kolom</strong> mengodekan pasangan asal–tujuan dan
            <strong>warna</strong> mengodekan kelas nilai.
          </p>
        </article>

        <article className="method-card">
          <span className="card-label">KLASIFIKASI MATRIX</span>
          <h3>Kuartil 4 kelas</h3>
          <p>
            Nilai positif dibagi menjadi empat kelas kuartil agar variasi pola
            tujuan tetap terbaca ketika distribusi perjalanan tidak merata.
            Palet sequential dari biru muda menuju biru gelap digunakan karena
nilai memiliki urutan rendah → tinggi.
          </p>
        </article>
      </div>

      <div className="source-block reveal-up">
        <span className="card-label">SUMBER DATA FLOW</span>
        <strong>Sumber: BPS</strong>
        <p>
          Publikasi: <em>{SOURCE.publication}</em>. Tabel yang digunakan:
          {" "}<em>{SOURCE.table}</em>. Tahun data: {SOURCE.year}.
        </p>
        <p>
          Publikasi BPS tersebut disusun menggunakan Mobile Positioning Data (MPD)
          dan Survei Digital Wisatawan Nusantara 2025. Data pada webstory ini
          digunakan untuk membaca pola perjalanan, bukan untuk menyimpulkan
          hubungan kausal dengan jaringan jalan.
        </p>
        <p>
          <a href={SOURCE.url} target="_blank" rel="noreferrer">
            Lihat publikasi
          </a>
          <br />
          Tanggal akses: {ACCESS_DATE}
        </p>
      </div>
    </section>
  );
}

export default Flow;
