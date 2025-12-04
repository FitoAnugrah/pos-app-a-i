const togglePassword = document.querySelector('#togglePassword');
const password = document.querySelector('#idPassword');

togglePassword.addEventListener('click', function(e) {
    const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
    password.setAttribute('type', type);
    this.classList.toggle('fa-eye-slash');
});
document.querySelector('.btn-login').addEventListener('click', async function() {
    // Ambil nilai dari input
    // Pastikan selector ini sesuai dengan HTML kamu (input pertama & kedua)
    const inputs = document.querySelectorAll('.input-field');
    const email = inputs[0].value;
    const password = inputs[1].value;

    try {
        // Tembak ke Server Backend
        const response = await fetch('http://localhost:3000/api-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert(`Login Berhasil! Halo, ${result.data.nama}`);

            // Simpan data user di memori browser
            localStorage.setItem('user_pos', JSON.stringify(result.data));

            // Pindah ke Dashboard
            window.location.href = "../Homepage/Homepage.html";
        } else {
            alert(result.message); // Munculkan pesan error dari server
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal terhubung ke Server Backend (Pastikan terminal masih jalan!)");
    }
});