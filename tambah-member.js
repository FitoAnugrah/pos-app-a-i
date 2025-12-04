const btnSimpan = document.getElementById('btnSimpanMember');

btnSimpan.addEventListener('click', async function() {
    // 1. Ambil Input
    const name = document.getElementById('memName').value.trim();
    const phone = document.getElementById('memPhone').value.trim();
    const address = document.getElementById('memAddress').value.trim();

    if (!name || !phone) {
        alert("Nama dan No. Handphone wajib diisi!");
        return;
    }

    // Efek Loading
    const textAsli = btnSimpan.innerText;
    btnSimpan.innerText = "Menyimpan...";
    btnSimpan.disabled = true;

    try {
        // 2. KIRIM KE SERVER
        const response = await fetch('http://localhost:3000/api-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama: name, hp: phone, alamat: address })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert("✅ Member Berhasil Disimpan di Database!");

            const memberBaru = result.data; // Data asli dari database (ada ID nya)

            // --- LOGIKA PINTAR (Redirect) ---
            const urlParams = new URLSearchParams(window.location.search);
            const asalHalaman = urlParams.get('from');

            if (asalHalaman === 'checkout') {
                // Simpan member terpilih ke localStorage agar Checkout tahu
                localStorage.setItem('selected_member', JSON.stringify(memberBaru));
                window.location.href = "Checkout.html";
            } else {
                window.location.href = "../Informasi/info-member.html";
            }

        } else {
            alert("Gagal: " + result.message);
        }

    } catch (error) {
        console.error(error);
        alert("Gagal koneksi ke server.");
    } finally {
        btnSimpan.innerText = textAsli;
        btnSimpan.disabled = false;
    }
});