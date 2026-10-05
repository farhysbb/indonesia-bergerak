import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Plot from "react-plotly.js";
import Papa from "papaparse";


const ALL = "Seluruh Indonesia";


const SOURCE_META = {

  spatialTitle:
    "Shapefile Jaringan Jalan Nasional & Provinsi Indonesia",
  spatialProvider:
    "Direktorat Jenderal Bina Marga, diperoleh melalui LapakGIS",
  spatialUrl:
    "https://www.lapakgis.com/2019/08/shapefile-jaringan-jalan-nasional-provinsi-indonesia.html",
};


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

const CHORO_COLORS = [
  "#f3f4f6",
  "#eff3ff",
  "#bdd7e7",
  "#6baed6",
  "#3182bd",
  "#08519c",
];


const HEX_COLORS = [
  "#feedde",
  "#fdbe85",
  "#fd8d3c",
  "#e6550d",
  "#a63603",
];


// ==========================================
// HELPERS
// ==========================================

function quantile(sortedValues, q) {
  if (!sortedValues.length) {
    return 0;
  }

  const position =
    (sortedValues.length - 1) * q;

  const base =
    Math.floor(position);

  const rest =
    position - base;

  if (
    sortedValues[base + 1] !==
    undefined
  ) {
    return (
      sortedValues[base] +
      rest *
        (
          sortedValues[base + 1] -
          sortedValues[base]
        )
    );
  }

  return sortedValues[base];
}


function getQuintileThresholds(
  values
) {
  const sorted =
    values
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0
      )
      .sort(
        (a, b) =>
          a - b
      );

  return {
    q20:
      quantile(
        sorted,
        0.20
      ),

    q40:
      quantile(
        sorted,
        0.40
      ),

    q60:
      quantile(
        sorted,
        0.60
      ),

    q80:
      quantile(
        sorted,
        0.80
      ),
  };
}


function classifyDensity(
  value,
  thresholds
) {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0;
  }

  if (
    value <= thresholds.q20
  ) {
    return 1;
  }

  if (
    value <= thresholds.q40
  ) {
    return 2;
  }

  if (
    value <= thresholds.q60
  ) {
    return 3;
  }

  if (
    value <= thresholds.q80
  ) {
    return 4;
  }

  return 5;
}


function classifyHex(
  value,
  thresholds
) {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  if (
    value <= thresholds.q20
  ) {
    return 1;
  }

  if (
    value <= thresholds.q40
  ) {
    return 2;
  }

  if (
    value <= thresholds.q60
  ) {
    return 3;
  }

  if (
    value <= thresholds.q80
  ) {
    return 4;
  }

  return 5;
}


function formatNumber(
  value,
  maximumFractionDigits = 0
) {
  return Number(
    value || 0
  ).toLocaleString(
    "id-ID",
    {
      maximumFractionDigits,
    }
  );
}


// ==========================================
// DISCRETE COLOR SCALES
// ==========================================

const CHORO_SCALE = [
  [0.000, CHORO_COLORS[0]],
  [0.099, CHORO_COLORS[0]],

  [0.100, CHORO_COLORS[1]],
  [0.299, CHORO_COLORS[1]],

  [0.300, CHORO_COLORS[2]],
  [0.499, CHORO_COLORS[2]],

  [0.500, CHORO_COLORS[3]],
  [0.699, CHORO_COLORS[3]],

  [0.700, CHORO_COLORS[4]],
  [0.899, CHORO_COLORS[4]],

  [0.900, CHORO_COLORS[5]],
  [1.000, CHORO_COLORS[5]],
];


const HEX_SCALE = [
  [0.000, HEX_COLORS[0]],
  [0.124, HEX_COLORS[0]],

  [0.125, HEX_COLORS[1]],
  [0.374, HEX_COLORS[1]],

  [0.375, HEX_COLORS[2]],
  [0.624, HEX_COLORS[2]],

  [0.625, HEX_COLORS[3]],
  [0.874, HEX_COLORS[3]],

  [0.875, HEX_COLORS[4]],
  [1.000, HEX_COLORS[4]],
];


// ==========================================
// COMPONENT
// ==========================================

function Geospatial() {
  const [
    roads,
    setRoads,
  ] = useState([]);

  const [
    kabGeojson,
    setKabGeojson,
  ] = useState(null);

  const [
    hexGeojson,
    setHexGeojson,
  ] = useState(null);

  const [
    province,
    setProvince,
  ] = useState(ALL);

  const [
    mapMode,
    setMapMode,
  ] = useState(
    "choropleth"
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    viewportWidth,
    setViewportWidth,
  ] = useState(
    typeof window !==
      "undefined"
      ? window.innerWidth
      : 1200
  );


  // ========================================
  // RESPONSIVE VIEWPORT
  // ========================================

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(
        window.innerWidth
      );
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);


  // ========================================
  // LOAD DATA
  // ========================================

  useEffect(() => {
    async function loadData() {
      try {
        const [
          roadResponse,
          kabResponse,
          hexResponse,
        ] =
          await Promise.all([
            fetch(
              "/data/road_summary.csv"
            ),

            fetch(
              "/data/kabkota.geojson"
            ),

            fetch(
              "/data/road_hex.geojson"
            ),
          ]);


        if (
          !roadResponse.ok
        ) {
          throw new Error(
            "road_summary.csv tidak ditemukan."
          );
        }


        if (
          !kabResponse.ok
        ) {
          throw new Error(
            "kabkota.geojson tidak ditemukan."
          );
        }


        if (
          !hexResponse.ok
        ) {
          throw new Error(
            "road_hex.geojson tidak ditemukan. Jalankan preprocess_hexbin.py terlebih dahulu."
          );
        }


        const csvText =
          await roadResponse.text();

        const kab =
          await kabResponse.json();

        const hex =
          await hexResponse.json();


        const parsed =
          Papa.parse(
            csvText,
            {
              header: true,
              skipEmptyLines:
                true,
            }
          );


        const cleaned =
          parsed.data
            .map(
              (row) => ({
                kode_kabkota:
                  String(
                    row.kode_kabkota ??
                    ""
                  ).trim(),

                kabupaten_kota:
                  String(
                    row.kabupaten_kota ??
                    ""
                  ).trim(),

                provinsi:
                  String(
                    row.provinsi ??
                    ""
                  ).trim(),

                road_length_km:
                  Number(
                    row.road_length_km
                  ) || 0,

                area_km2:
                  Number(
                    row.area_km2
                  ) || 0,

                road_density:
                  Number(
                    row.road_density
                  ) || 0,

                lon:
                  Number(
                    row.symbol_lon ??
                    row.centroid_lon
                  ),

                lat:
                  Number(
                    row.symbol_lat ??
                    row.centroid_lat
                  ),
              })
            )
            .filter(
              (row) =>
                row.kode_kabkota &&
                row.kabupaten_kota
            );


        setRoads(
          cleaned
        );

        setKabGeojson(
          kab
        );

        setHexGeojson(
          hex
        );

        setLoading(
          false
        );

      } catch (err) {
        console.error(
          err
        );

        setError(
          err.message ||
          "Gagal memuat data geospasial."
        );

        setLoading(
          false
        );
      }
    }


    loadData();

  }, []);


  // ========================================
  // LIST PROVINSI
  // ========================================

  const provinces =
    useMemo(() => {
      return [
        ...new Set(
          roads
            .map(
              (row) =>
                row.provinsi
            )
            .filter(Boolean)
        ),
      ].sort(
        (a, b) =>
          a.localeCompare(
            b,
            "id"
          )
      );
    }, [roads]);


  // ========================================
  // FILTER CHOROPLETH
  // ========================================

  const filteredRoads =
    useMemo(() => {
      if (
        province === ALL
      ) {
        return roads;
      }

      return roads.filter(
        (row) =>
          row.provinsi ===
          province
      );
    }, [
      roads,
      province,
    ]);



  const densityThresholds =
    useMemo(() => {
      return (
        getQuintileThresholds(
          roads.map(
            (row) =>
              row.road_density
          )
        )
      );
    }, [roads]);


  const choroplethRows =
    useMemo(() => {
      return (
        filteredRoads.map(
          (row) => ({
            ...row,

            density_class:
              classifyDensity(
                row.road_density,
                densityThresholds
              ),
          })
        )
      );
    }, [
      filteredRoads,
      densityThresholds,
    ]);


  // ========================================
  // HEX DATA
  // ========================================

  const hexRows =
    useMemo(() => {
      if (
        !hexGeojson
      ) {
        return [];
      }

      return (
        (
          hexGeojson.features ||
          []
        ).map(
          (feature) => ({
            hex_id:
              String(
                feature
                  .properties
                  ?.hex_id ??
                ""
              ),

            road_length_km:
              Number(
                feature
                  .properties
                  ?.road_length_km
              ) || 0,

            hex_area_km2:
              Number(
                feature
                  .properties
                  ?.hex_area_km2
              ) || 0,
          })
        )
      );
    }, [hexGeojson]);


  const hexThresholds =
    useMemo(() => {
      return (
        getQuintileThresholds(
          hexRows.map(
            (row) =>
              row.road_length_km
          )
        )
      );
    }, [hexRows]);


  const classifiedHexRows =
    useMemo(() => {
      return (
        hexRows.map(
          (row) => ({
            ...row,

            hex_class:
              classifyHex(
                row.road_length_km,
                hexThresholds
              ),
          })
        )
      );
    }, [
      hexRows,
      hexThresholds,
    ]);


  // ========================================
  // METRICS
  // ========================================

  const totalRoad =
    useMemo(() => {
      return (
        filteredRoads.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.road_length_km,
          0
        )
      );
    }, [filteredRoads]);


  const totalArea =
    useMemo(() => {
      return (
        filteredRoads.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.area_km2,
          0
        )
      );
    }, [filteredRoads]);


  /*
    Kepadatan agregat bukan mean sederhana
    kepadatan kab/kota.

    Rumus:
    total panjang jalan / total luas × 100.
  */

  const aggregateDensity =
    totalArea > 0
      ? (
          totalRoad /
          totalArea
        ) * 100
      : 0;


  const regionsWithRoad =
    filteredRoads.filter(
      (row) =>
        row.road_length_km >
        0
    ).length;


  // ========================================
  // INTERPRETATION
  // ========================================

  const choroInterpretation =
    useMemo(() => {
      const positive =
        choroplethRows
          .filter(
            (row) =>
              row.road_density >
              0
          )
          .sort(
            (a, b) =>
              b.road_density -
              a.road_density
          );

      const top =
        positive[0] || null;

      const topLength =
        [
          ...choroplethRows,
        ]
          .filter(
            (row) =>
              row.road_length_km >
              0
          )
          .sort(
            (a, b) =>
              b.road_length_km -
              a.road_length_km
          )[0] || null;

      const highestClassCount =
        choroplethRows.filter(
          (row) =>
            row.density_class ===
            5
        ).length;

      const zeroCount =
        choroplethRows.filter(
          (row) =>
            row.road_length_km <=
            0
        ).length;

      return {
        top,
        topLength,
        highestClassCount,
        zeroCount,
      };

    }, [choroplethRows]);


  const hexInterpretation =
    useMemo(() => {
      if (
        !classifiedHexRows.length
      ) {
        return {
          maxHex: null,
          topClassCount: 0,
          topShare: 0,
        };
      }

      const sorted =
        [
          ...classifiedHexRows,
        ].sort(
          (a, b) =>
            b.road_length_km -
            a.road_length_km
        );

      const maxHex =
        sorted[0];

      const topRows =
        classifiedHexRows.filter(
          (row) =>
            row.hex_class === 5
        );

      const total =
        classifiedHexRows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.road_length_km,
          0
        );

      const topTotal =
        topRows.reduce(
          (
            sum,
            row
          ) =>
            sum +
            row.road_length_km,
          0
        );

      return {
        maxHex,
        topClassCount:
          topRows.length,
        topShare:
          total > 0
            ? (
                topTotal /
                total
              ) * 100
            : 0,
      };

    }, [classifiedHexRows]);


  // ========================================
  // RESPONSIVE MAP SETTINGS
  // ========================================

  const isMobile =
    viewportWidth < 640;

  const isTablet =
    viewportWidth >= 640 &&
    viewportWidth < 960;


  const isNationalView =
    mapMode ===
      "hexbin" ||
    province ===
      ALL;


  const mapCenter =
    useMemo(() => {
      if (
        isNationalView
      ) {
        return {
          lat: -2.3,
          lon: 118.2,
        };
      }

      const valid =
        filteredRoads.filter(
          (row) =>
            Number.isFinite(
              row.lat
            ) &&
            Number.isFinite(
              row.lon
            )
        );


      if (
        !valid.length
      ) {
        return {
          lat: -2.3,
          lon: 118.2,
        };
      }


      return {
        lat:
          valid.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.lat,
            0
          ) /
          valid.length,

        lon:
          valid.reduce(
            (
              sum,
              row
            ) =>
              sum +
              row.lon,
            0
          ) /
          valid.length,
      };

    }, [
      filteredRoads,
      isNationalView,
    ]);


  const nationalZoom =
    isMobile
      ? 2.35
      : isTablet
        ? 2.75
        : 3.15;


  const provinceZoom =
    isMobile
      ? 4.7
      : isTablet
        ? 5.2
        : 5.8;


  const mapZoom =
    isNationalView
      ? nationalZoom
      : provinceZoom;


  const mapHeight =
    isMobile
      ? 500
      : isTablet
        ? 600
        : 720;


  // ========================================
  // TRACES
  // ========================================

  const choroplethTrace = {
    type:
      "choroplethmap",

    geojson:
      kabGeojson,

    locations:
      choroplethRows.map(
        (row) =>
          row.kode_kabkota
      ),

    z:
      choroplethRows.map(
        (row) =>
          row.density_class
      ),

    zmin: 0,
    zmax: 5,

    featureidkey:
      "properties.kode_kabkota",

    colorscale:
      CHORO_SCALE,

    showscale:
      false,

    marker: {
      opacity: 0.9,

      line: {
        width:
          isMobile
            ? 0.18
            : 0.35,

        color:
          "#ffffff",
      },
    },

    customdata:
      choroplethRows.map(
        (row) => [
          row.kabupaten_kota,
          row.provinsi,
          formatNumber(row.road_density, 2),
          formatNumber(row.road_length_km, 2),
          formatNumber(row.area_km2),
        ]
      ),

    hovertemplate:
      "<b>%{customdata[0]}</b><br>" +
      "%{customdata[1]}<br><br>" +
      "Kepadatan jalan nasional: %{customdata[2]} km / 100 km²<br>" +
      "Panjang jalan nasional: %{customdata[3]} km<br>" +
      "Luas wilayah: %{customdata[4]} km²" +
      "<extra></extra>",
  };


  const hexTrace = {
    type:
      "choroplethmap",

    geojson:
      hexGeojson,

    locations:
      classifiedHexRows.map(
        (row) =>
          row.hex_id
      ),

    z:
      classifiedHexRows.map(
        (row) =>
          row.hex_class
      ),

    zmin: 1,
    zmax: 5,

    featureidkey:
      "properties.hex_id",

    colorscale:
      HEX_SCALE,

    showscale:
      false,

    marker: {
      opacity: 0.84,

      line: {
        width:
          isMobile
            ? 0.15
            : 0.3,

        color:
          "#ffffff",
      },
    },

    customdata:
      classifiedHexRows.map(
        (row) => [
          formatNumber(row.road_length_km, 2),
          formatNumber(row.hex_area_km2),
        ]
      ),

    hovertemplate:
      "<b>Sel Hexagon</b><br>" +
      "Panjang jalan nasional: %{customdata[0]} km<br>" +
      "Luas sel: %{customdata[1]} km²" +
      "<extra></extra>",
  };


  // ========================================
  // LOADING / ERROR
  // ========================================

  if (
    loading
  ) {
    return (
      <p>
        Memuat data
        geospasial...
      </p>
    );
  }


  if (
    error
  ) {
    return (
      <p>
        Error: {error}
      </p>
    );
  }


  // ========================================
  // RENDER
  // ========================================

  const activeTitle =
    mapMode ===
    "choropleth"
      ? "Kepadatan Jaringan Jalan Nasional per Kabupaten/Kota"
      : "Konsentrasi Panjang Jalan Nasional per Sel Heksagon";


  const activeUnit =
    mapMode ===
    "choropleth"
      ? "km jalan nasional per 100 km² wilayah"
      : "km jalan nasional per sel heksagon";


  return (
    <section
      id="geospatial"
      className="story-section geospatial-section"
    >

      {/* HEADER */}

<div className="section-cover section-cover-geo">
  <div className="section-cover-content">
    <p className="eyebrow">
      02 — PEMETAAN SPASIAL
    </p>

    <h2>
      Di Mana Jaringan Jalan Nasional Terkonsentrasi?
    </h2>

    <p>
      Persebaran jaringan jalan dibaca melalui dua sudut pandang.
      Choropleth menunjukkan kepadatan relatif menurut wilayah administratif,
      sedangkan hexbin menunjukkan konsentrasi jaringan dalam unit ruang
      berukuran seragam.
    </p>
  </div>
</div>


      <div className="hierarchy-controls geo-controls reveal-up">

  {/* FILTER */}
  <div className="field">
    <label htmlFor="geo-province">
      Filter Provinsi
    </label>

    <select
      id="geo-province"
      value={province}
      onChange={(e) =>
        setProvince(e.target.value)
      }
      disabled={mapMode === "hexbin"}
    >
      <option value={ALL}>
        {ALL}
      </option>

      {provinces.map((name) => (
        <option
          key={name}
          value={name}
        >
          {name}
        </option>
      ))}
    </select>
  </div>


  {/* MODE */}
  <div
    className="segmented-control"
    role="tablist"
    aria-label="Jenis visualisasi geospasial"
  >
    <button
      type="button"
      className={
        mapMode === "choropleth"
          ? "active"
          : ""
      }
      onClick={() =>
        setMapMode("choropleth")
      }
    >
      Choropleth
    </button>

    <button
      type="button"
      className={
        mapMode === "hexbin"
          ? "active"
          : ""
      }
      onClick={() =>
        setMapMode("hexbin")
      }
    >
      Hexbin
    </button>
  </div>

</div>


      {/* VISUAL TITLE */}

      <div
        className=
          "geo-viz-header"
      >

        <div>
          <span
            className=
              "geo-viz-kicker"
          >
            {
              mapMode ===
              "choropleth"
                ? "PETA 1 · CHOROPLETH"
                : "PETA 2 · HEXBIN"
            }
          </span>

          <h3>
            {activeTitle}
          </h3>

          <p>
            Satuan:
            {" "}
            <strong>
              {activeUnit}
            </strong>
          </p>
        </div>

      </div>


      {/* METRICS */}

      {
        mapMode ===
          "choropleth" && (

          <div
            className=
              "metrics geo-metrics"
          >

            <div
              className=
                "metric-card"
            >

              <span>
                Panjang Jalan
                Nasional
              </span>

              <strong>
                {
                  formatNumber(
                    totalRoad
                  )
                }
                {" "}
                km
              </strong>

            </div>


            <div
              className=
                "metric-card"
            >

              <span>
                Kepadatan Agregat
              </span>

              <strong>
                {
                  aggregateDensity
                    .toFixed(2)
                }
              </strong>

              <small>
                km / 100 km²
              </small>

            </div>


            <div
              className=
                "metric-card"
            >

              <span>
                Kab/Kota dengan
                Jalan Nasional
              </span>

              <strong>
                {regionsWithRoad}
              </strong>

            </div>

          </div>

        )
      }


      {/* LEGEND */}

      {
        mapMode ===
          "choropleth"
            ? (

              <div
                className=
                  "geo-legend-wrap"
              >

                <div
                  className=
                    "geo-legend-heading"
                >
                  <strong>
                    Legenda kepadatan
                  </strong>

                  <span>
                    Kuantil nasional ·
                    5 kelas nilai positif
                  </span>
                </div>


                <div
                  className=
                    "geo-legend"
                >

                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            0
                          ],
                      }}
                    />

                    <span>
                      Tidak ada ruas
                    </span>
                  </div>


                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            1
                          ],
                      }}
                    />

                    <span>
                      ≤{" "}
                      {
                        densityThresholds
                          .q20
                          .toFixed(2)
                      }
                    </span>
                  </div>


                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            2
                          ],
                      }}
                    />

                    <span>
                      {
                        densityThresholds
                          .q20
                          .toFixed(2)
                      }
                      {" – "}
                      {
                        densityThresholds
                          .q40
                          .toFixed(2)
                      }
                    </span>
                  </div>


                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            3
                          ],
                      }}
                    />

                    <span>
                      {
                        densityThresholds
                          .q40
                          .toFixed(2)
                      }
                      {" – "}
                      {
                        densityThresholds
                          .q60
                          .toFixed(2)
                      }
                    </span>
                  </div>


                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            4
                          ],
                      }}
                    />

                    <span>
                      {
                        densityThresholds
                          .q60
                          .toFixed(2)
                      }
                      {" – "}
                      {
                        densityThresholds
                          .q80
                          .toFixed(2)
                      }
                    </span>
                  </div>


                  <div
                    className=
                      "geo-legend-item"
                  >
                    <i
                      style={{
                        background:
                          CHORO_COLORS[
                            5
                          ],
                      }}
                    />

                    <span>
                      &gt;{" "}
                      {
                        densityThresholds
                          .q80
                          .toFixed(2)
                      }
                      {" "}
                      km / 100 km²
                    </span>
                  </div>

                </div>

              </div>

            )

            :

            (

              <div
                className=
                  "geo-legend-wrap"
              >

                <div
                  className=
                    "geo-legend-heading"
                >
                  <strong>
                    Legenda panjang jalan
                  </strong>

                  <span>
                    Kuantil nasional ·
                    km per hexagon
                  </span>
                </div>


                <div
                  className=
                    "geo-legend"
                >

                  {
                    [
                      {
                        color:
                          HEX_COLORS[
                            0
                          ],

                        text:
                          `≤ ${hexThresholds.q20.toFixed(1)} km`,
                      },

                      {
                        color:
                          HEX_COLORS[
                            1
                          ],

                        text:
                          `${hexThresholds.q20.toFixed(1)} – ${hexThresholds.q40.toFixed(1)} km`,
                      },

                      {
                        color:
                          HEX_COLORS[
                            2
                          ],

                        text:
                          `${hexThresholds.q40.toFixed(1)} – ${hexThresholds.q60.toFixed(1)} km`,
                      },

                      {
                        color:
                          HEX_COLORS[
                            3
                          ],

                        text:
                          `${hexThresholds.q60.toFixed(1)} – ${hexThresholds.q80.toFixed(1)} km`,
                      },

                      {
                        color:
                          HEX_COLORS[
                            4
                          ],

                        text:
                          `> ${hexThresholds.q80.toFixed(1)} km`,
                      },
                    ].map(
                      (item) => (

                        <div
                          className=
                            "geo-legend-item"

                          key={
                            item.text
                          }
                        >

                          <i
                            style={{
                              background:
                                item.color,
                            }}
                          />

                          <span>
                            {
                              item.text
                            }
                          </span>

                        </div>

                      )
                    )
                  }

                </div>

              </div>

            )
      }


      {/* MAP */}

      <div
        className=
          "chart-card geo-map-card"
      >

        <Plot
          key={
            `${mapMode}-${province}-${isMobile}-${isTablet}`
          }

          data={[
            mapMode ===
              "choropleth"
              ? choroplethTrace
              : hexTrace,
          ]}

          layout={{
            autosize: true,

            height:
              mapHeight,

            margin: {
              l: 0,
              r: 0,
              t: 0,
              b: 0,
            },

            map: {
              style:
                "open-street-map",

              center:
                mapCenter,

              zoom:
                mapZoom,
            },

            showlegend:
              false,

            hoverlabel:
              TOOLTIP_STYLE,

            paper_bgcolor:
              "rgba(0,0,0,0)",

            plot_bgcolor:
              "rgba(0,0,0,0)",
          }}

          config={{
            responsive: true,

            displaylogo:
              false,

            scrollZoom:
              true,

            modeBarButtonsToRemove: [
              "lasso2d",
              "select2d",
            ],
          }}

          useResizeHandler

          style={{
            width: "100%",
            height: "100%",
          }}
        />

      </div>


      {/* INTERPRETATION */}

      <div
        className=
          "geo-interpretation"
      >

        <div
          className=
            "geo-card-label"
        >
          INTERPRETASI
        </div>

        {
          mapMode ===
          "choropleth"
            ? (
              <>
                <h3>
                  Apa yang terlihat
                  dari peta ini?
                </h3>

                {
                  choroInterpretation
                    .top && (

                    <p>
                      Pada tampilan
                      <strong>
                        {" "}
                        {
                          province ===
                          ALL
                            ? "nasional"
                            : province
                        }
                      </strong>,
                      kepadatan jaringan
                      jalan nasional
                      tertinggi terdapat
                      di
                      <strong>
                        {" "}
                        {
                          choroInterpretation
                            .top
                            .kabupaten_kota
                        }
                      </strong>
                      {" "}
                      sebesar
                      <strong>
                        {" "}
                        {
                          choroInterpretation
                            .top
                            .road_density
                            .toFixed(2)
                        }
                        {" "}
                        km / 100 km²
                      </strong>.
                    </p>

                  )
                }


                <p>
                  Sebanyak
                  <strong>
                    {" "}
                    {
                      choroInterpretation
                        .highestClassCount
                    }
                    {" "}
                    kabupaten/kota
                  </strong>
                  {" "}
                  pada tampilan ini
                  berada pada kelas
                  kuantil tertinggi
                  berdasarkan ambang
                  nasional.

                  {" "}

                  Warna lebih gelap
                  berarti jaringan
                  jalan nasional lebih
                  rapat relatif terhadap
                  luas wilayah.
                </p>


                {
                  choroInterpretation
                    .topLength && (

                    <p>
                      Wilayah dengan
                      panjang jalan
                      nasional absolut
                      terbesar adalah
                      <strong>
                        {" "}
                        {
                          choroInterpretation
                            .topLength
                            .kabupaten_kota
                        }
                      </strong>
                      {" "}
                      sebesar
                      <strong>
                        {" "}
                        {
                          formatNumber(
                            choroInterpretation
                              .topLength
                              .road_length_km,
                            2
                          )
                        }
                        {" "}
                        km
                      </strong>.

                      {" "}

                      Nilai ini dapat
                      berbeda dari
                      wilayah dengan
                      kepadatan tertinggi
                      karena choropleth
                      menormalisasi
                      panjang jalan
                      terhadap luas
                      wilayah.
                    </p>

                  )
                }


                <p
                  className=
                    "geo-caution"
                >
                  Kepadatan jalan
                  bukan ukuran
                  kemacetan, kualitas
                  jalan, kapasitas,
                  atau volume lalu
                  lintas.
                </p>
              </>
            )
            : (
              <>
                <h3>
                  Apa yang terlihat
                  dari pola hexbin?
                </h3>

                {
                  hexInterpretation
                    .maxHex && (

                    <p>
                      Sel dengan
                      konsentrasi
                      jaringan tertinggi
                      memuat sekitar
                      <strong>
                        {" "}
                        {
                          formatNumber(
                            hexInterpretation
                              .maxHex
                              .road_length_km,
                            2
                          )
                        }
                        {" "}
                        km
                      </strong>
                      {" "}
                      jalan nasional.
                    </p>

                  )
                }


                <p>
                  Terdapat
                  <strong>
                    {" "}
                    {
                      hexInterpretation
                        .topClassCount
                    }
                    {" "}
                    sel
                  </strong>
                  {" "}
                  pada kuantil
                  tertinggi.

                  {" "}

                  Sel-sel tersebut
                  memuat sekitar
                  <strong>
                    {" "}
                    {
                      hexInterpretation
                        .topShare
                        .toFixed(1)
                    }
                    %
                  </strong>
                  {" "}
                  dari total panjang
                  jalan yang terpetakan
                  pada grid.
                </p>


                <p>
                  Karena semua hexagon
                  berukuran sama,
                  warna dapat dibaca
                  sebagai perbandingan
                  konsentrasi spasial
                  yang tidak dipengaruhi
                  perbedaan luas
                  kabupaten/kota.
                </p>


                <p
                  className=
                    "geo-caution"
                >
                  Hexbin menunjukkan
                  lokasi konsentrasi
                  jaringan, bukan
                  jumlah kendaraan,
                  arus lalu lintas,
                  atau kualitas jalan.
                </p>
              </>
            )
        }

      </div>


      {/* ENCODING + METHOD */}

      <div
        className=
          "geo-method-grid"
      >

        <article
          className=
            "geo-method-card"
        >

          <div
            className=
              "geo-card-label"
          >
            ENCODING VISUAL
          </div>

          {
            mapMode ===
            "choropleth"
              ? (
                <>
                  <h3>
                    Mengapa encoding
                    ini dipilih?
                  </h3>

                  <p>
                    <strong>
                      Posisi
                    </strong>
                    {" "}
                    mempertahankan
                    lokasi geografis
                    kabupaten/kota.

                    {" "}

                    <strong>
                      Warna
                    </strong>
                    {" "}
                    mengodekan
                    kepadatan jalan
                    nasional karena
                    intensitas warna
                    efektif untuk
                    menunjukkan urutan
                    nilai rendah hingga
                    tinggi.
                  </p>

                  <p>
                    <strong>
                      Bentuk
                    </strong>
                    {" "}
                    mengikuti batas
                    administratif agar
                    pembaca dapat
                    menghubungkan nilai
                    dengan wilayah.

                    {" "}

                    <strong>
                      Ukuran polygon
                    </strong>
                    {" "}
                    tidak digunakan
                    sebagai encoding
                    data karena luas
                    kabupaten/kota
                    merupakan kondisi
                    geografis, bukan
                    nilai indikator.
                  </p>
                </>
              )
              : (
                <>
                  <h3>
                    Mengapa encoding
                    ini dipilih?
                  </h3>

                  <p>
                    <strong>
                      Posisi
                    </strong>
                    {" "}
                    menunjukkan lokasi
                    setiap sel di ruang
                    geografis.

                    {" "}

                    <strong>
                      Warna
                    </strong>
                    {" "}
                    mengodekan total
                    panjang jalan
                    nasional di dalam
                    sel.
                  </p>

                  <p>
                    <strong>
                      Bentuk dan ukuran
                    </strong>
                    {" "}
                    hexagon dibuat
                    seragam sehingga
                    perbandingan warna
                    tidak bias oleh
                    perbedaan luas unit
                    administrasi.
                  </p>
                </>
              )
          }

        </article>


        <article
          className=
            "geo-method-card"
        >

          <div
            className=
              "geo-card-label"
          >
            KLASIFIKASI & PALET
          </div>

          <h3>
            Kuantil 5 kelas +
            palet sequential
          </h3>

          <p>
            Nilai positif dibagi
            menjadi lima kelas
            kuantil.

            {" "}

            Metode ini menjaga
            jumlah observasi per
            kelas relatif seimbang
            sehingga perbedaan spasial
            tetap terlihat saat
            distribusi data tidak
            merata.
          </p>

          <p>
            Palet
            <strong>
              {" "}
              sequential
            </strong>
            {" "}
            dipakai karena variabel
            bersifat kuantitatif dan
            berurutan.

            {" "}

            Semakin gelap warna,
            semakin tinggi nilainya.
          </p>

          {
            mapMode ===
            "choropleth" && (

            <p>
              Choropleth memakai
              <strong>
                {" "}
                rasio/kepadatan,
                bukan angka absolut
              </strong>:

              {" "}

              panjang jalan nasional
              ÷ luas wilayah × 100.
            </p>

          )
          }

        </article>

      </div>


      {/* SOURCE */}
<div className="source-block reveal-up">
  <span className="card-label">
    SUMBER DATA GEOSPASIAL
  </span>

  <strong>
    Catatan sumber spasial
  </strong>

  <p>
    Peta ini menggunakan geometri jaringan jalan dari{" "}
    {SOURCE_META.spatialProvider}.
  </p>

  <div className="source-links">
    <a
      href={SOURCE_META.spatialUrl}
      target="_blank"
      rel="noreferrer"
    >
      Lihat sumber SHP
    </a>
  </div>
</div>


      {/* BRIDGE */}

      <div
        className=
          "geo-next"
      >

        <span>
          DARI NASIONAL
          KE STUDI KASUS
        </span>


        <h3>
          Selanjutnya, fokus
          dipersempit ke
          Jawa Barat.
        </h3>


        <p>
          Setelah melihat pola
          mobilitas nasional dan
          konteks persebaran jaringan
          jalan, eksplorasi berikutnya
          melihat bagaimana kendaraan
          bermotor tersusun di
          kabupaten/kota Jawa Barat.
        </p>


        <div
          className=
            "transition-arrow"
          aria-hidden="true"
        >
          ↓
        </div>

      </div>

    </section>
  );
}


export default Geospatial;
