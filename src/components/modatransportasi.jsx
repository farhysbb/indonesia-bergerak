import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";

const ACCESS_DATE = "4 Oktober 2026";
const ACCENT = "#E9FF4F";
const TEXT = "#FFFFFF";
const MUTED = "#EDECED";

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

const SOURCES = {
  rail: {
    publisher: "Badan Pusat Statistik (BPS)",
    title: "Jumlah Penumpang Kereta Api (Ribu Orang), 2026",
    year: "2026",
    url: "https://www.bps.go.id/id/statistics-table/2/NzIjMg%3D%3D/jumlah-penumpang-kereta-api-ribu-orang.html",
  },
  air: {
    publisher: "Badan Pusat Statistik (BPS)",
    title: "Jumlah Penumpang Pesawat (Angkutan Udara) Domestik di 5 Bandara Utama (Orang), 2026",
    year: "2026",
    url: "https://www.bps.go.id/id/statistics-table/2/MjM0OSMy/jumlah-penumpang-pesawat-angkutan-udara-domestik-di-5-bandara-utama.html",
  },
  sea: {
    publisher: "Badan Pusat Statistik (BPS)",
    title: "Total Penumpang Pelayaran dalam Negeri di Pelabuhan Utama, 2026",
    year: "2026",
    url: "https://www.bps.go.id/id/statistics-table/2/NjkjMg%3D%3D/total-penumpang-pelayaran-dalam-negeri-di-pelabuhan-utama.html",
  },
};

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function percentChange(first, last) {
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

function SourceLine({ source }) {
  return (
    <div className="visual-source-line">
      <strong>Sumber: BPS</strong>
      <span>
        {source.title} · Diakses {ACCESS_DATE}
      </span>
      <a href={source.url} target="_blank" rel="noreferrer">
        Buka tabel
      </a>
    </div>
  );
}

function ModaChart({
  title,
  subtitle,
  data,
  valueKey,
  valueLabel,
  source,
}) {
  const peak = useMemo(() => {
    if (!data.length) return null;
    return data.reduce((max, row) =>
      row[valueKey] > max[valueKey] ? row : max
    );
  }, [data, valueKey]);

  const total = useMemo(() => {
    return data.reduce(
      (sum, row) => sum + Number(row[valueKey] || 0),
      0
    );
  }, [data, valueKey]);

  const first = data[0] || null;
  const last = data[data.length - 1] || null;
  const change =
    first && last
      ? percentChange(first[valueKey], last[valueKey])
      : 0;

  const direction = change > 0 ? "meningkat" : change < 0 ? "menurun" : "relatif tetap";

  return (
    <article className="moda-card reveal-up">
      <div className="moda-card-heading">
        <span className="viz-kicker">TREN BULANAN</span>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            x: data.map((row) => row.month),
            y: data.map((row) => row[valueKey]),
            customdata: data.map((row) => formatNumber(row[valueKey])),
            line: {
              color: ACCENT,
              width: 3,
            },
            marker: {
              color: ACCENT,
              size: 7,
              line: {
                color: "#51604D",
                width: 1,
              },
            },
            fill: "tozeroy",
            fillcolor: "rgba(233,255,79,0.07)",
            hovertemplate:
              "<b>%{x}</b><br>" +
              `${valueLabel}: %{customdata} orang` +
              "<extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          height: 285,
          margin: { l: 62, r: 14, t: 12, b: 44 },
          showlegend: false,
          hovermode: "x",
          hoverlabel: TOOLTIP_STYLE,
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(255,255,255,0.025)",
          font: {
            family: "Inter, system-ui, sans-serif",
            color: TEXT,
          },
          xaxis: {
            fixedrange: true,
            showgrid: false,
            tickfont: { size: 10, color: MUTED },
            linecolor: "rgba(255,255,255,0.16)",
          },
          yaxis: {
            fixedrange: true,
            rangemode: "tozero",
            tickformat: ".2s",
            title: {
              text: "Orang",
              font: { size: 11, color: MUTED },
            },
            tickfont: { size: 10, color: MUTED },
            gridcolor: "rgba(255,255,255,0.10)",
            zerolinecolor: "rgba(255,255,255,0.12)",
          },
        }}
        config={{ responsive: true, displaylogo: false }}
        useResizeHandler
        style={{ width: "100%" }}
      />

      <div className="moda-card-stats">
        <div>
          <span>Total periode</span>
          <strong>{formatNumber(total)}</strong>
          <small>orang</small>
        </div>

        <div>
          <span>Puncak bulanan</span>
          <strong>{peak ? formatNumber(peak[valueKey]) : "—"}</strong>
          <small>{peak ? peak.month : "—"}</small>
        </div>
      </div>

      <div className="moda-interpretation">
        <strong>Interpretasi</strong>
        {first && last && peak ? (
          <p>
            Puncak terjadi pada <strong>{peak.month}</strong> dengan
            {" "}<strong>{formatNumber(peak[valueKey])} orang</strong>. Dari
            {" "}{first.month} ke {last.month}, jumlah penumpang
            {" "}<strong>{direction}</strong> sekitar
            {" "}<strong>{Math.abs(change).toFixed(1)}%</strong>.
          </p>
        ) : (
          <p>Data belum cukup untuk menyusun interpretasi tren.</p>
        )}
      </div>

      <SourceLine source={source} />
    </article>
  );
}

function ModaTransportasi() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Papa.parse("/data/moda_transportasi_2026.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,

      complete: (result) => {
        const cleaned = result.data
          .map((row) => ({
            month_order: Number(row.month_order) || 0,
            month: String(row.month ?? "").trim(),
            kereta_people: Number(row.kereta_people) || 0,
            udara_5_bandara_departures:
              Number(row.udara_5_bandara_departures) || 0,
            laut_5_pelabuhan_departures:
              Number(row.laut_5_pelabuhan_departures) || 0,
          }))
          .filter((row) => row.month && row.month_order > 0)
          .sort((a, b) => a.month_order - b.month_order);

        setData(cleaned);
      },

      error: () => {
        setError("Gagal membaca moda_transportasi_2026.csv.");
      },
    });
  }, []);

  const periodLabel = useMemo(() => {
    if (!data.length) return "2026";
    return `${data[0].month}–${data[data.length - 1].month} 2026`;
  }, [data]);

  if (error) {
    return (
      <section id="moda" className="story-section">
        <p>{error}</p>
      </section>
    );
  }

  if (!data.length) {
    return (
      <section id="moda" className="story-section">
        <p>Memuat data moda transportasi...</p>
      </section>
    );
  }

  return (
    <section id="moda" className="story-section moda-section">
      <div className="section-heading reveal-up">
        <p className="eyebrow">JEMBATAN — MODA TRANSPORTASI</p>
        <h2>Mobilitas Berlangsung Melalui Berbagai Moda</h2>
        <p>
          Setelah melihat asal dan tujuan perjalanan, bagian ini memperlihatkan
          dinamika penumpang kereta api, penerbangan domestik, dan pelayaran
          dalam negeri selama {periodLabel}.
        </p>
      </div>

      <div className="story-callout reveal-up">
        <strong>Catatan keterbandingan</strong>
        <p>
          Angka pada tiga visual merupakan nilai riil, tetapi cakupannya tidak
          identik. Kereta memakai cakupan tabel penumpang kereta BPS, udara
          memakai keberangkatan dari 5 bandara utama, dan laut memakai
          keberangkatan dari 5 pelabuhan utama yang digunakan dalam preprocessing.
          Karena itu tinggi absolut antar-kartu tidak dibaca sebagai perbandingan
          langsung antarmoda.
        </p>
      </div>

      <div className="moda-grid">
        <ModaChart
          title="Kereta Api"
          subtitle="Jumlah penumpang bulanan; unit sumber dikonversi dari ribu orang menjadi orang."
          data={data}
          valueKey="kereta_people"
          valueLabel="Penumpang"
          source={SOURCES.rail}
        />

        <ModaChart
          title="Penerbangan Domestik"
          subtitle="Keberangkatan penumpang pada 5 bandara utama domestik."
          data={data}
          valueKey="udara_5_bandara_departures"
          valueLabel="Penumpang berangkat"
          source={SOURCES.air}
        />

        <ModaChart
          title="Pelayaran Dalam Negeri"
          subtitle="Keberangkatan penumpang pada 5 pelabuhan utama yang digunakan dalam data."
          data={data}
          valueKey="laut_5_pelabuhan_departures"
          valueLabel="Penumpang berangkat"
          source={SOURCES.sea}
        />
      </div>

      <div className="method-grid reveal-up">
        <article className="method-card">
          <span className="card-label">ENCODING VISUAL</span>
          <h3>Mengapa line chart?</h3>
          <p>
            <strong>Posisi horizontal</strong> menunjukkan urutan waktu bulanan,
            sedangkan <strong>posisi vertikal</strong> menunjukkan jumlah penumpang.
            Garis menghubungkan bulan secara berurutan sehingga perubahan dari
            satu bulan ke bulan berikutnya mudah dilihat. Marker membantu pembaca
            menemukan nilai bulanan saat hover.
          </p>
        </article>

        <article className="method-card">
          <span className="card-label">INTERPRETASI</span>
          <h3>Baca tren di dalam moda, bukan antar-skala</h3>
          <p>
            Setiap kartu memakai sumbu-Y mandiri karena skala dan cakupan sumber
            berbeda. Interpretasi yang aman adalah perubahan waktu di dalam moda,
            bulan puncak, dan arah perubahan selama periode tersedia.
          </p>
        </article>
      </div>

      <div className="source-block reveal-up">
        <span className="card-label">SUMBER DATA MODA</span>
        <strong>Sumber: BPS</strong>
        <p>
          Tabel statistik yang digunakan: <em>{SOURCES.rail.title}</em>,
          {" "}<em>{SOURCES.air.title}</em>, dan <em>{SOURCES.sea.title}</em>.
          Tahun data: 2026. Tanggal akses seluruh tabel: {ACCESS_DATE}.
        </p>
        <div className="source-links">
          <a href={SOURCES.rail.url} target="_blank" rel="noreferrer">Kereta api</a>
          <a href={SOURCES.air.url} target="_blank" rel="noreferrer">Angkutan udara</a>
          <a href={SOURCES.sea.url} target="_blank" rel="noreferrer">Pelayaran</a>
        </div>
      </div>

      <div className="section-transition reveal-up">
        <span>DARI ARUS KE RUANG</span>
        <h3>Bagaimana konteks jaringan jalan tersebar secara geografis?</h3>
        <p>
          Bagian berikut mempersempit perhatian pada jaringan jalan nasional
          sebagai salah satu konteks infrastruktur transportasi darat.
        </p>
      </div>
    </section>
  );
}

export default ModaTransportasi;
