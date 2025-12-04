/*0. AMBIL NOMOR DARI HALAMAN SEBELUMNYA*/
const textNomor = document.getElementById('tampilNomor');
const nomorUser = localStorage.getItem('nomorDisimpan');

if (nomorUser) {
    let cleanNumber = nomorUser.startsWith('0') ? nomorUser.slice(1) : nomorUser;

    const awal = cleanNumber.substring(0, 3);

    const akhir = cleanNumber.substring(cleanNumber.length - 3);

    textNomor.innerText = `+62 ${awal}-xxxx-${akhir}`;
}

/*1. LOGIKA INPUT PINDAH OTOMATIS (OTP)*/
const inputs = document.querySelectorAll('.otp-box');

inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        const value = e.target.value;

        if (isNaN(value)) {
            e.target.value = "";
            return;
        }

        if (value && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === "Backspace") {
            if (!e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        }
    });
});


window.onload = () => {
    if (inputs[0]) inputs[0].focus();
    startCountdown();
};


/* 2. LOGIKA TIMER HITUNG MUNDUR*/
let timeLeft = 60;
const resendLink = document.getElementById('resendLink');
let timerId;

function startCountdown() {
    timeLeft = 60;

    resendLink.classList.remove('resend-active');
    resendLink.classList.add('resend-disabled');

    timerId = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerId);
            resendLink.innerHTML = "Kirim Ulang";


            resendLink.classList.remove('resend-disabled');
            resendLink.classList.add('resend-active');
        } else {
            resendLink.innerHTML = `Kirim Ulang (${timeLeft}s)`;
            timeLeft--;
        }
    }, 1000);
}


resendLink.addEventListener('click', function(e) {
    e.preventDefault();

    if (this.classList.contains('resend-active')) {
        alert("Kode OTP baru telah dikirim!");
        startCountdown();
    }
});

/* 3. LOGIKA TOMBOL VERIFIKASI (UPDATE)*/
const btnVerifikasi = document.querySelector('.btn-login');
btnVerifikasi.addEventListener('click', function() {

    let otpCode = "";
    inputs.forEach(input => otpCode += input.value);

    if (otpCode.length < 4) {
        alert("Masukkan 4 digit kode OTP!");
        return;
    }

    alert("Verifikasi Berhasil!");

    const flow = localStorage.getItem('flowTujuan');

    if (flow === 'reset') {
        window.location.href = "ResetPassword.html";
    } else {
        alert("Pendaftaran Selesai! Silakan Login.");
        window.location.href = "Login.html";
    }

    localStorage.removeItem('flowTujuan');
});