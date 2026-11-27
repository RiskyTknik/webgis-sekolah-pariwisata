/* ===== 1. Peta dan basemap OpenStreetMap ===== */
const map = L.map("map").setView([3.5, 125.5], 8); // posisi awal; nanti diatur ulang oleh fitBounds

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

/* ===== 2. Konfigurasi warna kategori ===== */
const WARNA = {
    Sekolah: "#2563eb",
    Pariwisata: "#f97316"
};

function getMarkerColor(kategori) {
    return WARNA[kategori] || "#6b7280";
}

/* ===== 3. Helper atribut =====
   Mengambil nilai atribut dengan beberapa kemungkinan nama field
   (nama kolom hasil shapefile bisa terpotong jadi 10 karakter).
   Jika nama field di GeoJSON-mu berbeda, tambahkan di daftar ini. */
const FIELD = {
    nama: ["NAMA_OBJ"],
    kategori: ["KATEGORI"],
    subkat: ["SUB_KAT", "SUBKAT"],
    alamat: ["ALAMAT"],
    desa: ["DESA_KEL", "DESA", "KELURAHAN"],
    kecamatan: ["KECAMATAN", "KEC"],
    kabupaten: ["KABUPATEN", "KAB_KOTA", "KAB"]
};

function ambil(props, kunci) {
    for (const nama of FIELD[kunci]) {
        const v = props[nama];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            return String(v).trim();
        }
    }
    return "Tidak tersedia";
}

function aman(teks) {
    // mencegah karakter HTML merusak popup
    return String(teks)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* ===== 4. Popup ===== */
function buatPopup(props) {
    return `
        <h3>${aman(ambil(props, "nama"))}</h3>
        <p><b>Kategori:</b> ${aman(ambil(props, "kategori"))}</p>
        <p><b>Subkategori:</b> ${aman(ambil(props, "subkat"))}</p>
        <p><b>Alamat:</b> ${aman(ambil(props, "alamat"))}</p>
        <p><b>Desa/Kelurahan:</b> ${aman(ambil(props, "desa"))}</p>
        <p><b>Kecamatan:</b> ${aman(ambil(props, "kecamatan"))}</p>
        <p><b>Kabupaten:</b> ${aman(ambil(props, "kabupaten"))}</p>
    `;
}

/* ===== 5. Layer per kategori ===== */
let layerSekolah, layerWisata, layerControl;
let semuaFitur = [];

function buatLayer(data, kategori) {
    return L.geoJSON(data, {
        filter: f => ambil(f.properties, "kategori") === kategori,
        pointToLayer: (f, latlng) => L.circleMarker(latlng, {
            radius: 7,
            fillColor: getMarkerColor(kategori),
            color: "#ffffff",
            weight: 1.5,
            fillOpacity: 0.9
        }),
        onEachFeature: (f, layer) => layer.bindPopup(buatPopup(f.properties))
    });
}

/* ===== 6. Memuat GeoJSON ===== */
fetch("sekolah_pariwisata.geojson")
    .then(res => {
        if (!res.ok) throw new Error("Gagal memuat GeoJSON (cek nama file dan folder data/)");
        return res.json();
    })
    .then(data => {
        semuaFitur = data.features;

        layerSekolah = buatLayer(data, "Sekolah");
        layerWisata = buatLayer(data, "Pariwisata");
        layerSekolah.addTo(map);
        layerWisata.addTo(map);
        layerControl.addOverlay(layerSekolah, "Sekolah");
        layerControl.addOverlay(layerWisata, "Pariwisata");

        const semua = L.featureGroup([layerSekolah, layerWisata]);
        if (semua.getBounds().isValid()) {
            map.fitBounds(semua.getBounds(), { padding: [30, 30] });
        }

        hitungStatistik();
        aktifkanFilter();
        aktifkanPencarian();
    })
    .catch(err => {
        console.error(err);
        alert(err.message + "\nJalankan lewat Live Server atau GitHub Pages, bukan klik dua kali index.html.");
    });

/* ===== 7. Statistik ===== */
function hitungStatistik() {
    const hitung = k => semuaFitur.filter(f => ambil(f.properties, "kategori") === k).length;
    document.getElementById("countSekolah").textContent = hitung("Sekolah");
    document.getElementById("countWisata").textContent = hitung("Pariwisata");
    document.getElementById("countTotal").textContent = semuaFitur.length;
}

/* ===== 8. Layer control ===== */
function buatLayerControl() {
    layerControl = L.control.layers(
        { "OpenStreetMap": osm },
        {},
        { collapsed: false }
    ).addTo(map);
}
buatLayerControl();


/* ===== 9. Batas administrasi (opsional) =====
   Setiap file dimuat terpisah agar batas tetap tampil meski data objek gagal. */
let adaBatas = false;

function muatBatas(url, nama, warna, tebal) {
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            const layer = L.geoJSON(data, {
                style: { color: warna, weight: tebal, fill: false },
                interactive: false
            }).addTo(map);
            layer.bringToBack();
            layerControl.addOverlay(layer, nama);
            adaBatas = true;
            if (legendEl) legendEl.querySelector(".baris-batas").style.display = "block";
        })
        .catch(err => {
            console.error(`Gagal memuat ${nama} dari ${url}:`, err);
        });
}
muatBatas("batas_kabupaten.geojson", "Batas kabupaten/kota", "#5b6b70", 1.6);
muatBatas("batas_kecamatan.geojson", "Batas kecamatan", "#8fa0a5", 0.8);

/* ===== 10. Legenda ===== */
let legendEl;
const legend = L.control({ position: "bottomright" });
legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
        <h4>Legenda</h4>
        <div><span class="dot dot-sekolah"></span>Sekolah</div>
        <div><span class="dot dot-wisata"></span>Pariwisata</div>
        <div class="baris-batas" style="display:none"><span class="line"></span>Batas wilayah</div>
    `;
    legendEl = div;
    return div;
};
legend.addTo(map);

/* ===== 11. Filter kategori ===== */
function aktifkanFilter() {
    const tombol = document.querySelectorAll("#filter button");

    tombol.forEach(btn => {
        btn.addEventListener("click", () => {
            tombol.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const pilihan = btn.dataset.kategori;
            const tampilSekolah = pilihan === "Semua" || pilihan === "Sekolah";
            const tampilWisata = pilihan === "Semua" || pilihan === "Pariwisata";

            tampilSekolah ? layerSekolah.addTo(map) : map.removeLayer(layerSekolah);
            tampilWisata ? layerWisata.addTo(map) : map.removeLayer(layerWisata);
        });
    });
}

/* ===== 12. Pencarian nama objek ===== */
function aktifkanPencarian() {
    const input = document.getElementById("search");
    const daftar = document.getElementById("searchResult");

    input.addEventListener("input", () => {
        const kata = input.value.trim().toLowerCase();
        daftar.innerHTML = "";
        if (kata.length < 2) return;

        semuaFitur
            .filter(f => ambil(f.properties, "nama").toLowerCase().includes(kata))
            .slice(0, 15)
            .forEach(f => {
                const li = document.createElement("li");
                const kategori = ambil(f.properties, "kategori");
                li.innerHTML = `<span class="dot" style="background:${getMarkerColor(kategori)}"></span>${aman(ambil(f.properties, "nama"))}`;
                li.addEventListener("click", () => {
                    const [lng, lat] = f.geometry.coordinates;
                    map.setView([lat, lng], 16);
                    L.popup().setLatLng([lat, lng]).setContent(buatPopup(f.properties)).openOn(map);
                });
                daftar.appendChild(li);
            });
    });
}
