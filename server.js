const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg'); // CUKUP SATU KALI SAJA
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================
// 1. KONEKSI DATABASE (VERSI CLOUD READY)
// =========================================
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString ? connectionString : undefined,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.connect((err) => {
    if (err) {
        console.error('❌ Gagal konek Database:', err.message);
    } else {
        console.log('✅ Berhasil konek ke Database!');
    }
});
// Tes Koneksi saat server nyala
pool.connect((err) => {
    if (err) {
        console.error('❌ Gagal konek Database:', err.message);
    } else {
        console.log('✅ Berhasil konek ke Database!');
    }
});

// MENGECEK KONEKSI DATABASE
pool.connect((err) => {
    if (err) console.error('❌ Gagal konek Database:', err.message);
    else console.log('✅ Berhasil terhubung ke PostgreSQL!');
});

// ================== API ROUTES ==================

// 1. API LOGIN (UPDATE: CEK VERIFIKASI)
app.post('/api-login', async(req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM pengguna WHERE email = $1 AND password = $2', [email, password]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];

            //CEK APAKAH SUDAH VERIFIKASI OTP
            if (user.is_verified === false) {
                return res.json({
                    status: 'failed',
                    message: 'Akun belum diverifikasi! Silakan daftar ulang atau cek kode OTP.'
                });
            }

            // Jika Aman
            res.json({ status: 'success', data: user });
            //JIKA TIDAK AMAN/SALAH
        } else {
            res.json({ status: 'failed', message: 'Email atau Password Salah' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. API SCAN BARANG (Cek tabel produk)
app.get('/api-scan', async(req, res) => {
    const { code } = req.query; //MENGAMBIL KODE BARCODE
    try {
        //MENCARI BERDASARKAN ID BARCODE
        const result = await pool.query(
            'SELECT * FROM produk WHERE kode_barcode = $1', [code]
        );

        if (result.rows.length > 0) {
            res.json({ status: 'success', data: result.rows[0] });
        } else {
            res.json({ status: 'not_found', message: 'Barang tidak ditemukan' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 3. API TAMBAH MEMBER (BARU)
// ==========================================
app.post('/api-member', async(req, res) => {
    const { nama, hp, alamat } = req.body;

    try {
        //MENGECEK NO DI DATABASE
        const cekHP = await pool.query('SELECT * FROM member WHERE no_telp = $1', [hp]);
        if (cekHP.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Nomor HP sudah terdaftar!' });
        }

        //MEMASUKKAN DATA BARU MEMBER
        const result = await pool.query(
            `INSERT INTO member (nama, no_telp, alamat, total_belanja) 
             VALUES ($1, $2, $3, 0) RETURNING *`, [nama, hp, alamat]
        );

        res.json({ status: 'success', data: result.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api-transaksi', async(req, res) => {
    // 🔔 LOG PENANDA: Agar kita tahu tombol bayar sudah ditekan
    console.log("\n\n🔥 ========================================");
    console.log("🔥 [START] REQUEST TRANSAKSI MASUK!");
    console.log("🔥 ========================================");

    const { id_pengguna, id_member, total_harga, bayar, kembalian, metode_pembayaran, items } = req.body;

    // Cek apa yang dikirim Frontend
    console.log("📦 Data yang diterima:");
    console.log(`   - Total Harga: ${total_harga}`);
    console.log(`   - ID Member (Mentah): ${id_member} (Tipe: ${typeof id_member})`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. CEK STOK (Sama seperti sebelumnya)
        for (const item of items) {
            const cekStok = await client.query('SELECT stok, nama FROM produk WHERE id = $1', [item.id]);
            if (cekStok.rows.length === 0) throw new Error(`Barang ID ${item.id} tidak ada!`);
            if (cekStok.rows[0].stok < item.qty) throw new Error(`Stok ${cekStok.rows[0].nama} kurang!`);
        }

        // 2. SIMPAN TRANSAKSI
        // Pastikan id_member null jika kosong/undefined
        let finalIdMember = null;
        if (id_member && id_member !== "null" && id_member !== "") {
            finalIdMember = parseInt(id_member); // Paksa jadi angka
        }

        console.log(`   - ID Member (Final untuk DB): ${finalIdMember}`);

        const resultHeader = await client.query(
            `INSERT INTO transaksi (no_faktur, id_member, id_pengguna, total_harga, bayar, kembalian, metode_pembayaran) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [`INV-${Date.now()}`, finalIdMember, id_pengguna, total_harga, bayar, kembalian, metode_pembayaran]
        );
        const idTransaksi = resultHeader.rows[0].id;

        // 3. DETAIL TRANSAKSI & KURANGI STOK
        for (const item of items) {
            await client.query(
                `INSERT INTO detail_transaksi (id_transaksi, id_produk, jumlah_beli, subtotal_harga) 
                 VALUES ($1, $2, $3, $4)`, [idTransaksi, item.id, item.qty, (item.price * item.qty)]
            );
            await client.query(`UPDATE produk SET stok = stok - $1 WHERE id = $2`, [item.qty, item.id]);
        }

        // =========================================================
        // 4. UPDATE TOTAL BELANJA MEMBER (BAGIAN KRITIS)
        // =========================================================
        if (finalIdMember) {
            console.log(`⏳ Mencoba UPDATE member dengan ID: ${finalIdMember}...`);

            // Pastikan tabelmu namanya 'member' dan kolom kuncinya 'id'
            // Jika kolom kuncimu 'id_member', ganti 'WHERE id =' jadi 'WHERE id_member ='
            const updateQuery = `
                UPDATE member 
                SET total_belanja = COALESCE(total_belanja, 0) + $1 
                WHERE id = $2`;

            const hasilUpdate = await client.query(updateQuery, [parseInt(total_harga), finalIdMember]);

            if (hasilUpdate.rowCount > 0) {
                console.log(`✅ SUKSES! Member ID ${finalIdMember} berhasil diupdate.`);
                console.log(`   Total belanja ditambah: Rp ${total_harga}`);
            } else {
                console.log(`❌ GAGAL UPDATE! Tidak ada baris yang berubah.`);
                console.log(`   👉 Kemungkinan: Tidak ada member dengan id=${finalIdMember} di database.`);
            }
        } else {
            console.log("ℹ️ Transaksi ini tanpa member (Umum), skip update.");
        }

        await client.query('COMMIT');
        console.log("🔥 [END] TRANSAKSI SELESAI & TERSIMPAN\n");
        res.json({ status: 'success', message: 'Berhasil', id_transaksi: idTransaksi });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ ERROR TRANSAKSI:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    } finally {
        client.release();
    }
});
// ==========================================
// 5. API REGISTRASI / BUAT AKUN (BARU)
// ==========================================
app.post('/api-register', async(req, res) => {
    const { nama, email, no_telp, password } = req.body;

    try {
        // 1. MENGECEK EMAIL DI DATABASE
        const cekEmail = await pool.query('SELECT * FROM pengguna WHERE email = $1', [email]);

        if (cekEmail.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Email sudah terdaftar! Gunakan email lain.' });
        }

        // 2. Masukkan Data ke Tabel Pengguna
        // Role default kita set 'kasir'
        const result = await pool.query(
            `INSERT INTO pengguna (nama, email, no_telp, password, role) 
             VALUES ($1, $2, $3, $4, 'kasir') RETURNING *`, [nama, email, no_telp, password]
        );

        res.json({
            status: 'success',
            message: 'Registrasi Berhasil! Silakan Login.',
            data: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Jalankan Server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
});

// ==========================================
// 5. API REGISTRASI (UPDATE: GENERATE OTP)
// ==========================================
app.post('/api-register', async(req, res) => {
    const { nama, email, no_telp, password } = req.body;

    try {
        const cekEmail = await pool.query('SELECT * FROM pengguna WHERE email = $1', [email]);
        if (cekEmail.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Email sudah terdaftar!' });
        }

        // 1. GENERATE OTP ACAK (4 DIGIT)
        const randomOTP = Math.floor(1000 + Math.random() * 9000).toString();

        // 2. SIMPAN KE DATABASE (Beserta kode OTP-nya)
        const result = await pool.query(
            `INSERT INTO pengguna (nama, email, no_telp, password, role, kode_otp, is_verified) 
             VALUES ($1, $2, $3, $4, 'kasir', $5, FALSE) RETURNING *`, [nama, email, no_telp, password, randomOTP]
        );

        // 3. SIMULASI KIRIM OTP (TAMPILKAN DI TERMINAL)
        console.log("=================================");
        console.log(`🔐 KODE OTP UNTUK ${nama}: ${randomOTP}`);
        console.log("=================================");

        res.json({
            status: 'success',
            message: 'Registrasi Berhasil! Cek Console untuk kode OTP.',
            data: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 6. API VERIFIKASI OTP (BARU)
// ==========================================
app.post('/api-verify-otp', async(req, res) => {
    const { no_telp, kode_input } = req.body;

    try {
        //Mengecek Data User Jika Cocock
        const cekUser = await pool.query(
            'SELECT * FROM pengguna WHERE no_telp = $1 AND kode_otp = $2', [no_telp, kode_input]
        );

        if (cekUser.rows.length > 0) {
            // JIKA COCOK: Ubah status jadi terverifikasi & Hapus OTP biar ga dipake lagi
            await pool.query(
                'UPDATE pengguna SET is_verified = TRUE, kode_otp = NULL WHERE no_telp = $1', [no_telp]
            );

            res.json({ status: 'success', message: 'Verifikasi Berhasil!' });
        } else {
            // JIKA TIDAK COCOK
            res.json({ status: 'failed', message: 'Kode OTP Salah!' });
        }

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 7. API LUPA PASSWORD (CEK NOMOR & KIRIM OTP)
// ==========================================
app.post('/api-forgot-check', async(req, res) => {
    const { no_telp } = req.body;

    try {
        const cekUser = await pool.query('SELECT * FROM pengguna WHERE no_telp = $1', [no_telp]);

        if (cekUser.rows.length > 0) {
            // User Ditemukan! Buat OTP Baru
            const newOTP = Math.floor(1000 + Math.random() * 9000).toString();

            // Update OTP di database
            await pool.query('UPDATE pengguna SET kode_otp = $1 WHERE no_telp = $2', [newOTP, no_telp]);

            console.log("=================================");
            console.log(`🔑 OTP RESET PASSWORD (${no_telp}): ${newOTP}`);
            console.log("=================================");

            res.json({ status: 'success', message: 'Kode OTP dikirim!' });
        } else {
            res.json({ status: 'failed', message: 'Nomor HP tidak terdaftar!' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 8. API SIMPAN PASSWORD BARU
// ==========================================
app.post('/api-reset-password', async(req, res) => {
    const { no_telp, new_password } = req.body;

    try {
        // Langsung update password berdasarkan No HP
        // (Asumsinya user sudah lolos verifikasi OTP di frontend sebelumnya)
        await pool.query(
            'UPDATE pengguna SET password = $1 WHERE no_telp = $2', [new_password, no_telp]
        );

        res.json({ status: 'success', message: 'Password Berhasil Diubah!' });

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 9. API LAPORAN PENJUALAN (UPGRADE RATING)
// ==========================================
app.post('/api-laporan', async(req, res) => {
    const { bulan } = req.body; // Format: '2025-11'

    try {
        // 1. HITUNG BULAN LALU
        // Kita ubah string '2025-11' jadi tanggal, kurangi 1 bulan, lalu format balik.
        const dateObj = new Date(bulan + "-01");
        dateObj.setMonth(dateObj.getMonth() - 1);
        const bulanLalu = dateObj.toISOString().slice(0, 7); // Hasil: '2025-10'

        // 2. QUERY OMSET BULAN INI
        const queryIni = await pool.query(`
            SELECT COALESCE(SUM(total_harga), 0) as total FROM transaksi 
            WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
        `, [bulan]);

        // 3. QUERY OMSET BULAN LALU (Untuk perbandingan)
        const queryLalu = await pool.query(`
            SELECT COALESCE(SUM(total_harga), 0) as total FROM transaksi 
            WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
        `, [bulanLalu]);

        const omsetIni = parseInt(queryIni.rows[0].total);
        const omsetLalu = parseInt(queryLalu.rows[0].total);

        // 4. HITUNG PERSENTASE KENAIKAN/PENURUNAN
        let persentase = 0;
        let naik = true; // Default naik

        if (omsetLalu === 0) {
            // Jika bulan lalu 0, dan bulan ini ada omset, berarti naik 100%
            persentase = omsetIni > 0 ? 100 : 0;
        } else {
            // Rumus Pertumbuhan: ((Baru - Lama) / Lama) * 100
            const selisih = omsetIni - omsetLalu;
            persentase = Math.round((selisih / omsetLalu) * 100);
        }

        if (persentase < 0) {
            naik = false; // Berarti turun
            persentase = Math.abs(persentase); // Hilangkan tanda minus
        }

        // 5. QUERY LAINNYA (Sama seperti sebelumnya)
        // ... (Transaksi, Keuntungan, Grafik, Riwayat tetap sama kodenya) ...
        // Agar tidak kepanjangan, saya tulis ulang bagian pentingnya saja di bawah:

        const queryOmsetLengkap = await pool.query(`
            SELECT COUNT(id) as total_transaksi FROM transaksi WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
        `, [bulan]);

        const queryUntung = await pool.query(`
            SELECT COALESCE(SUM((dt.subtotal_harga) - (p.harga_modal * dt.jumlah_beli)), 0) as total_profit
            FROM detail_transaksi dt JOIN transaksi t ON dt.id_transaksi = t.id JOIN produk p ON dt.id_produk = p.id
            WHERE TO_CHAR(t.tanggal, 'YYYY-MM') = $1
        `, [bulan]);

        // ... (Query Omset & Untung biarkan saja) ...

        // C. AMBIL RIWAYAT HARIAN (TOTAL PER HARI)
        const queryRiwayat = await pool.query(`
            SELECT 
                TO_CHAR(tanggal, 'YYYY-MM-DD') as tanggal_harian,  -- Ambil Tanggal saja (buang jam)
                SUM(total_harga) as total_per_hari               -- Jumlahkan total uangnya
            FROM transaksi 
            WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
            GROUP BY TO_CHAR(tanggal, 'YYYY-MM-DD')              -- Gabungkan berdasarkan tanggal
            ORDER BY tanggal_harian DESC                         -- Urutkan dari tanggal terbaru
        `, [bulan]);


        const queryGrafik = await pool.query(`
            SELECT TO_CHAR(tanggal, 'DD') as tanggal, SUM(total_harga) as total
            FROM transaksi WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1 GROUP BY TO_CHAR(tanggal, 'DD') ORDER BY tanggal ASC
        `, [bulan]);

        res.json({
            status: 'success',
            data: {
                omset: omsetIni,
                transaksi: parseInt(queryOmsetLengkap.rows[0].total_transaksi),
                keuntungan: parseInt(queryUntung.rows[0].total_profit),
                riwayat: queryRiwayat.rows,
                grafik: queryGrafik.rows,
                // Data Baru:
                persentase: persentase,
                is_naik: naik
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 7. API PRODUK TERLARIS (FILTER BULAN AKTIF)
// ==========================================
app.post('/api-terlaris', async(req, res) => {
    const { bulan } = req.body; // Ambil data bulan dari Frontend

    try {
        const query = await pool.query(`
            SELECT 
                p.nama, 
                p.brand, 
                p.harga_jual,
                p.gambar,
                COALESCE(SUM(dt.jumlah_beli), 0) as total_terjual
            FROM detail_transaksi dt
            JOIN transaksi t ON dt.id_transaksi = t.id
            JOIN produk p ON dt.id_produk = p.id
            WHERE TO_CHAR(t.tanggal, 'YYYY-MM') = $1  -- <--- INI KUNCINYA
            GROUP BY p.id, p.nama, p.brand, p.harga_jual, p.gambar
            ORDER BY total_terjual DESC
        `, [bulan]); // <--- Masukkan parameter bulan ke sini

        res.json({ status: 'success', data: query.rows });

    } catch (err) {
        console.error("ERROR TERLARIS:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ==========================================
// 10. API TAMBAH PRODUK (YANG BENAR & FINAL)
// ==========================================
app.post('/api-tambah-produk', async(req, res) => {
    const { kode_barcode, nama, harga_modal, harga_jual, stok, expired, gambar } = req.body;

    try {
        // 1. Cek Barcode di Database
        const cekBarcode = await pool.query('SELECT * FROM produk WHERE kode_barcode = $1', [kode_barcode]);

        if (cekBarcode.rows.length > 0) {
            const produkLama = cekBarcode.rows[0];

            // A. Jika produk ada & aktif -> Error
            if (produkLama.is_active === true) {
                return res.json({ status: 'failed', message: 'Barcode ID ini sudah terdaftar!' });
            }
            // B. Jika produk ada tapi di tong sampah -> Restore
            else {
                return res.json({
                    status: 'reactivate_needed',
                    message: 'Produk ini pernah dihapus. Aktifkan lagi?',
                    old_data: produkLama
                });
            }
        }

        // 2. Simpan Baru (Pastikan urutan $1 s/d $7 cocok dengan array di bawahnya)
        await pool.query(
            `INSERT INTO produk (kode_barcode, nama, harga_modal, harga_jual, stok, tanggal_kadaluarsa, gambar, is_active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`, [kode_barcode, nama, parseInt(harga_modal), parseInt(harga_jual), parseInt(stok), expired, gambar]
        );

        res.json({ status: 'success', message: 'Produk Berhasil Disimpan!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ==========================================
// 10. API TAMBAH PRODUK (UPDATE GAMBAR)
// ==========================================
app.post('/api-tambah-produk', async(req, res) => {
    // Tambah 'gambar' di sini
    const { kode_barcode, nama, harga_modal, harga_jual, stok, expired, gambar } = req.body;

    try {
        const cekBarcode = await pool.query('SELECT * FROM produk WHERE kode_barcode = $1', [kode_barcode]);
        if (cekBarcode.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Barcode ID ini sudah terdaftar!' });
        }

        // Simpan ke Database (Kolom gambar ditambah)
        await pool.query(
            `INSERT INTO produk (kode_barcode, nama, harga_modal, harga_jual, stok, tanggal_kadaluarsa, gambar) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`, [kode_barcode, nama, parseInt(harga_modal), parseInt(harga_jual), parseInt(stok), expired, gambar]
        );

        res.json({ status: 'success', message: 'Produk Berhasil Disimpan!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 11. API STOK BARANG
// ==========================================

// A. Ambil Semua Produk
app.get('/api-produk', async(req, res) => {
    try {
        // Query ini cocok dengan tabel yang baru kita buat di Langkah 2
        const result = await pool.query('SELECT * FROM produk WHERE is_active = TRUE ORDER BY nama ASC');

        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        // Ini agar errornya muncul jelas di terminal
        console.error("ERROR DATABASE:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// B. Update Stok Produk
app.post('/api-update-stok', async(req, res) => {
    const { id, stok_baru } = req.body;

    try {
        await pool.query('UPDATE produk SET stok = $1 WHERE id = $2', [stok_baru, id]);
        res.json({ status: 'success', message: 'Stok Berhasil Diupdate!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==========================================
// 12. API HAPUS PRODUK (SOFT DELETE)
// ==========================================
app.delete('/api-hapus-produk/:id', async(req, res) => {
    const { id } = req.params;

    try {
        // Ubah is_active jadi FALSE (Sembunyikan)
        await pool.query('UPDATE produk SET is_active = FALSE WHERE id = $1', [id]);

        res.json({ status: 'success', message: 'Produk berhasil dihapus dari stok!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// 13. API RESTORE / AKTIFKAN KEMBALI PRODUK
app.post('/api-restore-produk', async(req, res) => {
    // Kita update data lama dengan inputan baru user (Harga/Stok baru)
    const { kode_barcode, nama, harga_modal, harga_jual, stok, expired, gambar } = req.body;

    try {
        await pool.query(
            `UPDATE produk SET 
                nama = $1, 
                harga_modal = $2, 
                harga_jual = $3, 
                stok = $4, 
                tanggal_kadaluarsa = $5, 
                gambar = $6,
                is_active = TRUE  -- KUNCI UTAMA: Hidupkan lagi
             WHERE kode_barcode = $7`, [nama, parseInt(harga_modal), parseInt(harga_jual), parseInt(stok), expired, gambar, kode_barcode]
        );

        res.json({ status: 'success', message: 'Produk Lama Berhasil Diaktifkan Kembali!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ==========================================
// 13. API MANAJEMEN MEMBER
// ==========================================

// A. Ambil Semua Member
app.get('/api-member', async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM member ORDER BY nama ASC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// B. Update Member
app.put('/api-member', async(req, res) => {
    const { id, nama, hp, alamat } = req.body;
    try {
        await pool.query(
            'UPDATE member SET nama=$1, no_telp=$2, alamat=$3 WHERE id=$4', [nama, hp, alamat, id]
        );
        res.json({ status: 'success', message: 'Data member diperbarui!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// C. Hapus Member
app.delete('/api-member/:id', async(req, res) => {
    const { id } = req.params;
    try {
        // Hapus transaksinya dulu (Opsional: atau set NULL)
        // Disini kita set NULL di tabel transaksi agar riwayat uang tidak hilang, tapi membernya hilang
        await pool.query('UPDATE transaksi SET id_member = NULL WHERE id_member = $1', [id]);

        // Hapus Member
        await pool.query('DELETE FROM member WHERE id = $1', [id]);
        res.json({ status: 'success', message: 'Member berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ==========================================
// 14. API CARI MEMBER BY HP (UNTUK CHECKOUT)
// ==========================================
app.post('/api-cari-member', async(req, res) => {
    console.log("--- REQUEST MASUK KE API CARI MEMBER ---"); // Cek apakah request masuk
    console.log("Body yang diterima:", req.body); // Cek data yang dikirim frontend

    const { keyword } = req.body;

    // VALIDASI INPUT
    if (!keyword) {
        console.error("❌ Error: Keyword kosong!");
        return res.status(400).json({ status: 'error', message: 'Keyword tidak boleh kosong' });
    }

    try {
        // --- COBA QUERY SEDERHANA DULU (Cuma cari No. Telp) ---
        // Kita hapus dulu "OR id_member" untuk memastikan kolom itu bukan penyebab errornya.

        const querySQL = 'SELECT * FROM member WHERE no_telp = $1';

        console.log("Menjalankan Query:", querySQL);
        console.log("Parameter:", [keyword]);

        const result = await pool.query(querySQL, [keyword]);

        console.log("✅ Query Berhasil! Jumlah Data:", result.rows.length);

        if (result.rows.length > 0) {
            res.json({ status: 'success', data: result.rows[0] });
        } else {
            res.json({ status: 'not_found', message: 'Member tidak ditemukan.' });
        }

    } catch (err) {
        // INI BAGIAN PENTING:
        // Error lengkap akan muncul di Terminal VS Code Anda (bukan di browser)
        console.error("❌❌ ERROR FATAL DI DATABASE ❌❌");
        console.error(err.message);
        console.error("-----------------------------------");

        res.status(500).json({ status: 'error', message: err.message });
    }
});