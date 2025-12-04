const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

let allMembers = [];
let idMemberEdit = null;

// 1. Load Data Member
async function loadMembers() {
    const container = document.getElementById('memberContainer');
    container.innerHTML = '<p style="text-align:center; color:#666; margin-top:20px;">Memuat data...</p>';

    try {
        const response = await fetch('http://localhost:3000/api-member');
        const result = await response.json();

        if (result.status === 'success') {
            allMembers = result.data;
            renderList(allMembers);
        } else {
            container.innerHTML = '<p style="text-align:center; color:red;">Gagal memuat data.</p>';
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color:red;">Server tidak merespon.</p>';
    }
}

// 2. Render List
function renderList(data) {
    const container = document.getElementById('memberContainer');
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:30px;">Belum ada member.</p>';
        return;
    }

    data.forEach(m => {
        // Format Tanggal: "2023-01-20" -> "Jan 2023"
        let tglJoin = "-"; // Default strip

        // Cek apakah ada datanya?
        if (m.tanggal_gabung) {
            const dateObj = new Date(m.tanggal_gabung);

            // Cek apakah tanggal valid?
            if (!isNaN(dateObj)) {
                const options = { month: 'short', year: 'numeric' }; // Jan 2023
                tglJoin = dateObj.toLocaleDateString('id-ID', options);
            }
        }

        const html = `
            <div class="member-card" onclick="bukaDetail(${JSON.stringify(m).replace(/"/g, '&quot;')})">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-info">
                    <h4>${m.nama}</h4>
                    <p>Member Sejak ${tglJoin}</p> </div>
                <div class="member-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// 3. Search
function filterMember() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allMembers.filter(m => m.nama.toLowerCase().includes(keyword));
    renderList(filtered);
}

// 4. Modal Detail & Edit
function bukaDetail(member) {
    idMemberEdit = member.id;
    document.getElementById('detId').innerText = "ID: " + member.id;
    document.getElementById('detNama').value = member.nama;
    document.getElementById('detHp').value = member.no_telp;
    document.getElementById('detAlamat').value = member.alamat || '';
    document.getElementById('detTotal').innerText = formatRupiah(member.total_belanja || 0);

    document.getElementById('detailMemberModal').style.display = 'flex';
}

function tutupDetail() {
    document.getElementById('detailMemberModal').style.display = 'none';
}

// 5. Update Member
async function updateMember() {
    const nama = document.getElementById('detNama').value;
    const hp = document.getElementById('detHp').value;
    const alamat = document.getElementById('detAlamat').value;

    try {
        const response = await fetch('http://localhost:3000/api-member', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idMemberEdit, nama, hp, alamat })
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert("✅ Data Member Diupdate!");
            tutupDetail();
            loadMembers();
        }
    } catch (error) {
        alert("Gagal update.");
    }
}

// 6. Hapus Member
async function hapusMember() {
    if (!confirm("Yakin ingin menghapus member ini? Riwayat belanja akan diputus.")) return;

    try {
        const response = await fetch(`http://localhost:3000/api-member/${idMemberEdit}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert("🗑️ Member Dihapus.");
            tutupDetail();
            loadMembers();
        }
    } catch (error) {
        alert("Gagal hapus.");
    }
}

window.onload = loadMembers;