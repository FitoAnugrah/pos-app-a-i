const formatRupiah = (num) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
}).format(num);

// Variabel global
let allProducts = [];
let idProdukEdit = null;

// =========================================
// 1. LOAD DATA
// =========================================
async function loadStok() {
    const container = document.getElementById('productContainer');
    container.innerHTML = `
        <div style="text-align:center; margin-top:50px;">
            <i class="fas fa-spinner fa-spin" style="font-size:30px; color:#ddd;"></i>
            <p style="color:#666; font-size:12px; margin-top:10px;">Mengambil data stok...</p>
        </div>
    `;

    try {
        const response = await fetch('http://localhost:3000/api-produk');

        if (!response.ok) {
            throw new Error(`Gagal menghubungi server (Status: ${response.status})`);
        }

        const result = await response.json();

        if (result.status === 'success') {
            allProducts = result.data;
            renderList(allProducts);
        } else {
            container.innerHTML = `<p style="text-align:center; color:red;">Server Error: ${result.message}</p>`;
        }

    } catch (error) {
        console.error("Error Load Stok:", error);
        container.innerHTML = `
            <div style="text-align:center; padding:30px;">
                <p style="color:#333; font-weight:bold;">Gagal Memuat Data</p>
                <p style="font-size:11px; color:#666;">${error.message}</p>
                <button onclick="location.reload()" style="background:#00BFA5; color:white; border:none; padding:8px 20px; border-radius:20px; cursor:pointer; margin-top:10px;">Coba Lagi</button>
            </div>
        `;
    }
}

// =========================================
// 2. RENDER LIST
// =========================================
function renderList(data) {
    const container = document.getElementById('productContainer');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <i class="fas fa-box-open" style="font-size:40px; color:#ddd; margin-bottom:10px;"></i>
                <p style="color:#999;">Belum ada produk.</p>
            </div>
        `;
        return;
    }

    data.forEach(item => {
        let imgSource = 'https://placehold.co/60x60?text=No+Img';
        if (item.gambar && item.gambar.trim() !== "") {
            imgSource = item.gambar;
        }

        const harga = item.harga_jual ? parseInt(item.harga_jual) : 0;

        const html = `
            <div class="stock-card">
                <div class="stock-left">
                    <img src="${imgSource}" class="stock-img" onerror="this.src='https://placehold.co/60x60?text=Error'">
                    <div class="stock-info">
                        <h4>${item.nama || 'Tanpa Nama'}</h4>
                        <p>Harga : ${formatRupiah(harga)}</p>
                    </div>
                </div>
                <div class="stock-badge" onclick="bukaModalEdit('${item.id}', '${item.nama}', ${item.stok})">
                    Tersedia : ${item.stok}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// =========================================
// 3. FITUR SEARCH
// =========================================
function filterProduk() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase();
    const filtered = allProducts.filter(item => {
        const namaProduk = item.nama ? item.nama.toLowerCase() : "";
        return namaProduk.includes(keyword);
    });

    renderList(filtered);
}

// =========================================
// 4. MODAL EDIT & SIMPAN
// =========================================
function bukaModalEdit(id, nama, stokLama) {
    idProdukEdit = id;
    const elNama = document.getElementById('namaProdukEdit');
    const elInput = document.getElementById('inputStokBaru');

    if (elNama) elNama.innerText = nama;
    if (elInput) {
        elInput.value = stokLama;
        elInput.focus();
    }

    document.getElementById('editStockModal').style.display = 'flex';
}

function tutupModal() {
    document.getElementById('editStockModal').style.display = 'none';
}

async function simpanStokBaru() {
    const inputStok = document.getElementById('inputStokBaru');
    const stokBaru = inputStok.value;

    if (stokBaru === "") return alert("Stok tidak boleh kosong!");

    const btnSimpan = document.querySelector('.btn-simpan');
    const textAsli = btnSimpan ? btnSimpan.innerText : "Simpan";
    if (btnSimpan) btnSimpan.innerText = "...";

    try {
        const response = await fetch('http://localhost:3000/api-update-stok', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idProdukEdit, stok_baru: parseInt(stokBaru) })
        });

        const result = await response.json();

        if (result.status === 'success') {
            tutupModal();
            loadStok();
        } else {
            alert("Gagal: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert("Gagal koneksi server.");
    } finally {
        if (btnSimpan) btnSimpan.innerText = textAsli;
    }
}

// =========================================
// 5. HAPUS PRODUK
// =========================================
async function hapusProduk() {
    // 1. TAMPILKAN KONFIRMASI CANTIK
    Swal.fire({
        title: 'Yakin hapus produk?',
        text: "Produk akan hilang dari daftar stok!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // Merah
        cancelButtonColor: '#3085d6', // Biru
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async(result) => {
        // Cek apakah tombol "Ya" diklik?
        if (result.isConfirmed) {

            // 2. JALANKAN PROSES HAPUS (Copy logika fetch lama kesini)
            try {
                const response = await fetch(`http://localhost:3000/api-hapus-produk/${idProdukEdit}`, {
                    method: 'DELETE'
                });
                const resJson = await response.json();

                if (resJson.status === 'success') {
                    // Alert Sukses Kecil (Toast)
                    Swal.fire(
                        'Terhapus!',
                        'Produk berhasil dihapus.',
                        'success'
                    );
                    tutupModal();
                    loadStok();
                } else {
                    Swal.fire('Gagal', resJson.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'Gagal koneksi ke server', 'error');
            }
        }
    });
}

// Jalankan saat dibuka
window.onload = loadStok;