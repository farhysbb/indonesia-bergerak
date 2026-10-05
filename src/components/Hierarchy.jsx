import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";

const ALL = "Semua Kabupaten/Kota";
const ACCESS_DATE = "3 Oktober 2026";
const TEXT = "#FFFFFF";
const MUTED = "#EDECED";

const SOURCES = {
  vehicles: {
    publisher: "BPS Provinsi Jawa Barat",
    title:
      "Jumlah Kendaraan Bermotor Menurut Kabupaten/Kota dan Jenis Kendaraan di Provinsi Jawa Barat (unit), 2025",
    year: "2025",
    underlying: "Badan Pendapatan Daerah Provinsi Jawa Barat",
    url:
      "https://jabar.bps.go.id/id/statistics-table/3/VjJ3NGRGa3dkRk5MTlU1bVNFOTVVbmQyVURSTVFUMDkjMw%3D%3D/number-of-registered-motor-vehicles-by-regency-municipality-and-type-of-motor-vehicles-in-jawa-barat-province--units---2016.html",
  },
  roads: {
    publisher: "BPS Provinsi Jawa Barat",
    title:
      "Panjang Jalan Menurut Kabupaten/Kota dan Tingkat Kewenangan Pemerintahan di Provinsi Jawa Barat (km), 2025",
    year: "2025",
    underlying: "Dinas Bina Marga dan Penataan Ruang Provinsi Jawa Barat",
    url:
      "https://jabar.bps.go.id/id/statistics-table/3/U0VOeFZEZFNiVnByUkdGMlNrOTFVVGRHY1ZkVGR6MDkjMw%3D%3D/panjang-jalan-menurut-kabupaten-kota-dan-tingkat-kewenangan-pemerintahan-di-provinsi-jawa-barat--km---2020.html",
  },
};

const HIERARCHY_SCALE = [
  [0, "#EDECED"],
  [0.45, "#C8D6A7"],
  [0.72, "#E9FF4F"],
  [1, "#879B35"],
];

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

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function Hierarchy() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [regionFilter, setRegionFilter] = useState(ALL);
  const [viewMode, setViewMode] = useState("treemap");

  useEffect(() => {
    Papa.parse("/data/hierarchy_jabar.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,

      complete: (result) => {
        const cleaned = result.data
          .map((row) => ({
            province: String(row.province ?? "").trim(),
            kabupaten_kota: String(row.kabupaten_kota ?? "").trim(),
            vehicle_type: String(row.vehicle_type ?? "").trim(),
            vehicle_count: Number(row.vehicle_count) || 0,
            total_vehicles: Number(row.total_vehicles) || 0,
            share_type_pct: Number(row.share_type_pct) || 0,
            state_road_km: Number(row.state_road_km) || 0,
            province_road_km: Number(row.province_road_km) || 0,
            local_road_km: Number(row.local_road_km) || 0,
            total_road_km: Number(row.total_road_km) || 0,
            vehicles_per_road_km: Number(row.vehicles_per_road_km) || 0,
          }))
          .filter((row) => row.kabupaten_kota && row.vehicle_type);

        setData(cleaned);
      },

      error: () => {
        setError("Gagal membaca hierarchy_jabar.csv.");
      },
    });
  }, []);

  const regions = useMemo(() => {
    return [...new Set(data.map((row) => row.kabupaten_kota))].sort((a, b) =>
      a.localeCompare(b, "id")
    );
  }, [data]);

  const filteredData = useMemo(() => {
    if (regionFilter === ALL) return data;
    return data.filter((row) => row.kabupaten_kota === regionFilter);
  }, [data, regionFilter]);

  const regionSummary = useMemo(() => {
    const map = new Map();

    filteredData.forEach((row) => {
      if (!map.has(row.kabupaten_kota)) {
        map.set(row.kabupaten_kota, {
          kabupaten_kota: row.kabupaten_kota,
          total_vehicles: row.total_vehicles,
          total_road_km: row.total_road_km,
          vehicles_per_road_km: row.vehicles_per_road_km,
        });
      }
    });

    return [...map.values()];
  }, [filteredData]);

  const totalVehicles = useMemo(() => {
    return regionSummary.reduce((sum, row) => sum + row.total_vehicles, 0);
  }, [regionSummary]);

  const totalRoad = useMemo(() => {
    return regionSummary.reduce((sum, row) => sum + row.total_road_km, 0);
  }, [regionSummary]);

  const vehiclesPerRoadKm = totalRoad > 0 ? totalVehicles / totalRoad : 0;

  const dominantVehicle = useMemo(() => {
    const totals = new Map();

    filteredData.forEach((row) => {
      totals.set(
        row.vehicle_type,
        (totals.get(row.vehicle_type) || 0) + row.vehicle_count
      );
    });

    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  }, [filteredData]);

  const topRegion = useMemo(() => {
    return [...regionSummary].sort(
      (a, b) => b.total_vehicles - a.total_vehicles
    )[0] || null;
  }, [regionSummary]);

  const highestRatioRegion = useMemo(() => {
    return [...regionSummary].sort(
      (a, b) => b.vehicles_per_road_km - a.vehicles_per_road_km
    )[0] || null;
  }, [regionSummary]);

  const hierarchy = useMemo(() => {
    if (!filteredData.length) {
      return {
        ids: [],
        labels: [],
        parents: [],
        values: [],
        colors: [],
        customdata: [],
      };
    }

    const ids = [];
    const labels = [];
    const parents = [];
    const values = [];
    const colors = [];
    const customdata = [];

    const rootId = "Jawa Barat";

    ids.push(rootId);
    labels.push("Jawa Barat");
    parents.push("");
    values.push(totalVehicles);
    colors.push(vehiclesPerRoadKm);
    customdata.push([
      "Provinsi",
      "Jawa Barat",
      "Semua jenis",
      formatNumber(totalVehicles),
      formatNumber(100, 1),
      formatNumber(totalRoad, 1),
      formatNumber(vehiclesPerRoadKm, 1),
    ]);

    regionSummary.forEach((region) => {
      const regionId = `region:${region.kabupaten_kota}`;

      ids.push(regionId);
      labels.push(region.kabupaten_kota);
      parents.push(rootId);
      values.push(region.total_vehicles);
      colors.push(region.vehicles_per_road_km);
      customdata.push([
        "Kabupaten/Kota",
        region.kabupaten_kota,
        "Semua jenis",
        formatNumber(region.total_vehicles),
        formatNumber(
          totalVehicles > 0
            ? (region.total_vehicles / totalVehicles) * 100
            : 0,
          1
        ),
        formatNumber(region.total_road_km, 1),
        formatNumber(region.vehicles_per_road_km, 1),
      ]);
    });

    filteredData.forEach((row) => {
      const parentId = `region:${row.kabupaten_kota}`;
      const leafId = `vehicle:${row.kabupaten_kota}:${row.vehicle_type}`;

      ids.push(leafId);
      labels.push(row.vehicle_type);
      parents.push(parentId);
      values.push(row.vehicle_count);
      colors.push(row.vehicles_per_road_km);
      customdata.push([
        "Jenis Kendaraan",
        row.kabupaten_kota,
        row.vehicle_type,
        formatNumber(row.vehicle_count),
        formatNumber(row.share_type_pct, 1),
        formatNumber(row.total_road_km, 1),
        formatNumber(row.vehicles_per_road_km, 1),
      ]);
    });

    return {
      ids,
      labels,
      parents,
      values,
      colors,
      customdata,
    };
  }, [filteredData, regionSummary, totalVehicles, totalRoad, vehiclesPerRoadKm]);

  if (error) {
    return (
      <section id="hierarchy" className="story-section">
        <p>{error}</p>
      </section>
    );
  }

  if (!data.length) {
    return (
      <section id="hierarchy" className="story-section">
        <p>Memuat data hierarchy...</p>
      </section>
    );
  }

  const plotType = viewMode === "treemap" ? "treemap" : "sunburst";

  return (
    <section id="hierarchy" className="story-section hierarchy-section">
<div className="section-cover section-cover-hierarchy">
  <div className="section-cover-content">
    <p className="eyebrow">
      03 — HIERARCHY
    </p>

    <h2>
      Bagaimana Kendaraan Bermotor Tersusun di Jawa Barat?
    </h2>

    <p>
      Bagian ini melakukan zoom-in ke Jawa Barat dan menyusun data menjadi
      tiga tingkat: Jawa Barat → Kabupaten/Kota → Jenis Kendaraan.
    </p>
  </div>
</div>

      <div className="hierarchy-controls reveal-up">
        <div className="field">
          <label htmlFor="hierarchy-region">Kabupaten/Kota</label>
          <select
            id="hierarchy-region"
            value={regionFilter}
            onChange={(event) => setRegionFilter(event.target.value)}
          >
            <option value={ALL}>{ALL}</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        <div className="segmented-control" aria-label="Representasi hierarchy">
          <button
            type="button"
            className={viewMode === "treemap" ? "active" : ""}
            onClick={() => setViewMode("treemap")}
          >
            Treemap
          </button>
          <button
            type="button"
            className={viewMode === "sunburst" ? "active" : ""}
            onClick={() => setViewMode("sunburst")}
          >
            Sunburst
          </button>
        </div>
      </div>

      <div className="metrics reveal-up">
        <div className="metric-card">
          <span>Total kendaraan</span>
          <strong>{formatNumber(totalVehicles)}</strong>
          <small>unit</small>
        </div>

        <div className="metric-card">
          <span>Total panjang jalan</span>
          <strong>{formatNumber(totalRoad)}</strong>
          <small>km</small>
        </div>

        <div className="metric-card">
          <span>Rasio kendaraan/jalan</span>
          <strong>{formatNumber(vehiclesPerRoadKm)}</strong>
          <small>kendaraan per km jalan</small>
        </div>

        <div className="metric-card">
          <span>Jenis dominan</span>
          <strong>{dominantVehicle ? dominantVehicle[0] : "—"}</strong>
          <small>
            {dominantVehicle ? `${formatNumber(dominantVehicle[1])} unit` : "—"}
          </small>
        </div>
      </div>

      <article className="chart-card reveal-up">
        <div className="viz-heading viz-heading-row">
          <div>
            <span className="viz-kicker">
              {viewMode === "treemap" ? "VISUAL 1 · TREEMAP" : "VISUAL 2 · SUNBURST"}
            </span>
            <h3>Struktur Kendaraan Bermotor Jawa Barat</h3>
            <p>
              Ukuran = jumlah kendaraan · Warna = kendaraan per km jalan
            </p>
          </div>
        </div>

        <Plot
          key={`${viewMode}-${regionFilter}`}
          data={[
            {
              type: plotType,
              ids: hierarchy.ids,
              labels: hierarchy.labels,
              parents: hierarchy.parents,
              values: hierarchy.values,
              branchvalues: "total",
              marker: {
                colors: hierarchy.colors,
                colorscale: HIERARCHY_SCALE,
                colorbar: {
                  title: {
                    text: "Kendaraan<br>per km jalan",
                    font: { color: TEXT },
                  },
                  tickfont: { color: MUTED },
                  outlinecolor: "rgba(255,255,255,0.18)",
                },
                line: {
                  color: "rgba(81,96,77,0.65)",
                  width: 1,
                },
              },
              customdata: hierarchy.customdata,
              hovertemplate:
                "<b>%{label}</b><br>" +
                "Tingkat: %{customdata[0]}<br>" +
                "Wilayah: %{customdata[1]}<br>" +
                "Jenis kendaraan: %{customdata[2]}<br><br>" +
                "Jumlah kendaraan: %{customdata[3]} unit<br>" +
                "Persentase: %{customdata[4]}%<br>" +
                "Panjang jalan: %{customdata[5]} km<br>" +
                "Kendaraan per km jalan: %{customdata[6]}" +
                "<extra></extra>",
              textinfo: viewMode === "treemap" ? "label+value" : "label",
              textfont: {
                color: "#273024",
              },
              pathbar:
                viewMode === "treemap"
                  ? {
                      visible: true,
                      textfont: { color: TEXT },
                    }
                  : undefined,
            },
          ]}
          layout={{
            autosize: true,
            height: viewMode === "treemap" ? 700 : 740,
            margin: { l: 8, r: 8, t: 20, b: 8 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            hoverlabel: TOOLTIP_STYLE,
            font: {
              family: "Inter, system-ui, sans-serif",
              color: TEXT,
            },
          }}
          config={{ responsive: true, displaylogo: false }}
          useResizeHandler
          style={{ width: "100%" }}
        />

        <div className="visual-source-line">
          <strong>Sumber: BPS Provinsi Jawa Barat</strong>
          <span>Data kendaraan dan panjang jalan 2025 · Diakses {ACCESS_DATE}</span>
          <a href={SOURCES.vehicles.url} target="_blank" rel="noreferrer">
            Tabel kendaraan
          </a>
          <a href={SOURCES.roads.url} target="_blank" rel="noreferrer">
            Tabel jalan
          </a>
        </div>
      </article>

      <div className="interpretation-card reveal-up">
        <span className="card-label">INTERPRETASI</span>
        <h3>Apa yang tampak dari struktur ini?</h3>
        {regionFilter === ALL && topRegion ? (
          <p>
            Pada tingkat kabupaten/kota, <strong>{topRegion.kabupaten_kota}</strong>
            {" "}memiliki total kendaraan terbesar, yaitu
            {" "}<strong>{formatNumber(topRegion.total_vehicles)} unit</strong>.
            {dominantVehicle && (
              <>
                {" "}Secara keseluruhan, jenis kendaraan yang paling dominan adalah
                {" "}<strong>{dominantVehicle[0]}</strong>.
              </>
            )}
          </p>
        ) : topRegion ? (
          <p>
            Di <strong>{topRegion.kabupaten_kota}</strong>, total kendaraan mencapai
            {" "}<strong>{formatNumber(topRegion.total_vehicles)} unit</strong> dan
            rasio terhadap panjang jalan sebesar
            {" "}<strong>{formatNumber(topRegion.vehicles_per_road_km, 1)} kendaraan/km</strong>.
            {dominantVehicle && (
              <>
                {" "}Jenis kendaraan terbesar adalah <strong>{dominantVehicle[0]}</strong>.
              </>
            )}
          </p>
        ) : null}

        {regionFilter === ALL && highestRatioRegion && (
          <p>
            Rasio kendaraan terhadap panjang jalan tertinggi terdapat di
            {" "}<strong>{highestRatioRegion.kabupaten_kota}</strong> dengan sekitar
            {" "}<strong>{formatNumber(highestRatioRegion.vehicles_per_road_km, 1)} kendaraan per km jalan</strong>.
            Rasio ini hanya konteks antara stok kendaraan dan panjang jaringan jalan,
            bukan ukuran langsung kemacetan.
          </p>
        )}
      </div>

      <div className="method-grid reveal-up">
        <article className="method-card">
          <span className="card-label">ENCODING VISUAL</span>
          <h3>Ukuran dan warna membawa dua informasi berbeda</h3>
          <p>
            <strong>Ukuran area</strong> mengodekan jumlah kendaraan sehingga unit
            dengan stok kendaraan lebih besar mendapat ruang visual lebih besar.
            <strong> Warna</strong> mengodekan rasio total kendaraan terhadap panjang
            jalan kabupaten/kota, sehingga pembaca dapat membandingkan konteks
            kendaraan dan jaringan jalan pada saat yang sama.
          </p>
        </article>

        <article className="method-card">
          <span className="card-label">HIERARKI & INTERAKSI</span>
          <h3>Tiga level dan drilldown</h3>
          <p>
            Struktur dibangun sebagai Jawa Barat → Kabupaten/Kota → Jenis Kendaraan.
            Treemap menekankan perbandingan luas, sedangkan Sunburst menekankan
            hubungan induk–anak secara radial. Hover menyediakan detail, dan Treemap
            menyediakan path/breadcrumb untuk drilldown.
          </p>
        </article>
      </div>

      <div className="source-block reveal-up">
        <span className="card-label">SUMBER DATA HIERARCHY</span>
        <strong>Sumber: BPS Provinsi Jawa Barat</strong>
        <p>
          1) <em>{SOURCES.vehicles.title}</em>. Tahun data: {SOURCES.vehicles.year}.
          Sumber asal yang dicantumkan BPS: {SOURCES.vehicles.underlying}.
        </p>
        <p>
          2) <em>{SOURCES.roads.title}</em>. Tahun data: {SOURCES.roads.year}.
          Sumber asal yang dicantumkan BPS: {SOURCES.roads.underlying}.
        </p>
        <div className="source-links">
          <a href={SOURCES.vehicles.url} target="_blank" rel="noreferrer">URL tabel kendaraan</a>
          <a href={SOURCES.roads.url} target="_blank" rel="noreferrer">URL tabel panjang jalan</a>
        </div>
        <p>Tanggal akses: {ACCESS_DATE}.</p>
      </div>
    </section>
  );
}

export default Hierarchy;
