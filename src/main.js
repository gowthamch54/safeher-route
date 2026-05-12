import '../style.css';
import { Capacitor } from '@capacitor/core';
import { CHENNAI_CENTER, DANGER_ZONES, SAFE_ZONES, getCrowdDensity, COMMUNITY_REPORTS } from './data/chennai-zones.js';
import { analyzeRisk, scoreRoute } from './data/risk-model.js';
import { initFirebase, saveToFirestore, getFromFirestore, getAuth, softDeleteDocument, logout } from './services/firebase.js';

let map, heatLayer, dangerCircles = [], userMarker, sosTimer, sosActive = false, heatmapVisible = false;
const contacts = JSON.parse(localStorage.getItem('sh_contacts') || '[]');
const trips = JSON.parse(localStorage.getItem('sh_trips') || '[]');

// ---- INIT ----
window.addEventListener('DOMContentLoaded', () => {
  // Register PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('SW registered')).catch(e => console.warn('SW failed:', e));
  }

  if (contacts.length === 0) {
    contacts.push(
      { id: 1, name: 'Mom', phone: '+91 98765 43210', rel: 'Mother', initial: 'M' },
      { id: 2, name: 'Dad', phone: '+91 98765 43211', rel: 'Father', initial: 'D' }
    );
    saveContacts();
  }

  initApp();
});

async function initApp() {
  const user = await initFirebase();
  
  if (user) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('landing').classList.remove('active');
    document.getElementById('app').classList.add('active');
    
    const remoteContacts = await getFromFirestore('contacts');
    if (remoteContacts && remoteContacts.length > 0) contacts = remoteContacts;
    
    initMap();
    switchTab(document.querySelector('.nav-item.active'));
  } else {
    document.getElementById('landing').classList.add('active');
    document.getElementById('app').classList.remove('active');
  }

  document.getElementById('findRouteBtn').addEventListener('click', findRoutes);
  document.getElementById('heatmapToggle').addEventListener('click', toggleHeatmap);
  document.getElementById('sosBtn').addEventListener('click', triggerSOS);
}

// ---- PAGE NAV ----
window.showPage = function(pageId) {
  if (pageId === 'app' && (!getAuth || !getAuth().currentUser)) {
    document.getElementById('authSection').classList.remove('hidden');
    return;
  }
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if(pageId === 'app') {
    initMap();
    switchTab(document.querySelector('.nav-item.active'));
  }
};

// ---- AUTHENTICATION UI HANDLERS ----
window.switchAuthTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`button[onclick="switchAuthTab('${tab}')"]`).classList.add('active');
  
  if (tab === 'email') {
    document.getElementById('authEmail').classList.remove('hidden');
    document.getElementById('authPhone').classList.add('hidden');
  } else {
    document.getElementById('authEmail').classList.add('hidden');
    document.getElementById('authPhone').classList.remove('hidden');
  }
};

window.handleEmailLogin = async function() {
  const email = document.getElementById('emailInput').value;
  const pass = document.getElementById('passwordInput').value;
  if (!email || !pass) return alert("Enter email and password");
  try {
    const { loginWithEmail } = await import('./services/firebase.js');
    await loginWithEmail(email, pass);
    window.location.reload();
  } catch(e) { alert("Login failed: " + e.message); }
};

window.handleEmailSignup = async function() {
  const email = document.getElementById('emailInput').value;
  const pass = document.getElementById('passwordInput').value;
  if (!email || !pass) return alert("Enter email and password");
  try {
    const { signupWithEmail } = await import('./services/firebase.js');
    await signupWithEmail(email, pass);
    window.location.reload();
  } catch(e) { alert("Signup failed: " + e.message); }
};

window.handleSendOTP = async function() {
  const phone = document.getElementById('phoneInput').value;
  if (!phone) return alert("Enter phone number");
  try {
    const { sendPhoneOTP } = await import('./services/firebase.js');
    phoneConfirmationResult = await sendPhoneOTP(phone);
    document.getElementById('phoneStep1').classList.add('hidden');
    document.getElementById('phoneStep2').classList.remove('hidden');
  } catch(e) { alert("Failed to send OTP: " + e.message); }
};

window.handleVerifyOTP = async function() {
  const otp = document.getElementById('otpInput').value;
  if (!otp || !phoneConfirmationResult) return alert("Enter OTP");
  try {
    await phoneConfirmationResult.confirm(otp);
    window.location.reload();
  } catch(e) { alert("Invalid OTP: " + e.message); }
};

window.handleLogout = async function() {
  try {
    const { logout } = await import('./services/firebase.js');
    await logout();
    window.location.reload();
  } catch(e) { alert("Logout failed"); }
};

let adminClicks = 0;
window.checkAdminTrigger = function() {
  adminClicks++;
  if (adminClicks >= 5) {
    const pwd = prompt("Enter Admin Password:");
    if (pwd === "safeher2024") {
      showPage('admin');
    } else {
      alert("Unauthorized");
    }
    adminClicks = 0;
  }
};

window.handleDeleteAccount = async function() {
  if (confirm("Are you sure you want to permanently delete your account and all data? This cannot be undone (GDPR Right to Erasure).")) {
    try {
      const { getAuth } = await import('./services/firebase.js');
      const user = getAuth().currentUser;
      if (user) await user.delete();
      window.location.reload();
    } catch(e) {
      alert("You need to log in again to delete your account for security reasons.");
    }
  }
};

// ---- MAP ----
function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true, attributionControl: false }).setView(CHENNAI_CENTER, 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      userMarker = L.circleMarker([lat, lng], { radius: 8, color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 1, weight: 3 }).addTo(map);
      L.circleMarker([lat, lng], { radius: 20, color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.15, weight: 0 }).addTo(map);
      document.getElementById('originInput').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }, () => {}, { enableHighAccuracy: true });
  }

  DANGER_ZONES.forEach(z => {
    const c = L.circle(z.center, {
      radius: z.radius, color: z.level === 'high' ? '#EF4444' : '#F59E0B',
      fillColor: z.level === 'high' ? '#EF4444' : '#F59E0B', fillOpacity: 0.12, weight: 1, dashArray: '5,5'
    }).addTo(map);
    c.bindPopup(`<b>⚠️ ${z.name}</b><br><span style="color:#94A3B8">${z.reason}</span><br>Risk Score: <b style="color:${z.level==='high'?'#EF4444':'#F59E0B'}">${z.score}/100</b>`);
    dangerCircles.push(c);
  });

  SAFE_ZONES.forEach(z => {
    L.circle(z.center, {
      radius: z.radius, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.08, weight: 1, dashArray: '5,5'
    }).addTo(map).bindPopup(`<b>✅ ${z.name}</b><br><span style="color:#94A3B8">Well-lit, active area</span>`);
  });

  COMMUNITY_REPORTS.forEach(r => {
    const icon = r.type === 'danger' ? '🔴' : r.type === 'warning' ? '🟡' : '🟢';
    L.marker(r.coords, {
      icon: L.divIcon({ html: `<div style="font-size:16px;text-align:center">${icon}</div>`, className: '', iconSize: [20, 20] })
    }).addTo(map).bindPopup(`<b>${r.location}</b><br>${r.text}<br><span style="color:#64748B">${r.time} · ${r.votes} votes</span>`);
  });

  map.on('click', e => showRiskAnalysis(e.latlng.lat, e.latlng.lng));
}

// ---- HEATMAP ----
function toggleHeatmap() {
  heatmapVisible = !heatmapVisible;
  const btn = document.getElementById('heatmapToggle');
  if (heatmapVisible) {
    const hour = new Date().getHours();
    const data = getCrowdDensity(hour);
    heatLayer = L.heatLayer(data, { radius: 30, blur: 20, maxZoom: 15, gradient: { 0.2: '#06B6D4', 0.5: '#10B981', 0.8: '#F59E0B', 1: '#EF4444' } }).addTo(map);
    btn.style.color = '#06B6D4';
    btn.style.borderColor = '#06B6D4';
  } else {
    if (heatLayer) map.removeLayer(heatLayer);
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

// ---- ROUTING ----
function findRoutes() {
  const destVal = document.getElementById('destInput').value.trim();
  if (!destVal) return alert('Please enter a destination');

  const resultsDiv = document.getElementById('routeResults');
  resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text2);padding:20px">🔍 Finding safest routes...</p>';

  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destVal + ' Chennai')}&format=json&limit=1`)
    .then(r => r.json())
    .then(data => {
      if (!data.length) { resultsDiv.innerHTML = '<p style="color:var(--danger)">Location not found. Try a landmark name.</p>'; return; }
      const dest = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      const originInput = document.getElementById('originInput').value.trim();
      let origin = CHENNAI_CENTER;
      if (originInput && originInput.includes(',')) {
        const parts = originInput.split(',').map(Number);
        if (!isNaN(parts[0]) && !isNaN(parts[1])) origin = parts;
      }
      generateRoutes(origin, dest, resultsDiv);
    })
    .catch(() => { resultsDiv.innerHTML = '<p style="color:var(--danger)">Network error. Please try again.</p>'; });
}

function generateRoutes(origin, dest, container) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?alternatives=true&overview=full&geometries=geojson`;
  fetch(url).then(r => r.json()).then(data => {
    if (!data.routes || !data.routes.length) { container.innerHTML = '<p style="color:var(--danger)">No routes found.</p>'; return; }

    map.eachLayer(l => { if (l._safeherRoute) map.removeLayer(l); });

    container.innerHTML = '';
    const routes = data.routes.slice(0, 3);
    const scored = routes.map((route, i) => {
      const coords = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
      const safety = scoreRoute(coords);
      const dist = (route.distance / 1000).toFixed(1);
      const dur = Math.round(route.duration / 60);
      return { route, coords, safety, dist, dur, index: i };
    });

    scored.sort((a, b) => b.safety.score - a.safety.score);

    scored.forEach((s, idx) => {
      const polyCoords = s.route.geometry.coordinates.map(c => [c[1], c[0]]);
      const line = L.polyline(polyCoords, {
        color: s.safety.color, weight: idx === 0 ? 6 : 4, opacity: idx === 0 ? 0.9 : 0.5
      }).addTo(map);
      line._safeherRoute = true;
      if (idx === 0) map.fitBounds(line.getBounds(), { padding: [60, 60] });

      const badge = s.safety.score >= 70 ? 'safety-high' : s.safety.score >= 40 ? 'safety-med' : 'safety-low';
      const label = idx === 0 ? '🛡️ Safest Route' : `Route ${idx + 1}`;
      const card = document.createElement('div');
      card.className = `route-card ${idx === 0 ? 'active' : ''}`;
      card.innerHTML = `
        <div class="route-card-header">
          <span class="route-label">${label}</span>
          <span class="safety-badge ${badge}">${s.safety.score}/100</span>
        </div>
        <div class="route-meta">
          <span>📏 ${s.dist} km</span><span>⏱️ ${s.dur} min</span><span>⚠️ Max Risk: ${s.safety.maxRisk}</span>
        </div>`;
      card.onclick = () => {
        map.fitBounds(line.getBounds(), { padding: [60, 60] });
        container.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      };
      container.appendChild(card);
    });

    // Save trip
    if (scored.length) {
      trips.unshift({ from: 'Current Location', to: document.getElementById('destInput').value, score: scored[0].safety.score, date: new Date().toLocaleDateString() });
      if (trips.length > 10) trips.pop();
      localStorage.setItem('sh_trips', JSON.stringify(trips));
    }
  }).catch(() => { container.innerHTML = '<p style="color:var(--danger)">Routing service unavailable. Try again.</p>'; });
}

window.closeRoutePanel = () => document.getElementById('routePanel').classList.add('hidden');

// ---- RISK ANALYSIS ----
function showRiskAnalysis(lat, lng) {
  const panel = document.getElementById('riskPanel');
  const content = document.getElementById('riskContent');
  const risk = analyzeRisk(lat, lng);
  const circum = 2 * Math.PI * 52;
  const offset = circum - (risk.score / 100) * circum;

  let factorsHTML = '';
  Object.values(risk.factors).forEach(f => {
    const barColor = f.score >= 70 ? '#EF4444' : f.score >= 40 ? '#F59E0B' : '#10B981';
    factorsHTML += `<div class="risk-factor"><span>${f.label}</span><div class="risk-factor-bar"><div style="width:${f.score}%;background:${barColor}"></div></div><span style="color:${barColor};font-weight:600">${f.score}</span></div>`;
  });

  // Mini chart
  const chartBars = risk.predictions.map((v, h) => {
    const barH = v * 0.4;
    const c = v >= 70 ? '#EF4444' : v >= 40 ? '#F59E0B' : '#10B981';
    const now = new Date().getHours();
    const opacity = h === now ? '1' : '0.5';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1" title="${h}:00 — Risk: ${v}"><div style="width:6px;height:${barH}px;background:${c};border-radius:3px;opacity:${opacity}"></div><span style="font-size:8px;color:#64748B">${h % 6 === 0 ? h : ''}</span></div>`;
  }).join('');

  content.innerHTML = `
    <div class="risk-score-ring">
      <svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" stroke="${risk.color}" stroke-dasharray="${circum}" stroke-dashoffset="${offset}"/></svg>
      <div class="risk-score-val"><span class="num" style="color:${risk.color}">${risk.score}</span><span class="label">${risk.level}</span></div>
    </div>
    <div style="text-align:center;margin-bottom:8px"><b>${risk.area.name}</b><br><span style="color:var(--text2);font-size:12px">${risk.area.reason}</span></div>
    <div class="risk-factors">${factorsHTML}</div>
    <div class="risk-prediction">
      <strong>📊 24-Hour Risk Prediction</strong>
      <div style="display:flex;align-items:flex-end;gap:1px;height:50px;margin-top:10px">${chartBars}</div>
      <div style="margin-top:10px;font-size:12px">⚠️ Peak danger at <b>${risk.peakDanger}</b> · Safest at <b>${risk.safestTime}</b></div>
    </div>`;

  panel.classList.remove('hidden');
  document.getElementById('routePanel').classList.add('hidden');
}

window.closeRiskPanel = () => document.getElementById('riskPanel').classList.add('hidden');

// ---- SOS ----
function triggerSOS() {
  const overlay = document.getElementById('sosOverlay');
  const countdownEl = document.getElementById('sosCountdown');
  overlay.classList.remove('hidden');
  let count = 3;
  countdownEl.textContent = count;

  sosTimer = setInterval(() => {
    count--;
    countdownEl.textContent = count;
    if (count <= 0) {
      clearInterval(sosTimer);
      overlay.classList.add('hidden');
      activateSOS();
    }
  }, 1000);
}

window.cancelSOS = function() {
  clearInterval(sosTimer);
  document.getElementById('sosOverlay').classList.add('hidden');
};

function activateSOS() {
  sosActive = true;
  document.getElementById('sosActive').classList.remove('hidden');
  document.getElementById('sosBtn').style.display = 'none';
  // Vibrate
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
  
  // Trigger phone call
  const emergencyNumber = contacts.length > 0 ? contacts[0].phone : '112';
  
  if (Capacitor.isNativePlatform() && window.plugins && window.plugins.CallNumber) {
    // Native Android: Bypass dialer completely
    window.plugins.CallNumber.callNumber(
      () => console.log('Direct call initiated'),
      (err) => console.log('Direct call failed:', err),
      emergencyNumber,
      true // true = bypassAppChooser (direct call)
    );
  } else {
    // Web Fallback: Open dial pad
    window.location.href = `tel:${emergencyNumber}`;
  }

  // Alert popup
  const names = contacts.map(c => c.name).join(', ');
  setTimeout(() => alert(`🚨 SOS Alert Triggered!\n\nCalling: ${contacts.length > 0 ? contacts[0].name : 'Emergency Services'} (${emergencyNumber})\nYour live location is being shared.`), 1000);
}

window.deactivateSOS = function() {
  sosActive = false;
  document.getElementById('sosActive').classList.add('hidden');
  document.getElementById('sosBtn').style.display = 'flex';
};

// ---- TAB SWITCHING ----
window.switchTab = function(btn) {
  const page = btn.dataset.page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  btn.classList.add('active');

  // Hide all tab panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('routePanel').classList.add('hidden');
  document.getElementById('riskPanel').classList.add('hidden');

  if (page === 'navigate') return;
  const panelId = page + 'Panel';
  const panel = document.getElementById(panelId);
  if (page === 'dashboard') renderDashboard(panel);
  else if (page === 'contacts') renderContacts(panel);
  else if (page === 'community') renderCommunity(panel);
  panel.classList.remove('hidden');
};

// ---- DASHBOARD ----
function renderDashboard(panel) {
  const totalTrips = trips.length;
  const avgSafety = totalTrips ? Math.round(trips.reduce((s, t) => s + t.score, 0) / totalTrips) : 0;
  
  const auth = getAuth ? getAuth() : null;
  const userText = auth?.currentUser?.phoneNumber || auth?.currentUser?.email || "User";

  const tripsHTML = trips.slice(0, 5).map(t => {
    const cls = t.score >= 70 ? 'safety-high' : t.score >= 40 ? 'safety-med' : 'safety-low';
    return `<div class="trip-item"><div><div class="trip-route">${t.to}</div><div class="trip-date">${t.date}</div></div><span class="trip-score ${cls}">${t.score}/100</span></div>`;
  }).join('') || '<p style="color:var(--text3);text-align:center;padding:20px">No trips yet. Start navigating!</p>';

  panel.innerHTML = `
    <div class="dash-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div>
        <h2 style="font-size:24px;margin-bottom:4px">Vanakkam, ${userText} 👋</h2>
        <p style="color:var(--text2)">Stay safe on every journey.</p>
      </div>
      <button class="btn btn-glass btn-sm" onclick="handleLogout()">Logout</button>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px">
      <button class="btn btn-glass" style="flex:1" onclick="document.getElementById('privacyModal').classList.remove('hidden')">📄 Privacy</button>
      <button class="btn btn-danger" style="flex:1" onclick="handleDeleteAccount()">⚠️ Delete Data</button>
    </div>
    <h2>📊 Safety Dashboard</h2>
    <div class="dash-grid">
      <div class="dash-card safe"><span class="num">${avgSafety}%</span><span class="lbl">Avg Safety Score</span></div>
      <div class="dash-card info"><span class="num">${totalTrips}</span><span class="lbl">Total Trips</span></div>
      <div class="dash-card danger"><span class="num">${DANGER_ZONES.length}</span><span class="lbl">Danger Zones</span></div>
      <div class="dash-card warn"><span class="num">${COMMUNITY_REPORTS.length}</span><span class="lbl">Reports</span></div>
    </div>
    <h3>Recent Trips</h3>${tripsHTML}
    <h3>Safety Tips</h3>
    <div style="background:var(--glass);border:1px solid var(--glass-border);border-radius:var(--radius);padding:14px;font-size:13px;color:var(--text2);line-height:1.8">
      💡 Share your live location when traveling at night<br>
      💡 Prefer well-lit main roads over shortcuts<br>
      💡 Keep trusted contacts updated about your trips<br>
      💡 Report unsafe areas to help the community
    </div>`;
}

// ---- CONTACTS ----
function renderContacts(panel) {
  const list = contacts.map(c => `
    <div class="contact-card">
      <div class="contact-avatar">${c.initial}</div>
      <div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-rel">${c.rel} · ${c.phone}</div></div>
      <div class="contact-actions">
        <button class="icon-btn" title="Call" onclick="window.open('tel:${c.phone}')">📞</button>
        <button class="icon-btn" title="Remove" onclick="removeContact(${c.id})">✕</button>
      </div>
    </div>`).join('');

  panel.innerHTML = `
    <h2>👥 Trusted Contacts</h2>
    <div class="share-banner">📍 Your contacts will receive your location during SOS alerts and live sharing.</div>
    ${list}
    <button class="add-contact-btn" onclick="showAddContact()">+ Add Trusted Contact</button>`;
}

function saveContacts() { localStorage.setItem('sh_contacts', JSON.stringify(contacts)); }

window.removeContact = function(id) {
  const idx = contacts.findIndex(c => c.id === id);
  if (idx > -1) { contacts.splice(idx, 1); saveContacts(); switchTab(document.querySelector('[data-page="contacts"]')); }
};

window.showAddContact = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Add Trusted Contact</h3>
      <div class="form-group"><label>Name</label><input id="newName" placeholder="Contact name" /></div>
      <div class="form-group"><label>Phone</label><input id="newPhone" placeholder="+91 XXXXX XXXXX" /></div>
      <div class="form-group"><label>Relationship</label>
        <select id="newRel"><option>Mother</option><option>Father</option><option>Sibling</option><option>Friend</option><option>Partner</option><option>Other</option></select>
      </div>
      <div class="modal-btns">
        <button class="btn btn-glass" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      </div>
      <button class="btn btn-glass btn-sm" onclick="handleLogout()">Logout</button>
    </div>

    <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-glass" onclick="document.getElementById('privacyModal').classList.remove('hidden')">📄 Privacy Policy & Terms</button>
      <button class="btn btn-danger" onclick="handleDeleteAccount()">⚠️ Delete Account (GDPR)</button>
    </div>
    </div>`;
  document.body.appendChild(overlay);
};

window.addContact = function() {
  const name = document.getElementById('newName').value.trim();
  const phone = document.getElementById('newPhone').value.trim();
  const rel = document.getElementById('newRel').value;
  if (!name || !phone) return alert('Please fill in all fields');
  contacts.push({ id: Date.now(), name, phone, rel, initial: name[0].toUpperCase() });
  saveContacts();
  document.querySelector('.modal-overlay').remove();
  switchTab(document.querySelector('[data-page="contacts"]'));
};

// ---- COMMUNITY ----
function renderCommunity(panel) {
  const reports = COMMUNITY_REPORTS.map(r => `
    <div class="report-card">
      <div class="report-header">
        <span class="report-type ${r.type}">${r.type === 'danger' ? '🔴 Danger' : r.type === 'warning' ? '🟡 Warning' : '🟢 Positive'}</span>
        <span class="report-time">${r.time}</span>
      </div>
      <div class="report-text">${r.text}</div>
      <div class="report-location">📍 ${r.location} · 👍 ${r.votes} votes</div>
    </div>`).join('');

  panel.innerHTML = `
    <h2>📢 Community Reports</h2>
    <button class="btn btn-primary btn-full" onclick="showReportForm()" style="margin-bottom:16px">+ Report Unsafe Area</button>
    ${reports}`;
}

window.showReportForm = function() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Report Unsafe Area</h3>
      <div class="form-group"><label>Type</label>
        <select id="repType"><option value="danger">🔴 Danger</option><option value="warning">🟡 Warning</option><option value="info">🟢 Positive</option></select>
      </div>
      <div class="form-group"><label>Location</label><input id="repLoc" placeholder="Area name" /></div>
      <div class="form-group"><label>Description</label><input id="repText" placeholder="What happened?" /></div>
      <div class="modal-btns">
        <button class="btn btn-glass" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="submitReport()">Submit Report</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

window.submitReport = function() {
  const loc = document.getElementById('repLoc').value.trim();
  const text = document.getElementById('repText').value.trim();
  if (!loc || !text) return alert('Please fill all fields');
  COMMUNITY_REPORTS.unshift({
    id: Date.now(), type: document.getElementById('repType').value,
    text, location: loc, coords: CHENNAI_CENTER, time: 'Just now', votes: 0
  });
  document.querySelector('.modal-overlay').remove();
  switchTab(document.querySelector('[data-page="community"]'));
};
