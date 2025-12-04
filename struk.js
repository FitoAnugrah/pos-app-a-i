const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

window.onload = function() {
    // 1. Ambil data transaksi terakhir dari localStorage
    const dataStruk = JSON.parse(localStorage.getItem('data_struk_terakhir'));

    if (!dataStruk) {
        alert("Tidak ada data struk!");
        window.location.href = "dashboard.html";
        return;
    }

    // 2. Isi Data Header
    document.getElementById('strukFaktur').innerText = dataStruk.no_faktur || "PENDING";
    document.getElementById('strukTanggal').innerText = new Date().toLocaleString();
    document.getElementById('strukKasir').innerText = dataStruk.kasir || "Admin";
    document.getElementById('strukMember').innerText = dataStruk.member || "Umum";

    // 3. Isi List Barang
    const container = document.getElementById('strukListBarang');
    container.innerHTML = "";

    dataStruk.items.forEach(item => {
        const subtotal = item.price * item.qty;
        const html = `
            <div class="item-row">
                <span class="item-name">${item.name}</span>
                <div class="item-math">
                    <span>${item.qty} x ${formatRupiah(item.price)}</span>
                    <span>${formatRupiah(subtotal)}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    // 4. Isi Total
    document.getElementById('strukTotal').innerText = formatRupiah(dataStruk.total);
    document.getElementById('labelMetode').innerText = "Bayar (" + dataStruk.metode + ")";
    document.getElementById('strukBayar').innerText = formatRupiah(dataStruk.bayar);
    document.getElementById('strukKembalian').innerText = formatRupiah(dataStruk.kembalian);
};

// Fungsi Tombol Selesai
function selesai() {
    // Hapus data struk agar memori bersih
    localStorage.removeItem('data_struk_terakhir');
    window.location.href = "dashboard.html";
}