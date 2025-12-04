/* =========================================
   LOGIKA CHECKOUT (FULL FEATURE)
   ========================================= */

// 1. VARIABEL GLOBAL (PENTING)
let globalTotal = 0;
let metodePilihan = 'Tunai'; // Default awal

// Fungsi Format Rupiah
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// =========================================
// 2. MENAMPILKAN KERANJANG BELANJA
// =========================================
function renderCart() {
    const container = document.getElementById('cartList');
    const totalDisplay = document.getElementById('totalDisplay');

    // Ambil data dari localStorage
    let keranjang = JSON.parse(localStorage.getItem('cart_pos')) || [];
    // --- TAMBAHAN BARU: CEK MEMBER TERPILIH ---
    const memberTerpilih = JSON.parse(localStorage.getItem('selected_member'));

    if (memberTerpilih) {
        const textID = document.getElementById('textID');
        if (textID) {
            textID.innerText = memberTerpilih.nama; // Tampilkan Nama
            textID.style.color = "#4CD964";
            textID.style.fontWeight = "bold";
        }
    }

    // Jika Keranjang Kosong
    if (keranjang.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color:#999;">
                <i class="fas fa-shopping-basket" style="font-size: 40px; margin-bottom:10px;"></i>
                <p>Keranjang Kosong</p>
                <a href="scan.html" style="color: #4CD964; font-size:12px; font-weight:bold;">Scan Barang Dulu</a>
            </div>
        `;
        totalDisplay.innerText = "Rp 0";
        globalTotal = 0;
        return;
    }

    // Tampilkan Barang
    let totalBayar = 0;
    container.innerHTML = "";

    keranjang.forEach((item, index) => {
        const subtotal = item.price * item.qty;
        totalBayar += subtotal;

        let gambarHTML = '';

        // Cek apakah ada data gambar dan tidak kosong
        if (item.gambar && item.gambar.length > 100) {
            // Tampilkan Foto
            gambarHTML = `<img src="${item.gambar}" alt="${item.name}" class="img-checkout-fix">`;
        } else {
            // Tampilkan Icon Kardus (Default)
            gambarHTML = `<i class="fas fa-box"></i>`;
        }

        const itemHTML = `
           <div class="cart-item">
                <div class="item-img">
                    ${gambarHTML} </div>
                <div class="item-details">
                    <span class="item-brand">${item.brand || 'Umum'}</span>
                    <span class="item-name">${item.name}</span>
                    <span class="item-desc">${item.desc || '-'}</span>
                    <span class="item-qty">Qty: ${item.qty}</span>
                </div>
                <div style="text-align:right;">
                    <div class="item-price">${formatRupiah(subtotal)}</div>
                    <div style="font-size:10px; color:red; margin-top:5px; cursor:pointer;" onclick="hapusItem(${index})">
                        <i class="fas fa-trash"></i> Hapus
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += itemHTML;
    });

    // Update Global Total & Tampilan
    globalTotal = totalBayar;
    totalDisplay.innerText = formatRupiah(totalBayar);
}

// =========================================
// 3. LOGIKA HAPUS BARANG
// =========================================
function hapusItem(index) {
    let keranjang = JSON.parse(localStorage.getItem('cart_pos')) || [];
    keranjang.splice(index, 1);
    localStorage.setItem('cart_pos', JSON.stringify(keranjang));
    renderCart();
}

// =========================================
// 4. LOGIKA MODAL (POPUP) PEMBAYARAN - YANG KAMU CARI
// =========================================

// Buka Modal saat klik "Tambahkan Metode"
function bukaModalBayar() {
    document.getElementById('paymentModal').style.display = 'flex';
}

// Tutup Modal
function tutupModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

// Saat user klik salah satu kotak metode (Tunai/Dana/dll)
function pilihMetode(element, metode) {
    metodePilihan = metode;

    // Reset tampilan kotak jadi biasa
    document.querySelectorAll('.pay-card').forEach(el => el.classList.remove('selected'));

    // Tandai kotak yang diklik jadi hijau
    element.classList.add('selected');

    // Atur Input Uang (Hanya muncul jika 'Tunai')
    const inputArea = document.getElementById('inputTunaiArea');
    if (metode === 'Tunai') {
        inputArea.style.display = 'block';
        // Reset inputan
        document.getElementById('inputBayar').value = '';
        document.getElementById('textKembalian').innerText = 'Rp 0';
    } else {
        inputArea.style.display = 'none'; // Sembunyikan kalau E-Wallet
    }
}

// 1. Ganti fungsi hitungKembalian dengan yang ini:
function hitungKembalian() {
    const input = document.getElementById('inputBayar');

    // A. Ambil teks asli dan buang semua karakter selain angka
    // Contoh: "100.abc" jadi "100"
    let rawValue = input.value.replace(/[^0-9]/g, '');

    // B. Format ulang dengan titik (Ribuan)
    // Contoh: "100000" jadi "100.000"
    if (rawValue) {
        input.value = rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    } else {
        input.value = "";
    }

    // C. Konversi ke Angka Murni untuk Matematika
    const uangMasuk = parseInt(rawValue) || 0;
    const kembalian = uangMasuk - globalTotal;

    // D. Tampilkan Info Kembalian
    const elKembalian = document.getElementById('textKembalian');

    if (kembalian >= 0) {
        elKembalian.innerText = formatRupiah(kembalian);
        elKembalian.style.color = "#4CD964"; // Hijau
    } else {
        elKembalian.innerText = "Kurang " + formatRupiah(Math.abs(kembalian));
        elKembalian.style.color = "red"; // Merah
    }
}

// Saat klik tombol OK di Modal
function konfirmasiBayar() {
    // 1. Bersihkan titik dari input (Contoh: "100.000" jadi "100000")
    const rawValue = document.getElementById('inputBayar').value.replace(/\./g, '');
    let uangMasuk = parseInt(rawValue) || 0;

    // 2. Logic jika bukan Tunai (E-Wallet), maka Uang Masuk = Total Tagihan
    if (metodePilihan !== 'Tunai') {
        uangMasuk = globalTotal;
    }

    // 3. Validasi Kurang Bayar (Khusus Tunai)
    // Cek Pembayaran Tunai
    if (metodePilihan === 'Tunai' && uangMasuk < globalTotal) {

        // Hitung selisih kekurangannya (Biar kasir langsung tau kurang berapa)
        let kekurangan = globalTotal - uangMasuk;

        Swal.fire({
            icon: 'error', // Ikon silang merah
            title: 'Uang Kurang!',
            // Tampilkan nominal kurangnya dengan format Rupiah yang rapi
            html: `Uang yang dimasukkan kurang sebesar:<br><h2 style="color:red; margin-top:10px;">Rp ${kekurangan.toLocaleString('id-ID')}</h2>`,
            confirmButtonText: 'Oke, Cek Lagi',
            confirmButtonColor: '#d33' // Tombol warna merah
        });

        return; // Stop proses disini
    }

    // 4. Hitung Kembalian
    const kembalian = uangMasuk - globalTotal;

    // 5. UPDATE TAMPILAN DI HALAMAN UTAMA (INI YANG BARU)
    const elDetails = document.getElementById('paymentDetails');
    const elBayar = document.getElementById('displayBayar');
    const elKembalian = document.getElementById('displayKembalian');

    // Isi angkanya
    elBayar.innerText = formatRupiah(uangMasuk);
    elKembalian.innerText = formatRupiah(kembalian);

    // Munculkan kotaknya
    elDetails.style.display = 'block';

    // 6. Update Label Metode di atas
    const textMetode = document.getElementById('textMetode');
    textMetode.innerText = metodePilihan;
    textMetode.style.color = "#333";
    textMetode.style.fontWeight = "bold";

    // 7. Simpan Data
    localStorage.setItem('payment_info', JSON.stringify({
        metode: metodePilihan,
        bayar: uangMasuk,
        kembalian: kembalian
    }));

    tutupModal();
}

// =========================================
// 5. NAVIGASI DATA (ID & METODE)
// =========================================
function isiData(jenis) {
    if (jenis === 'Metode Pembayaran') {
        bukaModalBayar();
    } else if (jenis === 'ID Pelanggan') {
        // Buka Modal ID Pelanggan
        document.getElementById('idModal').style.display = 'flex';
        document.getElementById('inputManualID').focus(); // Langsung fokus kursor
    }
}

// 2. Fungsi Tutup Modal ID
function tutupModalID() {
    document.getElementById('idModal').style.display = 'none';
}

// 3. Fungsi Simpan ID Manual
async function simpanIDManual() {
    // 1. Ambil Inputan DALAM POPUP
    const inputDalam = document.getElementById('inputManualID');

    // 2. Ambil Inputan LUAR POPUP (Target yang mau diisi otomatis)
    const inputLuar = document.getElementById('inputMemberLuar');

    // 3. Ambil Label Nama (Untuk display)
    const textID = document.getElementById('number');
    const btnSimpan = document.querySelector('#idModal .btn-confirm');

    if (!inputDalam) return;
    const inputVal = inputDalam.value.trim();
    if (!inputVal) return;

    // Loading...
    let textAsli = "Simpan";
    if (btnSimpan) {
        textAsli = btnSimpan.innerText;
        btnSimpan.innerText = "Mencari...";
        btnSimpan.disabled = true;
    }

    try {
        const response = await fetch('http://localhost:3000/api-cari-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: inputVal })
        });

        const result = await response.json();

        if (result.status === 'success') {
            const member = result.data;

            // ✅ INI KUNCINYA: ISI INPUTAN LUAR SECARA OTOMATIS
            if (inputLuar) {
                inputLuar.value = member.no_telp; // Atau member.id_member (sesuai database)
            }

            // Tampilkan Nama
            if (textID) {
                textID.innerText = member.nama;
                textID.style.color = "#4CD964";
            }

            localStorage.setItem('selected_member', JSON.stringify(member));

            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `Member: ${member.nama} dipilih.`,
                timer: 1000,
                showConfirmButton: false
            });

        } else {
            // JIKA MEMBER TIDAK DITEMUKAN (TAMU)

            // Tetap isi inputan luar dengan angka yang diketik manual
            if (inputLuar) {
                inputLuar.value = inputVal;
            }

            if (textID) {
                textID.innerText = "Tamu Umum (" + inputVal + ")";
                textID.style.color = "#333";
            }

            localStorage.removeItem('selected_member');
        }

        // Tutup Modal Otomatis
        if (typeof tutupModalID === 'function') {
            tutupModalID();
        }

    } catch (error) {
        console.error("Error:", error);
        Swal.fire('Error', 'Gagal koneksi server', 'error');
    } finally {
        if (btnSimpan) {
            btnSimpan.innerText = textAsli;
            btnSimpan.disabled = false;
        }
    }
}

// =========================================
// 6. SELESAIKAN TRANSAKSI (FINAL - VERSI FIX ID MEMBER)
// =========================================
async function selesaikanTransaksi() {
    let keranjang = JSON.parse(localStorage.getItem('cart_pos')) || [];
    let paymentInfo = JSON.parse(localStorage.getItem('payment_info'));
    let memberInfo = JSON.parse(localStorage.getItem('selected_member'));
    let userInfo = JSON.parse(localStorage.getItem('user_pos'));

    // --- 🚨 SATPAM 1: CEK KERANJANG ---
    if (keranjang.length === 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'Keranjang Kosong',
            text: 'Silahkan masukkan barang terlebih dahulu.',
            timer: 1500,
            showConfirmButton: false
        });
    }

    // --- 🚨 SATPAM 2: CEK METODE PEMBAYARAN (WAJIB) ---
    if (!paymentInfo || !paymentInfo.metode || paymentInfo.metode === "Pilih Metode") {
        return Swal.fire({
            icon: 'warning',
            title: 'Metode Pembayaran Belum Dipilih!',
            text: 'Harap pilih Tunai atau QRIS sebelum menyelesaikan transaksi.',
        });
    }

    // --- 🚨 SATPAM 3: CEK MEMBER (WAJIB) ---
    if (!memberInfo) {
        return Swal.fire({
            icon: 'warning',
            title: 'ID Member/Tamu Kosong!',
            text: 'Harap masukkan ID Member atau Nama Tamu di Popup.',
        });
    }

    // =======================================================
    // 🔧 PERBAIKAN UTAMA DISINI (FIX LOGIC ID)
    // =======================================================
    // Kita cari ID yang benar. Coba 'id_member', kalau gak ada coba 'id'.
    // Ini menangani beda nama kolom di database.
    let finalIdMember = null;
    if (memberInfo) {
        finalIdMember = memberInfo.id_member || memberInfo.id;
    }

    // DEBUGGING: Cek di Console Browser apa yang akan dikirim
    console.log("--- DATA YANG AKAN DIKIRIM KE SERVER ---");
    console.log("Member Info Asli:", memberInfo);
    console.log("ID Member Final:", finalIdMember);
    // Jika 'finalIdMember' masih null/undefined di console, berarti database Anda tidak mengirim kolom 'id' atau 'id_member'.

    // Loading Effect
    const btn = document.querySelector('.btn-blue-soft');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;
    }

    // Siapkan Data
    const transaksiData = {
        id_pengguna: userInfo ? userInfo.id : 1,
        id: finalIdMember, // Gunakan ID yang sudah dipastikan aman tadi
        total_harga: globalTotal,
        bayar: paymentInfo.bayar,
        kembalian: paymentInfo.kembalian,
        metode_pembayaran: paymentInfo.metode,
        items: keranjang
    };

    try {
        // --- KIRIM KE SERVER DATABASE ---
        const response = await fetch('http://localhost:3000/api-transaksi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaksiData)
        });

        const result = await response.json();

        if (result.status === 'success') {

            // 1. SIAPKAN DATA STRUK
            const strukData = {
                no_faktur: "INV-" + (result.id_transaksi || Date.now()),
                kasir: userInfo ? userInfo.nama : "Kasir",
                member: memberInfo ? memberInfo.nama : "Umum",
                items: keranjang,
                total: globalTotal,
                bayar: paymentInfo.bayar,
                kembalian: paymentInfo.kembalian,
                metode: paymentInfo.metode
            };

            localStorage.setItem('data_struk_terakhir', JSON.stringify(strukData));

            // 2. TAMPILKAN POPUP SUKSES
            Swal.fire({
                title: 'Transaksi Berhasil!',
                html: `Kembalian: <b style="font-size: 24px; color: #4CD964;">Rp ${parseInt(paymentInfo.kembalian).toLocaleString('id-ID')}</b>`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-print"></i> Cetak Struk',
                cancelButtonText: 'Selesai (Ke Dashboard)',
                confirmButtonColor: '#2196F3',
                cancelButtonColor: '#757575',
                reverseButtons: true,
                allowOutsideClick: false
            }).then((result) => {

                // 3. BERSIHKAN DATA
                localStorage.removeItem('cart_pos');
                localStorage.removeItem('payment_info');
                localStorage.removeItem('selected_member');

                // 4. REDIRECT
                if (result.isConfirmed) {
                    window.location.href = "../struk.html";
                } else {
                    window.location.href = "../Homepage/Homepage.html";
                }
            });

        } else {
            throw new Error(result.message || "Gagal menyimpan ke database");
        }
    } catch (error) {
        console.error("Error Checkout:", error);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: error.message
        });

        if (btn) {
            btn.innerHTML = 'Selesaikan Transaksi';
            btn.disabled = false;
        }
    }
}

// Jalankan saat halaman dibuka
window.onload = renderCart;