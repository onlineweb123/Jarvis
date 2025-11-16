/* jarvis.js
   Client-side Jarvis brain:
   - Speech recognition (voice commands)
   - Speech synthesis (responses)
   - Command parsing (basic)
   - Fetch weather/news using public APIs (requires API keys)
   - Register service worker + request notifications
*/

const state = {
  lastCommand: null,
  logs: [],
  weather: null,
  news: [],
  notifEnabled: false
};

const logBox = document.getElementById('logBox');
const holoText = document.getElementById('holoText');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const voiceBtn = document.getElementById('voiceBtn');
const clearBtn = document.getElementById('clearBtn');
const statusLine = document.getElementById('statusLine');
const liveList = document.getElementById('liveList');
const btnNotif = document.getElementById('btn-notif');

function addLog(text) {
  const time = new Date().toLocaleTimeString();
  state.logs.unshift(`${time} • ${text}`);
  if (state.logs.length > 200) state.logs.pop();
  renderLogs();
}

function renderLogs() {
  logBox.innerHTML = state.logs.map(l => `<div>${l}</div>`).join('');
}

function setStatus(text) {
  statusLine.textContent = 'Status: ' + text;
}

function speak(text) {
  holoText.textContent = text;
  addLog('Jarvis: ' + text);
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'en-US';
  speechSynthesis.cancel();
  speechSynthesis.speak(ut);
}

// Basic command parser
async function handleCommand(raw) {
  const cmd = raw.trim().toLowerCase();
  state.lastCommand = cmd;
  addLog('User: ' + raw);
  document.querySelector('#liveList li:nth-child(3)').textContent = 'Last Command: ' + cmd;
  setStatus('Processing...');
  try {
    if (cmd.includes('weather')) {
      await fetchWeather(); // updates state.weather
      if (state.weather) {
        const t = `Location ${state.weather.name}. ${Math.round(state.weather.main.temp)} °C, ${state.weather.weather[0].description}`;
        speak(t);
        notify('Weather Update', t);
      } else speak('Weather not available. Add API key in jarvis.js');
    } else if (cmd.includes('time')) {
      const now = new Date();
      const t = `Time is ${now.toLocaleTimeString()}`;
      speak(t);
    } else if (cmd.includes('news')) {
      await fetchNews();
      if (state.news.length) {
        const t = `Top news: ${state.news[0].title}`;
        speak(t);
        notify('Top News', state.news[0].title);
      } else speak('No news available. Add News API key variable in jarvis.js');
    } else if (cmd.includes('status')) {
      const t = `I am active. Notifications ${state.notifEnabled ? 'enabled' : 'disabled'}.`;
      speak(t);
    } else {
      // fallback small "AI"
      speak(`நீ சொன்னது: ${raw}. நான் இதைக்குத் தெரிஞ்சு செய்றேன் — weather / news / time / status என சொல்றே.`);
    }
  } catch (e) {
    console.error(e);
    speak('Something went wrong. Check console.');
  } finally {
    setStatus('Idle');
  }
}

// ---- Voice recognition (Web Speech API) ----
let recognition = null;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'ta-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (ev) => {
    const t = ev.results[0][0].transcript;
    userInput.value = t;
    handleCommand(t);
  };
  recognition.onerror = (e) => { addLog('Speech error: ' + e.error); };
} else {
  voiceBtn.style.display = 'none';
}

voiceBtn.addEventListener('click', () => {
  if (!recognition) { speak('Voice recognition not supported in this browser.'); return; }
  recognition.start();
  setStatus('Listening...');
});

// ---- Buttons ----
sendBtn.addEventListener('click', () => {
  const v = userInput.value.trim();
  if (!v) return;
  handleCommand(v);
  userInput.value = '';
});
clearBtn.addEventListener('click', () => { userInput.value = ''; });

// quick chips
document.querySelectorAll('.chip').forEach(c => {
  c.addEventListener('click', () => handleCommand(c.dataset.cmd));
});

// --- Live small updates placeholders ---
function renderLive() {
  document.querySelector('#liveList li:nth-child(1)').textContent = 'Weather: ' + (state.weather ? `${Math.round(state.weather.main.temp)} °C, ${state.weather.weather[0].main}` : '—');
  document.querySelector('#liveList li:nth-child(2)').textContent = 'News: ' + (state.news[0] ? state.news[0].title : '—');
}
setInterval(renderLive, 2500);

// ---- Simple API fetchers (requires API Keys) ----
// Add your API keys here:
const OPENWEATHER_API_KEY = ''; // <-- put your OpenWeatherMap API key
const NEWSAPI_KEY = ''; // <-- or any news API key

async function fetchWeather() {
  if (!OPENWEATHER_API_KEY) { addLog('No weather API key.'); return null; }
  try {
    // Use geolocation if available
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res(p.coords), _ => res(null), { timeout: 5000 });
    });
    let url;
    if (pos) url = `https://api.openweathermap.org/data/2.5/weather?lat=${pos.latitude}&lon=${pos.longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    else url = `https://api.openweathermap.org/data/2.5/weather?q=Chennai&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Weather fetch failed');
    state.weather = await r.json();
    addLog('Weather fetched');
    return state.weather;
  } catch (e) {
    console.error(e);
    addLog('Weather error');
    return null;
  }
}

async function fetchNews() {
  if (!NEWSAPI_KEY) { addLog('No news API key.'); return []; }
  try {
    const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${NEWSAPI_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('News fetch failed');
    const j = await r.json();
    state.news = j.articles || [];
    addLog('News fetched: ' + state.news.length);
    return state.news;
  } catch (e) {
    console.error(e);
    addLog('News error');
    return [];
  }
}

// ---- Notifications ----
btnNotif.addEventListener('click', async () => {
  if (!('Notification' in window)) { speak('Notifications not supported.'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    state.notifEnabled = true;
    addLog('Notifications granted');
    speak('Notifications enabled');
    // Optionally subscribe to push (needs server)
    try { await registerPushSubscription(); } catch(e){ addLog('Push subscription skipped: ' + e.message) }
  } else {
    state.notifEnabled = false;
    speak('Notifications blocked');
  }
});

function notify(title, body) {
  if (!state.notifEnabled) return;
  try {
    new Notification(title, { body, icon: './icons/icon-192x192.png' });
  } catch (e) {
    console.warn('Notify failed', e);
  }
}

// Placeholder push subscription (requires server & VAPID publicKey)
async function registerPushSubscription() {
  if (!('serviceWorker' in navigator)) throw new Error('SW not supported');
  const reg = await navigator.serviceWorker.ready;
  // If you have VAPID public key:
  // const vapidPublicKey = 'YOUR_PUBLIC_VAPID_KEY';
  // const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
  // send sub to server
  addLog('Push subscription step (server required) — skipped in demo');
}

// ---- Service worker registration ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    addLog('Service Worker registered');
    // try to register periodic sync if supported (experimental)
    if ('periodicSync' in reg) {
      (async () => {
        try {
          await reg.periodicSync.register('jarvis-periodic', { minInterval: 15 * 60 * 1000 }); // 15 min
          addLog('Registered periodicSync (experimental)');
        } catch (e) {
          addLog('periodicSync register failed');
        }
      })();
    }
  }).catch(e => { addLog('SW register failed: ' + e.message) });
}

// helper: urlBase64ToUint8Array if needed for VAPID (not used by default)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;++i) output[i] = raw.charCodeAt(i);
  return output;
}

// ---- Initial greeting ----
speak('வணக்கம் Maathu. Jarvis online.');
addLog('Jarvis online');

// Expose for debugging
window.Jarvis = { state, fetchWeather, fetchNews, handleCommand };

recognition.onresult = function(event) {
    let command = event.results[0][0].transcript.toLowerCase();
    console.log("Voice Command:", command);
    
    if(command.includes("hi") || command.includes("hello")) {
        speak("Hello Maathu, I am online and ready.");
    }
    else if(command.includes("time")) {
        let t = new Date().toLocaleTimeString();
        speak("The time is " + t);
    }
    else if(command.includes("date")) {
        let d = new Date().toLocaleDateString();
        speak("Today's date is " + d);
    }
    else if(command.includes("battery")) {
        navigator.getBattery().then(b => {
            speak("Your battery is " + Math.round(b.level * 100) + " percent");
        });
    }
    else if(command.includes("open youtube")) {
        speak("Opening YouTube Maathu");
        window.open("https://youtube.com", "_blank");
    }
    else if(command.includes("open instagram")) {
        speak("Opening Instagram");
        window.open("https://instagram.com", "_blank");
    }
    else {
        speak("Maathu, I heard you say: " + command + ". But I don't have a function for it yet.");
    }
};