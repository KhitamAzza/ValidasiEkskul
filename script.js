
// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzoz8-2qB1KkGn0iOvGxAX4qnJL9ou7QAJ3i-ZFG5riQbaqgkv3jwNuE7y_pWDEOTfb/exec';

// ═══════════════════════════════════════
// DATA STORAGE
// ═══════════════════════════════════════
let studentsData = [];
let photosData = [];
let scanner = null;
let isScanning = true;
let modalStack = [];

// ═══════════════════════════════════════
// API: ALL requests go through POST with action in body
// ═══════════════════════════════════════
async function api(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload })
  });
  return res.json();
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initScanner();
  loadData();
  setupEventListeners();
});

// ═══════════════════════════════════════
// QR SCANNER
// ═══════════════════════════════════════
function initScanner() {
  scanner = new Html5Qrcode('reader');
  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
  };
  scanner.start(
    { facingMode: 'environment' },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    toast('Gagal mengakses kamera: ' + err.message);
    console.error('Scanner init error:', err);
  });
}

function onScanSuccess(decodedText) {
  if (!isScanning) return;
  isScanning = false;
  const studentId = decodedText.trim();
  const student = findStudent(studentId);
  if (student) {
    showStudentModal(student);
    toast('Siswa ditemukan: ' + student.nama);
  } else {
    toast('Siswa tidak ditemukan: ' + studentId);
  }
  setTimeout(() => { isScanning = true; }, 2000);
}

function onScanFailure(error) {
  // Ignore scan failures
}

// ═══════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════
async function loadData() {
  const btn = document.getElementById('btnRefresh');
  btn.classList.add('spin');
  btn.disabled = true;
  toast('Memuat data...');

  try {
    const [studentsR, photosR] = await Promise.all([
      api('getStudentData'),
      api('getAllPhotos')
    ]);

    if (studentsR.success) {
      studentsData = studentsR.students || [];
    } else {
      throw new Error(studentsR.error || 'Failed to load students');
    }

    if (photosR.success) {
      photosData = photosR.photos || [];
    } else {
      throw new Error(photosR.error || 'Failed to load photos');
    }

    toast(`Data dimuat: ${studentsData.length} siswa`);
  } catch (err) {
    toast('Gagal memuat data: ' + err.message);
    console.error('Load data error:', err);
  } finally {
    btn.classList.remove('spin');
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════
// STUDENT LOOKUP
// ═══════════════════════════════════════
function findStudent(id) {
  const student = studentsData.find(s => s.idSiswa === id);
  if (!student) return null;
  const foto = photosData.find(f => f.idSiswa === id);
  return {
    ...student,
    fotoUrl: foto ? buildPhotoUrl(foto.fotoId) : null,
    fotoId: foto ? foto.fotoId : null,
  };
}

function buildPhotoUrl(fotoId) {
  if (!fotoId) return null;
  if (fotoId.startsWith('http')) return fotoId;
  return `https://lh3.googleusercontent.com/d/${fotoId}=s400`;
}

// ═══════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════
function showStudentModal(student) {
  const modal = document.getElementById('modalInfo');
  const content = document.getElementById('modalInfoContent');

  document.getElementById('infoPhoto').src = student.fotoUrl || '';
  document.getElementById('infoName').textContent = student.nama;
  document.getElementById('infoClass').textContent = student.kelas;
  document.getElementById('infoId').textContent = student.idSiswa;
  document.getElementById('infoEkstra').textContent = student.ekstra;
  document.getElementById('infoDenda').textContent = formatRupiah(student.denda);
  document.getElementById('infoDendaBayar').textContent = formatRupiah(student.dendaDibayar);
  document.getElementById('infoSisa').textContent = formatRupiah(student.sisaDenda);
  document.getElementById('infoSyarat').textContent = student.syaratKhusus === 'TRUE' ? 'Ya' : 'Tidak';

  const statusEl = document.getElementById('infoStatus');
  statusEl.textContent = student.status === 'AMAN' ? '✓ AMAN' : '⚠ BELUM TUNTAS';
  statusEl.className = 'status-badge ' + (student.status === 'AMAN' ? 'status-aman' : 'status-belum');

  content.dataset.studentId = student.idSiswa;
  openModal(modal);
}

function showDetailModal(studentId) {
  const student = findStudent(studentId);
  if (!student) return;

  const modal = document.getElementById('modalDetail');

  document.getElementById('detailPhoto').src = student.fotoUrl || '';
  document.getElementById('detailName').textContent = student.nama;
  document.getElementById('detailClass').textContent = student.kelas;

  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = student.status === 'AMAN' ? '✓ AMAN' : '⚠ BELUM TUNTAS';
  statusEl.className = 'status-badge ' + (student.status === 'AMAN' ? 'status-aman' : 'status-belum');

  const list = document.getElementById('assessmentList');
  list.innerHTML = generateAssessmentList(student);

  openModal(modal);
}

function generateAssessmentList(student) {
  const items = [];

  const sisaDenda = parseFloat(student.sisaDenda) || 0;
  items.push({
    label: 'Sisa Denda Lunas',
    done: sisaDenda === 0,
    detail: sisaDenda === 0 ? 'Rp 0' : `Rp ${sisaDenda.toLocaleString('id-ID')}`
  });

  const syarat = student.syaratKhusus === 'TRUE';
  items.push({
    label: 'Syarat Khusus Terpenuhi',
    done: syarat,
    detail: syarat ? 'Ya' : 'Tidak'
  });

  items.push({
    label: 'Status Kelulusan',
    done: student.status === 'AMAN',
    detail: student.status === 'AMAN' ? 'Lulus' : 'Belum Tuntas'
  });

  return items.map(item => `
    <li class="assessment-item">
      <span class="check-icon ${item.done ? 'check-done' : 'check-pending'}">
        ${item.done ? '✓' : '!'}
      </span>
      <div>
        <div>${item.label}</div>
        <div style="font-size: 13px; color: #888; margin-top: 2px;">${item.detail}</div>
      </div>
    </li>
  `).join('');
}

function openModal(modal) {
  modal.classList.add('active');
  modalStack.push(modal);
}

function closeTopModal() {
  if (modalStack.length === 0) return;
  const modal = modalStack.pop();
  modal.classList.remove('active');
}

function closeAllModals() {
  while (modalStack.length > 0) {
    const modal = modalStack.pop();
    modal.classList.remove('active');
  }
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════
function openSearch() {
  const dialog = document.getElementById('searchDialog');
  dialog.classList.add('active');
  document.getElementById('searchInput').focus();
  if (scanner && isScanning) {
    scanner.pause();
    isScanning = false;
  }
}

function closeSearch() {
  const dialog = document.getElementById('searchDialog');
  dialog.classList.remove('active');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<div class="loading-state">Ketik untuk mencari siswa...</div>';
  if (scanner) {
    scanner.resume();
    isScanning = true;
  }
}

function performSearch(query) {
  const resultsEl = document.getElementById('searchResults');
  if (!query.trim()) {
    resultsEl.innerHTML = '<div class="loading-state">Ketik untuk mencari siswa...</div>';
    return;
  }
  const q = query.toLowerCase();
  const results = studentsData.filter(s =>
    s.nama.toLowerCase().includes(q) ||
    s.idSiswa.toLowerCase().includes(q) ||
    s.kelas.toLowerCase().includes(q)
  );
  if (results.length === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <div>Tidak ada hasil untuk "${escapeHtml(query)}"</div>
      </div>
    `;
    return;
  }
  resultsEl.innerHTML = results.map(s => {
    const foto = photosData.find(f => f.idSiswa === s.idSiswa);
    const fotoUrl = foto ? buildPhotoUrl(foto.fotoId) : '';
    const statusClass = s.status === 'AMAN' ? 'status-aman' : 'status-belum';
    return `
      <div class="search-result-item" data-id="${escapeHtml(s.idSiswa)}">
        <img class="result-photo" src="${fotoUrl || ''}" alt="" onerror="this.style.display='none'">
        <div class="result-info">
          <div class="result-name">${escapeHtml(s.nama)}</div>
          <div class="result-class">${escapeHtml(s.kelas)} · ID: ${escapeHtml(s.idSiswa)}</div>
        </div>
        <span class="result-status ${statusClass}">${s.status === 'AMAN' ? 'AMAN' : 'BELUM'}</span>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════
function setupEventListeners() {
  document.getElementById('btnSearch').addEventListener('click', openSearch);
  document.getElementById('btnRefresh').addEventListener('click', loadData);

  document.getElementById('btnDetail').addEventListener('click', (e) => {
    e.stopPropagation();
    const studentId = document.getElementById('modalInfoContent').dataset.studentId;
    showDetailModal(studentId);
  });

  document.getElementById('btnCloseSearch').addEventListener('click', closeSearch);

  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(e.target.value), 200);
  });

  document.getElementById('searchResults').addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (item) {
      const id = item.dataset.id;
      const student = findStudent(id);
      if (student) {
        closeSearch();
        showStudentModal(student);
      }
    }
  });

  document.getElementById('modalInfo').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTopModal();
  });
  document.getElementById('modalDetail').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTopModal();
  });

  document.getElementById('modalInfoContent').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('modalDetailContent').addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      const searchOpen = document.getElementById('searchDialog').classList.contains('active');
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      if (!searchOpen && !isInputFocused && modalStack.length > 0) {
        e.preventDefault();
        closeTopModal();
      }
    }
    if (e.code === 'Escape') {
      const searchOpen = document.getElementById('searchDialog').classList.contains('active');
      if (searchOpen) {
        closeSearch();
      } else if (modalStack.length > 0) {
        closeTopModal();
      }
    }
  });
}

// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
function formatRupiah(value) {
  const num = parseFloat(value) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
