import Flow from "./components/Flow.jsx";
import ModaTransportasi from "./components/modatransportasi.jsx";
import Geospatial from "./components/Geospatial.jsx";
import Hierarchy from "./components/Hierarchy.jsx";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="hero-section">
        <div className="hero-glow" aria-hidden="true" />

        <div className="story-container hero-content">
          <p className="hero-kicker">WEBSTORY VISUALISASI DATA</p>
          <h1>
            Indonesia <span>Bergerak</span>
          </h1>
          <h2>Pola Mobilitas Antarwilayah</h2>
          <p className="hero-lead">
            Menelusuri arus perjalanan, dinamika moda, persebaran jaringan jalan,
            dan struktur kendaraan untuk melihat bagaimana mobilitas terkonsentrasi
            di berbagai wilayah Indonesia.
          </p>

          <a className="hero-button" href="#flow">
            Mulai eksplorasi
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </header>

      <main>
        <section className="story-section story-intro">
          <div className="section-heading reveal-up">
            <p className="eyebrow">ALUR CERITA</p>
            <h2>Dari Perjalanan Nasional ke Studi Kasus Jawa Barat</h2>
            <p>
              Cerita bergerak dari hubungan asal–tujuan, melewati dinamika moda dan
              konteks spasial jaringan jalan, lalu mempersempit fokus ke struktur
              kendaraan di Jawa Barat.
            </p>
          </div>

          <div className="story-step-grid reveal-up">
            <article className="story-step-card">
              <span>01</span>
              <h3>Flow</h3>
              <p>Siapa bergerak dari mana ke mana, dan pasangan wilayah mana yang paling dominan?</p>
            </article>

            <article className="story-step-card">
              <span>02</span>
              <h3>Geospasial</h3>
              <p>Bagaimana jaringan jalan nasional tersebar jika dibaca lewat wilayah administratif dan grid seragam?</p>
            </article>

            <article className="story-step-card">
              <span>03</span>
              <h3>Hierarchy</h3>
              <p>Bagaimana kendaraan bermotor tersusun dari tingkat Jawa Barat hingga jenis kendaraan?</p>
            </article>
          </div>
        </section>

        <Flow />
        <ModaTransportasi />
        <Geospatial />
        <Hierarchy />

        <section className="story-section story-closing">
          <div className="closing-card reveal-up">
            <h2>Mobilitas Indonesia Tidak Tersebar Secara Merata</h2>
            <p>
              Arus perjalanan membentuk pasangan wilayah yang dominan, dinamika moda
              berubah sepanjang waktu, dan jaringan jalan menunjukkan konsentrasi
              spasial yang berbeda antarwilayah. Jawa Barat kemudian menjadi studi
              kasus untuk melihat bagaimana struktur kendaraan bermotor tersusun di
              dalam satu provinsi dengan aktivitas mobilitas yang besar.
            </p>
            <p className="closing-note">
              Visualisasi ini bersifat deskriptif. Hubungan antara perjalanan,
              jaringan jalan, dan jumlah kendaraan tidak ditafsirkan sebagai hubungan
              sebab-akibat tanpa analisis tambahan.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
