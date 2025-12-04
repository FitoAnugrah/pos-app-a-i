const phoneInput = document.getElementById('forgotPhone');
const btnKirim = document.getElementById('btnKirimKode');

// 1. Paksa Angka
phoneInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, '');
});

// 2. Kirim ke Server
btnKirim.addEventListener('click', async function() {
    const phone = phoneInput.value.trim();

    if (phone.length < 10) {
        alert("Nomor Handphone tidak valid!");
        return;
    }

    const textAsli = btnKirim.innerText;
    btnKirim.innerText = "Mengecek...";

    try {
        const response = await fetch('http://localhost:3000/api-forgot-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ no_telp: phone })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert("Kode OTP Terkirim! Cek Console Server.");

            // Simpan info sementara
            localStorage.setItem('nomorDisimpan', phone);
            localStorage.setItem('flowTujuan', 'reset'); // Tanda mau reset password

            window.location.href = "otp.html";
        } else {
            alert(result.message); // "Nomor tidak terdaftar"
        }

    } catch (error) {
        alert("Gagal koneksi server.");
    } finally {
        btnKirim.innerText = textAsli;
    }
});