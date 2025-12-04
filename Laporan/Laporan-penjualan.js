// Format Rupiah Helper
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// Format Tanggal (YYYY-MM-DD -> 1 Desember 2025)
const formatTanggal = (dateString) => {
    if (!dateString) return "-";
    const dateObj = new Date(dateString);
    if (isNaN(dateObj)) return dateString; // Kalau gagal format, kembalikan aslinya

    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return dateObj.toLocaleDateString('id-ID', options);
};

// Variabel Chart Global
let myChart = null;

// 1. GENERATE OPSI BULAN
function isiDropdownBulan() {
    const select = document.getElementById('filterWaktu');
    if (!select) return;

    const now = new Date();
    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    select.innerHTML = "";

    for (let tahun = now.getFullYear(); tahun >= now.getFullYear() - 1; tahun--) {
        for (let i = 11; i >= 0; i--) {
            if (tahun === now.getFullYear() && i > now.getMonth()) continue;

            const value = `${tahun}-${String(i + 1).padStart(2, '0')}`;
            const text = `${namaBulan[i]} ${tahun}`;

            const option = document.createElement('option');
            option.value = value;
            option.text = text;

            if (i === now.getMonth() && tahun === now.getFullYear()) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    }
}

// 2. LOAD DATA
async function loadLaporan() {
    const select = document.getElementById('filterWaktu');
    // Default ke bulan ini jika dropdown belum siap
    const now = new Date();
    const defaultBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const bulanTarget = select && select.value ? select.value : defaultBulan;

    console.log("Memuat Laporan Bulan:", bulanTarget);
    document.getElementById('textOmset').innerText = "...";

    try {
        const response = await fetch('http://localhost:3000/api-laporan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bulan: bulanTarget })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;

            // Update Kartu Utama
            document.getElementById('textOmset').innerText = formatRupiah(data.omset);
            document.getElementById('textTransaksi').innerText = data.transaksi;
            document.getElementById('textKeuntungan').innerText = formatRupiah(data.keuntungan);

            updateBadge(data);

            // --- UPDATE LIST RIWAYAT (BAGIAN YANG TADINYA ERROR) ---
            const listContainer = document.getElementById('listRiwayatContainer');
            listContainer.innerHTML = '';

            if (data.riwayat.length === 0) {
                listContainer.innerHTML = '<p style="text-align:center; font-size:12px; color:#999; margin-top:20px;">Tidak ada transaksi.</p>';
            } else {
                data.riwayat.forEach(item => {
                    // Gunakan nama kolom baru dari server
                    const tgl = item.tanggal_harian;
                    const hrg = item.total_per_hari; // Ini hasil penjumlahan tadi

                    const htmlItem = `
                        <div class="hist-item">
                            <span>${formatTanggal(tgl)}</span>
                            <span>${formatRupiah(hrg)}</span>
                        </div>
                    `;
                    listContainer.innerHTML += htmlItem;
                });
            }

            renderGrafik(data.grafik);

        } else {
            console.error("Gagal ambil data:", result.message);
        }

    } catch (error) {
        console.error("Error koneksi:", error);
    }
}

// Fungsi Update Badge
function updateBadge(data) {
    const elBadge = document.getElementById('badgeGrowth');
    const persen = data.persentase || 0;
    const naik = data.is_naik;
    const omset = data.omset;

    if (omset === 0 || persen === 0 || isNaN(persen)) {
        elBadge.innerHTML = `<i class="fas fa-minus" style="background:#e0e0e0; color:#666;"></i> <span style="color:#666;">0%</span> <span style="color:#999; font-weight:400; margin-left:5px; font-size:11px;">dari bulan lalu</span>`;
    } else if (naik) {
        elBadge.innerHTML = `<i class="fas fa-arrow-up" style="background:#e3f2fd; color:#2196F3;"></i> <span style="color:#2196F3;">+${persen}%</span> <span style="color:#999; font-weight:400; margin-left:5px; font-size:11px;">dari bulan lalu</span>`;
    } else {
        elBadge.innerHTML = `<i class="fas fa-arrow-down" style="background:#ffebee; color:#f44336;"></i> <span style="color:#f44336;">-${persen}%</span> <span style="color:#999; font-weight:400; margin-left:5px; font-size:11px;">dari bulan lalu</span>`;
    }
}

// Fungsi Gambar Grafik
function renderGrafik(dataGrafik) {
    if (typeof Chart === 'undefined') return;

    const ctx = document.getElementById('salesChart').getContext('2d');

    // Jika data grafik kosong
    if (!dataGrafik || dataGrafik.length === 0) {
        dataGrafik = [{ tanggal: '0', total: 0 }];
    }

    // Jika data cuma 1 titik, kita tambah titik bayangan biar garisnya kelihatan
    if (dataGrafik.length === 1) {
        // Copy titik pertama ke posisi kedua (biar jadi garis lurus)
        dataGrafik.push({ tanggal: dataGrafik[0].tanggal, total: dataGrafik[0].total });
    }

    const labels = dataGrafik.map(item => item.tanggal);
    const values = dataGrafik.map(item => item.total);

    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(50, 50, 50, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: values,
                borderColor: '#333',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#333'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { display: false, beginAtZero: true } // Mulai dari 0
            }
        }
    });
}

// Jalankan
window.onload = function() {
    isiDropdownBulan();
    setTimeout(loadLaporan, 100);
};