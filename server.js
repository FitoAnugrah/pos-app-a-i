const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================================
// 1. KONEKSI DATABASE (VERSI FINAL & CLOUD READY)
// =========================================
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString ? connectionString : undefined,
    ssl: connectionString ? { rejectUnauthorized: false } : false
});

// Tes Koneksi (Hanya log, tidak bikin crash)
pool.connect((err) => {
    if (err) {
        console.error('❌ Gagal konek Database:', err.message);
    } else {
        console.log('✅ BERHASIL KONEK KE DATABASE RAILWAY!');
    }
});

// ==================================================================
//                              API PRODUK
// ==================================================================

// A. SCAN BARANG (Cek barcode)
app.get('/api-scan', async(req, res) => {
    const { code } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM produk WHERE kode_barcode = $1', [code]
        );

        if (result.rows.length > 0) {
            // Cek apakah produk aktif?
            if (result.rows[0].is_active === false) {
                res.json({ status: 'not_found', message: 'Barang ini sudah dihapus (Arsip).' });
            } else {
                res.json({ status: 'success', data: result.rows[0] });
            }
        } else {
            res.json({ status: 'not_found', message: 'Barang tidak ditemukan' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. AMBIL SEMUA PRODUK
app.get('/api-produk', async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produk WHERE is_active = TRUE ORDER BY nama ASC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        console.error("ERROR DATABASE:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// C. TAMBAH / UPDATE PRODUK (GABUNGAN FINAL)
app.post('/api-tambah-produk', async(req, res) => {
    const { kode_barcode, nama, harga_modal, harga_jual, stok, expired, gambar } = req.body;

    try {
        // 1. Cek Barcode
        const cekBarcode = await pool.query('SELECT * FROM produk WHERE kode_barcode = $1', [kode_barcode]);

        if (cekBarcode.rows.length > 0) {
            const produkLama = cekBarcode.rows[0];

            // Jika produk ada tapi Soft Deleted -> Tawarkan Restore
            if (produkLama.is_active === false) {
                return res.json({
                    status: 'reactivate_needed',
                    message: 'Produk ini pernah dihapus. Aktifkan lagi?',
                    old_data: produkLama
                });
            } else {
                return res.json({ status: 'failed', message: 'Barcode ID ini sudah terdaftar!' });
            }
        }

        // 2. Simpan Baru
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

// D. UPDATE STOK
app.post('/api-update-stok', async(req, res) => {
    const { id, stok_baru } = req.body;
    try {
        await pool.query('UPDATE produk SET stok = $1 WHERE id = $2', [stok_baru, id]);
        res.json({ status: 'success', message: 'Stok Berhasil Diupdate!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// E. HAPUS PRODUK (SOFT DELETE)
app.delete('/api-hapus-produk/:id', async(req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE produk SET is_active = FALSE WHERE id = $1', [id]);
        res.json({ status: 'success', message: 'Produk berhasil dihapus dari stok!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// F. RESTORE PRODUK
app.post('/api-restore-produk', async(req, res) => {
    const { kode_barcode, nama, harga_modal, harga_jual, stok, expired, gambar } = req.body;
    try {
        await pool.query(
            `UPDATE produk SET 
                nama = $1, harga_modal = $2, harga_jual = $3, stok = $4, 
                tanggal_kadaluarsa = $5, gambar = $6, is_active = TRUE 
             WHERE kode_barcode = $7`, [nama, parseInt(harga_modal), parseInt(harga_jual), parseInt(stok), expired, gambar, kode_barcode]
        );
        res.json({ status: 'success', message: 'Produk Lama Berhasil Diaktifkan Kembali!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==================================================================
//                              API MEMBER
// ==================================================================

// A. CARI MEMBER (UNTUK CHECKOUT)
app.post('/api-cari-member', async(req, res) => {
    console.log("--- REQUEST MASUK KE API CARI MEMBER ---");
    const { keyword } = req.body;

    if (!keyword) {
        return res.status(400).json({ status: 'error', message: 'Keyword tidak boleh kosong' });
    }

    try {
        // Cari berdasarkan No Telp ATAU ID Member (jika perlu)
        const querySQL = 'SELECT * FROM member WHERE no_telp = $1';
        const result = await pool.query(querySQL, [keyword]);

        if (result.rows.length > 0) {
            res.json({ status: 'success', data: result.rows[0] });
        } else {
            res.json({ status: 'not_found', message: 'Member tidak ditemukan.' });
        }
    } catch (err) {
        console.error("❌ ERROR CARI MEMBER:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// B. AMBIL SEMUA MEMBER
app.get('/api-member', async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM member ORDER BY nama ASC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// C. TAMBAH MEMBER
app.post('/api-member', async(req, res) => {
    const { nama, hp, alamat } = req.body;
    try {
        const cekHP = await pool.query('SELECT * FROM member WHERE no_telp = $1', [hp]);
        if (cekHP.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Nomor HP sudah terdaftar!' });
        }
        const result = await pool.query(
            `INSERT INTO member (nama, no_telp, alamat, total_belanja) 
             VALUES ($1, $2, $3, 0) RETURNING *`, [nama, hp, alamat]
        );
        res.json({ status: 'success', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// D. UPDATE MEMBER
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

// E. HAPUS MEMBER
app.delete('/api-member/:id', async(req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE transaksi SET id_member = NULL WHERE id_member = $1', [id]);
        await pool.query('DELETE FROM member WHERE id = $1', [id]);
        res.json({ status: 'success', message: 'Member berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==================================================================
//                          API TRANSAKSI (INTI)
// ==================================================================
app.post('/api-transaksi', async(req, res) => {
    console.log("\n🔥 [START] REQUEST TRANSAKSI MASUK!");
    const { id_pengguna, id_member, total_harga, bayar, kembalian, metode_pembayaran, items } = req.body;

    console.log(`📦 Total: ${total_harga} | ID Member Mentah: ${id_member}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. CEK STOK
        for (const item of items) {
            const cekStok = await client.query('SELECT stok, nama FROM produk WHERE id = $1', [item.id]);
            if (cekStok.rows.length === 0) throw new Error(`Barang ID ${item.id} tidak ada!`);
            if (cekStok.rows[0].stok < item.qty) throw new Error(`Stok ${cekStok.rows[0].nama} kurang!`);
        }

        // 2. PERSIAPAN ID MEMBER
        let finalIdMember = null;
        if (id_member && id_member !== "null" && id_member !== "") {
            finalIdMember = parseInt(id_member);
        }
        console.log(`👤 Final ID Member untuk DB: ${finalIdMember}`);

        // 3. SIMPAN HEADER TRANSAKSI
        const resultHeader = await client.query(
            `INSERT INTO transaksi (no_faktur, id_member, id_pengguna, total_harga, bayar, kembalian, metode_pembayaran) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [`INV-${Date.now()}`, finalIdMember, id_pengguna, total_harga, bayar, kembalian, metode_pembayaran]
        );
        const idTransaksi = resultHeader.rows[0].id;

        // 4. SIMPAN DETAIL & KURANGI STOK
        for (const item of items) {
            await client.query(
                `INSERT INTO detail_transaksi (id_transaksi, id_produk, jumlah_beli, subtotal_harga) 
                 VALUES ($1, $2, $3, $4)`, [idTransaksi, item.id, item.qty, (item.price * item.qty)]
            );
            await client.query(`UPDATE produk SET stok = stok - $1 WHERE id = $2`, [item.qty, item.id]);
        }

        // 5. UPDATE TOTAL BELANJA MEMBER
        if (finalIdMember) {
            const updateQuery = `
                UPDATE member 
                SET total_belanja = COALESCE(total_belanja, 0) + $1 
                WHERE id = $2`;

            const hasilUpdate = await client.query(updateQuery, [parseInt(total_harga), finalIdMember]);

            if (hasilUpdate.rowCount > 0) {
                console.log(`✅ SUKSES UPDATE MEMBER ID ${finalIdMember}`);
            } else {
                console.log(`❌ GAGAL UPDATE MEMBER ID ${finalIdMember} (ID tidak ditemukan)`);
            }
        }

        await client.query('COMMIT');
        console.log("🔥 [END] TRANSAKSI SUKSES\n");
        res.json({ status: 'success', message: 'Berhasil', id_transaksi: idTransaksi });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ ERROR TRANSAKSI:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    } finally {
        client.release();
    }
});

// ==================================================================
//                      API AUTH & PENGGUNA (OTP)
// ==================================================================

// A. REGISTER (DENGAN OTP)
app.post('/api-register', async(req, res) => {
    const { nama, email, no_telp, password } = req.body;
    try {
        const cekEmail = await pool.query('SELECT * FROM pengguna WHERE email = $1', [email]);
        if (cekEmail.rows.length > 0) {
            return res.json({ status: 'failed', message: 'Email sudah terdaftar!' });
        }

        const randomOTP = Math.floor(1000 + Math.random() * 9000).toString();

        const result = await pool.query(
            `INSERT INTO pengguna (nama, email, no_telp, password, role, kode_otp, is_verified) 
             VALUES ($1, $2, $3, $4, 'kasir', $5, FALSE) RETURNING *`, [nama, email, no_telp, password, randomOTP]
        );

        console.log(`🔐 KODE OTP REGISTER (${nama}): ${randomOTP}`);

        res.json({
            status: 'success',
            message: 'Registrasi Berhasil! Cek Console untuk kode OTP.',
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// B. VERIFIKASI OTP
app.post('/api-verify-otp', async(req, res) => {
    const { no_telp, kode_input } = req.body;
    try {
        const cekUser = await pool.query(
            'SELECT * FROM pengguna WHERE no_telp = $1 AND kode_otp = $2', [no_telp, kode_input]
        );

        if (cekUser.rows.length > 0) {
            await pool.query(
                'UPDATE pengguna SET is_verified = TRUE, kode_otp = NULL WHERE no_telp = $1', [no_telp]
            );
            res.json({ status: 'success', message: 'Verifikasi Berhasil!' });
        } else {
            res.json({ status: 'failed', message: 'Kode OTP Salah!' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// C. LUPA PASSWORD (CHECK)
app.post('/api-forgot-check', async(req, res) => {
    const { no_telp } = req.body;
    try {
        const cekUser = await pool.query('SELECT * FROM pengguna WHERE no_telp = $1', [no_telp]);
        if (cekUser.rows.length > 0) {
            const newOTP = Math.floor(1000 + Math.random() * 9000).toString();
            await pool.query('UPDATE pengguna SET kode_otp = $1 WHERE no_telp = $2', [newOTP, no_telp]);

            console.log(`🔑 OTP RESET PASSWORD (${no_telp}): ${newOTP}`);
            res.json({ status: 'success', message: 'Kode OTP dikirim!' });
        } else {
            res.json({ status: 'failed', message: 'Nomor HP tidak terdaftar!' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// D. RESET PASSWORD
app.post('/api-reset-password', async(req, res) => {
    const { no_telp, new_password } = req.body;
    try {
        await pool.query(
            'UPDATE pengguna SET password = $1 WHERE no_telp = $2', [new_password, no_telp]
        );
        res.json({ status: 'success', message: 'Password Berhasil Diubah!' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==================================================================
//                          API LAPORAN
// ==================================================================

// A. LAPORAN DASHBOARD
app.post('/api-laporan', async(req, res) => {
    const { bulan } = req.body; // 'YYYY-MM'
    try {
        // 1. Hitung Tanggal
        const dateObj = new Date(bulan + "-01");
        dateObj.setMonth(dateObj.getMonth() - 1);
        const bulanLalu = dateObj.toISOString().slice(0, 7);

        // 2. Query Omset
        const queryIni = await pool.query(`
            SELECT COALESCE(SUM(total_harga), 0) as total FROM transaksi 
            WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1`, [bulan]);
        const queryLalu = await pool.query(`
            SELECT COALESCE(SUM(total_harga), 0) as total FROM transaksi 
            WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1`, [bulanLalu]);

        const omsetIni = parseInt(queryIni.rows[0].total);
        const omsetLalu = parseInt(queryLalu.rows[0].total);

        // 3. Persentase
        let persentase = 0;
        let naik = true;
        if (omsetLalu === 0) {
            persentase = omsetIni > 0 ? 100 : 0;
        } else {
            const selisih = omsetIni - omsetLalu;
            persentase = Math.round((selisih / omsetLalu) * 100);
        }
        if (persentase < 0) {
            naik = false;
            persentase = Math.abs(persentase);
        }

        // 4. Data Lain
        const queryOmsetLengkap = await pool.query(`
            SELECT COUNT(id) as total_transaksi FROM transaksi WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
        `, [bulan]);

        const queryUntung = await pool.query(`
            SELECT COALESCE(SUM((dt.subtotal_harga) - (p.harga_modal * dt.jumlah_beli)), 0) as total_profit
            FROM detail_transaksi dt JOIN transaksi t ON dt.id_transaksi = t.id JOIN produk p ON dt.id_produk = p.id
            WHERE TO_CHAR(t.tanggal, 'YYYY-MM') = $1
        `, [bulan]);

        const queryRiwayat = await pool.query(`
            SELECT TO_CHAR(tanggal, 'YYYY-MM-DD') as tanggal_harian, SUM(total_harga) as total_per_hari
            FROM transaksi WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1
            GROUP BY TO_CHAR(tanggal, 'YYYY-MM-DD') ORDER BY tanggal_harian DESC
        `, [bulan]);

        const queryGrafik = await pool.query(`
            SELECT TO_CHAR(tanggal, 'DD') as tanggal, SUM(total_harga) as total
            FROM transaksi WHERE TO_CHAR(tanggal, 'YYYY-MM') = $1 
            GROUP BY TO_CHAR(tanggal, 'DD') ORDER BY tanggal ASC
        `, [bulan]);

        res.json({
            status: 'success',
            data: {
                omset: omsetIni,
                transaksi: parseInt(queryOmsetLengkap.rows[0].total_transaksi),
                keuntungan: parseInt(queryUntung.rows[0].total_profit),
                riwayat: queryRiwayat.rows,
                grafik: queryGrafik.rows,
                persentase: persentase,
                is_naik: naik
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// B. PRODUK TERLARIS
app.post('/api-terlaris', async(req, res) => {
    const { bulan } = req.body;
    try {
        const query = await pool.query(`
            SELECT p.nama, p.brand, p.harga_jual, p.gambar, COALESCE(SUM(dt.jumlah_beli), 0) as total_terjual
            FROM detail_transaksi dt
            JOIN transaksi t ON dt.id_transaksi = t.id
            JOIN produk p ON dt.id_produk = p.id
            WHERE TO_CHAR(t.tanggal, 'YYYY-MM') = $1
            GROUP BY p.id, p.nama, p.brand, p.harga_jual, p.gambar
            ORDER BY total_terjual DESC
        `, [bulan]);

        res.json({ status: 'success', data: query.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ==================================================================
//                      START SERVER
// ==================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
});