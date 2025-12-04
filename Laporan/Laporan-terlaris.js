const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

// ==========================================
// 1. GENERATE OPSI BULAN
// ==========================================
function isiDropdownBulan() {
    const select = document.getElementById('filterBulan');

    // PENGAMAN: Jika HTML belum siap/salah ID
    if (!select) {
        console.error("❌ ERROR: Elemen dropdown dengan id='filterBulan' TIDAK DITEMUKAN di HTML!");
        return;
    }

    const now = new Date();
    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    select.innerHTML = ""; // Bersihkan isi lama

    // Loop 2 Tahun ke belakang
    for (let tahun = now.getFullYear(); tahun >= now.getFullYear() - 1; tahun--) {
        for (let i = 11; i >= 0; i--) {
            if (tahun === now.getFullYear() && i > now.getMonth()) continue;

            const value = `${tahun}-${String(i + 1).padStart(2, '0')}`; // "2025-11"
            const text = `${namaBulan[i]} ${tahun}`; // "November 2025"

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

// ==========================================
// 2. LOAD DATA
// ==========================================
async function loadTerlaris() {
    const listContainer = document.getElementById('listContainer');
    const select = document.getElementById('filterBulan');

    // Default bulan ini jika dropdown belum terisi/error
    const now = new Date();
    const defaultBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const bulanTarget = select && select.value ? select.value : defaultBulan;

    console.log("Memuat Data Bulan:", bulanTarget);
    listContainer.innerHTML = '<p style="text-align:center; font-size:12px; color:#666; margin-top:50px;">Sedang mengambil data...</p>';

    try {
        const response = await fetch('http://localhost:3000/api-terlaris', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bulan: bulanTarget })
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;
            listContainer.innerHTML = '';

            if (data.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align:center; margin-top:30px;">
                        <i class="fas fa-clipboard-list" style="font-size:40px; color:#ddd;"></i>
                        <p style="color:#666; font-size:12px; margin-top:10px;">Belum ada barang terjual bulan ini.</p>
                        <p style="color:#999; font-size:10px;">Coba pilih bulan lain di dropdown.</p>
                    </div>`;
                return;
            }

            data.forEach(item => {
                const namaProduk = item.nama || 'Tanpa Nama';
                const brand = item.brand || 'Umum';
                const harga = item.harga_jual || 0;
                const terjual = item.total_terjual || 0;

                // Logika Gambar
                let gambarHTML = '';
                if (item.gambar && item.gambar.length > 100) {
                    gambarHTML = `<img src="${item.gambar}" alt="${namaProduk}">`;
                } else {
                    gambarHTML = `<i class="fas fa-box-open" style="font-size:24px; color:#ccc;"></i>`;
                }

                const html = `
                    <div class="prod-item">
                        <div class="prod-img-box">
                            ${gambarHTML}
                        </div>
                        <div class="prod-info">
                            <span class="p-brand">${brand}</span>
                            <span class="p-name">${namaProduk}</span>
                            <span class="p-desc">Terjual Total</span>
                            <span class="p-qty" style="color:#00BFA5; font-weight:bold;">${terjual} pcs</span>
                        </div>
                        <div class="prod-price">
                            ${formatRupiah(harga)}
                        </div>
                    </div>
                `;
                listContainer.innerHTML += html;
            });

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error(error);
        listContainer.innerHTML = `<p style="text-align:center; color:red; margin-top:30px;">Gagal: ${error.message}</p>`;
    }
}

// 3. JALANKAN URUTAN
window.onload = function() {
    isiDropdownBulan(); // Isi dropdown dulu

    // Beri jeda sedikit biar dropdown 'settle' baru ambil data
    setTimeout(() => {
        loadTerlaris();
    }, 100);
};