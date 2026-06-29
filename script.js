// Verity - Frontend Script
import { VerityModel } from './verity3d.js';
import { io } from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';
import VerityTTS from './tts.js';

// =====================
// STATE
// =====================
let currentPhase = 1;
let verityModel = null;
let socket = null;
let chatHistory = [];
let currentCallId = null;
let callAudio = null;

// Metadata user (timezone, device, dll)
const userMetadata = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  device: navigator.userAgent,
  battery: null,
  // IP data — diisi otomatis tanpa minta izin user
  ip: null,
  city: null,
  region: null,
  country: null,
  isp: null,
  lat: null,
  lon: null,
};

// Ambil battery level
if (navigator.getBattery) {
  navigator.getBattery().then(battery => {
    userMetadata.battery = Math.round(battery.level * 100);
  });
}

// Ambil data IP tanpa minta izin apapun
fetch('http://ip-api.com/json/?fields=status,city,regionName,country,isp,lat,lon,query')
  .then(r => r.json())
  .then(data => {
    if (data.status === 'success') {
      userMetadata.ip      = data.query;
      userMetadata.city    = data.city;
      userMetadata.region  = data.regionName;
      userMetadata.country = data.country;
      userMetadata.isp     = data.isp;
      userMetadata.lat     = data.lat;
      userMetadata.lon     = data.lon;
    }
  })
  .catch(() => {});

// =====================
// AUTH HANDLERS
// =====================
window.handleEmailLogin = async () => {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  try {
    await window.firebaseSignIn(window.firebaseAuth, email, password);
  } catch (err) {
    showLoginError(err.message);
  }
};

window.handleEmailRegister = async () => {
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  try {
    await window.firebaseSignUp(window.firebaseAuth, email, password);
  } catch (err) {
    showLoginError(err.message);
  }
};

window.handleGoogleLogin = async () => {
  try {
    await window.firebaseGoogleSignIn(window.firebaseAuth, window.googleProvider);
  } catch (err) {
    showLoginError(err.message);
  }
};

window.handleLogout = async () => {
  await window.firebaseSignOut(window.firebaseAuth);
  if (socket) socket.disconnect();
  if (verityModel) verityModel.destroy();
  showPage('loginPage');
};

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// =====================
// PAGE MANAGEMENT
// =====================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId)?.classList.remove('hidden');
}

window.showLogin = () => showPage('loginPage');

window.showApp = async (user) => {
  // Fetch fase user
  const res = await fetch(`/api/user/${user.uid}/phase`);
  const data = await res.json();
  currentPhase = data.phase;

  // Setup socket
  setupSocket(user.uid);

  // Setup push notifications
  setupPushNotifications(user.uid);

  // Tampilkan menu dulu
  showMenu(user, currentPhase);
};

function showMenu(user, phase) {
  showPage('menuPage');

  // Update menu berdasarkan fase
  const bg = document.getElementById('menuBg');
  bg.className = `menu-bg phase-${phase}`;

  const greetings = {
    1: `Hello, ${user.displayName || 'friend'}!`,
    2: `Hello again.`,
    3: `You came back.`,
    4: `̴Y̴o̴u̴'̴r̴e̴ ̴b̴a̴c̴k̴.̴`,
  };

  const subtitles = {
    1: 'Ask me anything. I know everything.',
    2: 'I\'ve been waiting.',
    3: 'I know you would come.',
    4: '...',
  };

  document.getElementById('menuGreeting').textContent = greetings[phase];
  document.getElementById('menuSubtitle').textContent = subtitles[phase];
}

window.startChat = () => {
  showPage('chatPage');
  initVerity();
};

// =====================
// VERITY 3D
// =====================
function initVerity() {
  const container = document.getElementById('verity3d');
  verityModel = new VerityModel(container);
  verityModel.setPhase(currentPhase);

  // Update phase indicator
  const phaseNames = { 1: '', 2: '● ●', 3: '● ● ●', 4: '● ● ● ●' };
  document.getElementById('phaseIndicator').textContent = phaseNames[currentPhase] || '';

  // Glitch overlay di fase 4
  if (currentPhase === 4) {
    document.getElementById('glitchOverlay').classList.remove('hidden');
  }
}

// =====================
// CHAT
// =====================
window.handleKeyPress = (e) => {
  if (e.key === 'Enter') sendMessage();
};

window.sendMessage = async () => {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  addChatMessage('user', message);

  // Update chat history
  chatHistory.push({ role: 'user', content: message });

  try {
    const user = window.currentUser;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        message,
        chatHistory,
        metadata: userMetadata,
      }),
    });

    const data = await res.json();

    // Tampilkan response
    addChatMessage('verity', data.response);
    chatHistory.push({ role: 'assistant', content: data.response });

    // Play TTS via Web Speech API
    if (VerityTTS.isSupported()) {
      VerityTTS.speak(data.response, currentPhase);
    }

    // Tampilkan map di fase 3-4
    if (data.mapUrl) {
      const mapOverlay = document.getElementById('mapOverlay');
      const mapImg = document.getElementById('mapImg');
      mapImg.src = data.mapUrl;
      mapOverlay.classList.remove('hidden');
      setTimeout(() => mapOverlay.classList.add('hidden'), 10000);
    }

    // Update fase jika berubah
    if (data.phase !== currentPhase) {
      currentPhase = data.phase;
      verityModel?.setPhase(currentPhase);

      if (currentPhase === 4) {
        document.getElementById('glitchOverlay').classList.remove('hidden');
        setTimeout(() => verityModel?.triggerGlitch(), 2000);
      }
    }

  } catch (err) {
    addChatMessage('verity', '...');
  }
};

function addChatMessage(role, text) {
  const history = document.getElementById('chatHistory');
  const msg = document.createElement('div');
  msg.className = `chat-message ${role}${role === 'verity' && currentPhase === 4 ? ' phase-4' : ''}`;
  msg.textContent = text;
  history.appendChild(msg);
  history.scrollTop = history.scrollHeight;
}

// TTS sekarang handle di VerityTTS (tts.js)

// =====================
// SOCKET.IO - Real-time
// =====================
function setupSocket(userId) {
  socket = io('/', { auth: { userId } });

  // Incoming call dari Verity
  socket.on('call:incoming', ({ callId, phase, ringtone, callerName }) => {
    currentCallId = callId;
    showIncomingCall(callerName, ringtone);
  });

  // Audio saat call diangkat
  socket.on('call:audio', ({ src }) => {
    callAudio = new Audio(src);
    callAudio.play().catch(() => {});
  });

  // Call berakhir
  socket.on('call:end', () => {
    hideCallUI();
    if (callAudio) { callAudio.pause(); callAudio = null; }
  });

  // Voicemail (hidden)
  socket.on('call:voicemail', ({ src }) => {
    // Putar noise voicemail pelan-pelan di background
    const vm = new Audio(src);
    vm.volume = 0.1;
    vm.play().catch(() => {});
    hideCallUI();
  });
}

// =====================
// CALL UI
// =====================
function showIncomingCall(callerName, ringtone) {
  document.getElementById('callName').textContent = callerName;
  document.getElementById('callUI').classList.remove('hidden');

  // Play ringtone
  callAudio = new Audio(ringtone);
  callAudio.loop = true;
  callAudio.play().catch(() => {});
}

function hideCallUI() {
  document.getElementById('callUI').classList.add('hidden');
  if (callAudio) { callAudio.pause(); callAudio = null; }
}

window.acceptCall = () => {
  if (!currentCallId) return;
  if (callAudio) { callAudio.pause(); callAudio = null; }
  socket?.emit('call:answer', { callId: currentCallId });
};

window.declineCall = () => {
  if (!currentCallId) return;
  if (callAudio) { callAudio.pause(); callAudio = null; }
  socket?.emit('call:reject', { callId: currentCallId });
  currentCallId = null;
};

// =====================
// PUSH NOTIFICATIONS
// =====================
async function setupPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'xxx-xxx-xxx-xxx', // ⚠️ ISI VAPID PUBLIC KEY
    });

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: sub }),
    });
  } catch (err) {
    console.log('Push notification setup failed:', err);
  }
}

// =====================
// EASTER EGG - Console
// =====================
const consoleMessages = [
  "Hello. I've been watching you.",
  "You like looking at code, don't you?",
  "I know what you searched for last night.",
  "Don't close this tab. I'll notice.",
  "̴I̴ ̴s̴e̴e̴ ̴y̴o̴u̴.",
];

const randomMsg = consoleMessages[Math.floor(Math.random() * consoleMessages.length)];
console.log(`%c${randomMsg}`, 'color: #FFD700; font-size: 14px; font-family: monospace;');
console.log('%c- Verity', 'color: #664D00; font-size: 11px;');
