// (Kode Toggle Password di bagian atas biarkan/copy ulang dari sebelumnya)
function setupToggle(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input && icon) {
        icon.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
        });
    }
}
setupToggle('newPassword', 'toggleNewPass');
setupToggle('confirmNewPass', 'toggleConfirmPass');

// --- LOGIKA SIMPAN ---
const btnSimpan = document.getElementById('btnSimpanPass');

btnSimpan.addEventListener('click', async function() {
    const pass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPass').value;
    const phone = localStorage.getItem('nomorDisimpan'); // Ambil nomor yg tadi di-OTP

    // Validasi
    if (pass.length < 6) {
        alert("Password minimal 6 karakter!");
        return;
    }
    if (pass !== confirm) {
        alert("Password tidak sama!");
        return;
    }

    try {
        // Kirim ke Backend
        const response = await fetch('http://localhost:3000/api-reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ no_telp: phone, new_password: pass })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert("✅ Password Berhasil Diubah! Silakan Login.");

            // Bersihkan data sampah
            localStorage.removeItem('nomorDisimpan');
            localStorage.removeItem('flowTujuan');

            window.location.href = "login.html";
        } else {
            alert("Gagal: " + result.message);
        }

    } catch (error) {
        console.error(error);
        alert("Gagal koneksi server.");
    }
});