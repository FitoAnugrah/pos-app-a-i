/* 1. FITUR SHOW / HIDE PASSWORD*/
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
setupToggle('regPassword', 'toggleRegPassword');
setupToggle('confirmPassword', 'toggleConfirmPassword');


/* 2. FITUR INPUT HP: HANYA ANGKA*/
const phoneInput = document.getElementById('regPhone');

phoneInput.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
});


/* ---------------------------------------------------
   3. FITUR VALIDASI & KIRIM KE SERVER (UPDATE)
--------------------------------------------------- */
const btnDaftar = document.getElementById('btnDaftar');

btnDaftar.addEventListener('click', async function() {
    // 1. Ambil Data Input
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const pass = document.getElementById('regPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    // 2. --- VALIDASI CLIENT SIDE (Supaya data bersih) ---

    // A. Cek Kosong
    if (!name || !email || !phone || !pass || !confirm) {
        alert("Harap lengkapi semua data diri Anda!");
        return;
    }

    // B. Cek Format Email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert("Format Email tidak valid!");
        return;
    }

    // C. Cek Kekuatan Password (Min 8 char, Besar & Kecil)
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    if (!strongPasswordPattern.test(pass)) {
        alert("Password Lemah!\n- Minimal 8 karakter\n- Harus ada Huruf Besar & Kecil");
        return;
    }

    // D. Cek Password Sama
    if (pass !== confirm) {
        alert("Password dan Ulangi Password tidak sama!");
        return;
    }

    // 3. --- KIRIM KE SERVER DATABASE ---

    // Ubah tombol jadi Loading
    const textAsli = btnDaftar.innerText;
    btnDaftar.innerText = "Mendaftarkan...";
    btnDaftar.disabled = true;

    try {
        const response = await fetch('http://localhost:3000/api-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama: name,
                email: email,
                no_telp: phone, // Sesuaikan dengan kolom no_telp di database
                password: pass
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert(result.message); // "Registrasi Berhasil!"

            // Pindah ke Halaman OTP (atau langsung Login, tergantung alurmu)
            // Sesuai request awalmu, kita ke OTP dulu:
            localStorage.setItem('nomorDisimpan', phone);
            window.location.href = "KodeOTP.html";
        } else {
            alert("Gagal: " + result.message); // Misal: Email sudah ada
        }

    } catch (error) {
        console.error(error);
        alert("Gagal terhubung ke Server.");
    } finally {
        // Balikin tombol
        btnDaftar.innerText = textAsli;
        btnDaftar.disabled = false;
    }
});