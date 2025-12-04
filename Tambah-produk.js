/* =========================================
   VARIABEL GLOBAL
   ========================================= */
let html5QrcodeScanner = null;
let isScanning = false; // Penanda status kamera
let base64Image = ""; // Penampung data gambar

// Helper Format Rupiah
const formatRupiah = (num) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
}).format(num);


/* =========================================
   LOGIKA SCANNER (KHUSUS EAN-13 & UPC-A)
   ========================================= */

async function bukaScanner() {
    // 1. Tampilkan Modal
    document.getElementById('scanModal').style.display = 'flex';

    // 2. Bersihkan scanner lama
    if (html5QrcodeScanner) {
        try {
            await html5QrcodeScanner.stop();
            await html5QrcodeScanner.clear();
        } catch (err) {
            console.log("Membersihkan sisa scanner...");
        }
    }

    // 3. Inisialisasi
    html5QrcodeScanner = new Html5Qrcode("reader");

    const config = {
        fps: 20,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,

        formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A
        ]
    };

    try {
        await html5QrcodeScanner.start({ facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        );
        isScanning = true;
    } catch (err) {
        console.error("Gagal start kamera:", err);
        alert("Gagal membuka kamera. Pastikan izin diberikan.");
        tutupScanner();
    }
}

// --- FUNGSI SAAT BERHASIL SCAN ---
function onScanSuccess(decodedText, decodedResult) {
    // Validasi Panjang Angka:
    // EAN-13 punya 13 digit.
    // UPC-A punya 12 digit.
    // Jika bukan 12 atau 13, berarti salah baca -> ABAIKAN.
    if (decodedText.length !== 13 && decodedText.length !== 12) {
        console.warn("Terbaca tapi panjang salah: " + decodedText);
        return;
    }

    // Pastikan isinya Angka Saja (bukan huruf error)
    if (isNaN(decodedText)) {
        return;
    }

    console.log(`Scan Sukses: ${decodedText}`);

    // Masukkan ke Input
    document.getElementById('prodBarcode').value = decodedText;

    // Matikan Scanner
    tutupScanner();

    alert("Barcode Terbaca: " + decodedText);
}


function onScanFailure(error) {
    // Kosongkan agar console bersih
}

// Fungsi Tutup Scanner
async function tutupScanner() {
    if (html5QrcodeScanner && isScanning) {
        try {
            await html5QrcodeScanner.stop();
            await html5QrcodeScanner.clear();
            isScanning = false;
        } catch (err) {
            console.error("Gagal stop scanner", err);
        }
    }
    document.getElementById('scanModal').style.display = 'none';
}


/* =========================================
   2. LOGIKA FOTO PRODUK (PREVIEW)
   ========================================= */
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const iconCamera = document.getElementById('iconCamera');

if (fileInput) {
    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            // Validasi Ukuran (Max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert("Ukuran gambar terlalu besar! Maksimal 2MB.");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                base64Image = e.target.result;
                previewImage.src = base64Image;
                previewImage.style.display = "block";
                iconCamera.style.display = "none";
            }
            reader.readAsDataURL(file);
        }
    });
}


/* =========================================
   3. LOGIKA HITUNG LABA OTOMATIS
   ========================================= */
function hitungLaba() {
    const beli = parseInt(document.getElementById('prodBuy').value) || 0;
    const jual = parseInt(document.getElementById('prodSell').value) || 0;
    const laba = jual - beli;

    const elLaba = document.getElementById('textLaba');
    if (elLaba) {
        elLaba.innerText = formatRupiah(laba);
        if (laba < 0) elLaba.style.color = 'red';
        else elLaba.style.color = '#4CD964';
    }
}


/* =========================================
   4. LOGIKA SIMPAN KE DATABASE (FINAL)
   ========================================= */
async function simpanProduk() {
    // 1. Ambil Data
    const barcode = document.getElementById('prodBarcode').value.trim();
    const nama = document.getElementById('prodName').value.trim();
    const beli = document.getElementById('prodBuy').value;
    const jual = document.getElementById('prodSell').value;
    const stok = document.getElementById('prodStock').value;
    const expired = document.getElementById('prodExp').value;

    if (!barcode || !nama || !beli || !jual || !stok) {
        Swal.fire('Data Kurang', 'Mohon lengkapi semua kolom!', 'warning');
        return;
    }

    // 2. TANYA KONFIRMASI DULU
    const tanya = await Swal.fire({
        title: 'Simpan Produk?',
        text: "Pastikan data sudah benar.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Simpan',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#4CD964'
    });

    // Kalau user klik Batal, berhenti di sini
    if (!tanya.isConfirmed) return;

    // 3. PROSES SIMPAN (Tampilkan Loading)
    Swal.fire({
        title: 'Menyimpan...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() }
    });

    try {
        const payload = {
            kode_barcode: barcode,
            nama: nama,
            harga_modal: beli,
            harga_jual: jual,
            stok: stok,
            expired: expired || null,
            gambar: base64Image
        };

        const response = await fetch('http://localhost:3000/api-tambah-produk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // 4. CEK HASIL DARI SERVER
        if (result.status === 'success') {
            await Swal.fire('Berhasil!', 'Produk telah tersimpan.', 'success');

            // PINDAH HALAMAN SETELAH KLIK OK
            window.location.href = "info-stok.html";
        } else if (result.status === 'reactivate_needed') {
            // Logika Restore (Aktifkan Lagi)
            const confirmRestore = await Swal.fire({
                title: 'Produk Lama Ditemukan',
                text: 'Produk ini pernah dihapus. Gunakan data baru ini untuk mengaktifkannya lagi?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Ya, Aktifkan'
            });

            if (confirmRestore.isConfirmed) {
                await restoreProduk(payload); // Panggil fungsi restore
            }
        } else {
            Swal.fire('Gagal', result.message, 'error');
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Gagal koneksi ke server.', 'error');
    }
}

// Fungsi Restore (Jangan lupa sertakan ini juga)
async function restoreProduk(dataPayload) {
    try {
        const response = await fetch('http://localhost:3000/api-restore-produk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataPayload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            await Swal.fire('Berhasil', 'Produk diaktifkan kembali!', 'success');
            window.location.href = "Informasi/info-stok.html";
        } else {
            Swal.fire('Gagal', result.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal restore', 'error');
    }
}