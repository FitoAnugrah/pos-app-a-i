/* =========================================
   SETUP TOAST & AUDIO
   ========================================= */
const beepSound = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');

const Toast = Swal.mixin({
    toast: true,
    position: 'top',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

/* =========================================
   1. SETUP KAMERA
   ========================================= */
const video = document.getElementById('videoFeed');
const placeholder = document.getElementById('camPlaceholder');

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            placeholder.style.display = 'none';
            video.style.display = 'block';
        };
    } catch (err) {
        console.error("Gagal akses kamera:", err);
    }
}
window.addEventListener('load', startCamera);


/* =========================================
   2. LOGIKA SCAN & TAMBAH KERANJANG
   ========================================= */

const inputID = document.querySelector('.scan-input[placeholder="Contoh: 102938"]');
const inputQty = document.querySelector('.scan-input[placeholder="0"]');
const btnTambah = document.querySelector('.btn-green-dark');

btnTambah.addEventListener('click', async function() {
    const idDicari = inputID.value.trim();
    const jumlah = parseInt(inputQty.value) || 1;

    if (!idDicari) {
        // Ganti Alert Biasa -> SweetAlert Error
        Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Masukkan ID Barang dulu!' });
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api-scan?code=${idDicari}`);
        const result = await response.json();

        if (result.status === 'success') {
            const barang = result.data;

            // --- MAINKAN SUARA BEEP ---
            beepSound.play().catch(e => console.log("Audio error"));

            let keranjang = JSON.parse(localStorage.getItem('cart_pos')) || [];
            const indexAda = keranjang.findIndex(item => item.id === barang.id || item.id === barang.id_barang);

            if (indexAda !== -1) {
                keranjang[indexAda].qty += jumlah;
            } else {
                keranjang.push({
                    id: barang.id || barang.id_barang,
                    name: barang.nama,
                    brand: barang.brand || 'Umum',
                    price: parseInt(barang.harga_jual),
                    desc: barang.deskripsi || '-',
                    gambar: barang.gambar,
                    qty: jumlah
                });
            }

            localStorage.setItem('cart_pos', JSON.stringify(keranjang));

            // --- GANTI ALERT DENGAN TOAST ---
            Toast.fire({
                icon: 'success',
                title: 'Masuk Keranjang',
                text: `${barang.nama} (+${jumlah})`
            });

            // Reset
            inputID.value = '';
            inputQty.value = '1';
            inputID.focus();

        } else {
            // Barang Tidak Ketemu
            Swal.fire({
                icon: 'error',
                title: 'Tidak Ditemukan',
                text: 'Barang tidak ada di database',
                confirmButtonColor: '#d33'
            });
        }

    } catch (error) {
        console.error("Error:", error);
        Swal.fire('Error', 'Gagal koneksi ke server', 'error');
    }
});