import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Используем твой конфиг Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCby2qPGnLHWRfxWAI3Y2aK_UndEh9nato",
    authDomain: "das4akk-1.firebaseapp.com",
    databaseURL: "https://das4akk-1-default-rtdb.firebaseio.com",
    projectId: "das4akk-1",
    storageBucket: "das4akk-1.firebasestorage.app",
    messagingSenderId: "631019796218",
    appId: "1:631019796218:web:df72851c938bdc9a497b43"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const testRoomRef = ref(db, 'test_mic_room'); // Отдельная ветка для теста

const logContainer = document.getElementById('debug-log');
function log(msg, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Настройка PeerJS с резервным сервером
const peer = new Peer(undefined, {
    host: '0.peerjs.com', // Если не сработает, попробуем позже другой
    port: 443,
    secure: true,
    debug: 3
});

let myStream = null;
let audioCtx = null;

// 1. Когда наш ID создан
peer.on('open', (id) => {
    document.getElementById('my-peer-id').innerText = id;
    log(`Твой ID создан: ${id}`, 'system');
    
    // Автоматически записываем свой ID в общую базу теста
    set(ref(db, `test_mic_room/${id}`), { active: true, ts: Date.now() });
    log("ID отправлен в общую базу. Ждем собеседников...");
});

// 2. Слушаем базу: если кто-то зашел, звоним ему автоматически
onChildAdded(testRoomRef, (snap) => {
    const otherPeerId = snap.key;
    if (otherPeerId !== peer.id) {
        log(`Обнаружен новый участник: ${otherPeerId}. Звоню...`, 'system');
        startCall(otherPeerId);
    }
});

// 3. Обработка входящего звонка
peer.on('call', (call) => {
    log(`Входящий звонок от: ${call.peer}. Отвечаю...`, 'mic-active');
    call.answer(myStream); 
    call.on('stream', (remoteStream) => handleRemoteStream(remoteStream, call.peer));
});

async function startCall(targetId) {
    // ПРОВЕРКА 1: Если мы еще не нажали кнопку микрофона
    if (!myStream) {
        log("ОШИБКА: Сначала включи микрофон (кнопка сверху)!", "error");
        return;
    }

    log(`Пытаюсь позвонить на: ${targetId}...`, 'system');
    
    // ПРОВЕРКА 2: Создаем звонок
    const call = peer.call(targetId, myStream);
    
    if (!call) {
        log("Критическая ошибка: Звонок не создался (PeerJS вернул null)", "error");
        return;
    }

    // Теперь безопасно вешаем обработчик
    call.on('stream', (remoteStream) => {
        log("Собеседник взял трубку, поток пошел!", 'mic-active');
        handleRemoteStream(remoteStream, targetId);
    });

    call.on('error', (err) => {
        log(`Ошибка звонка: ${err}`, 'error');
    });
}async function startCall(targetId) {
    // ПРОВЕРКА 1: Если мы еще не нажали кнопку микрофона
    if (!myStream) {
        log("ОШИБКА: Сначала включи микрофон (кнопка сверху)!", "error");
        return;
    }

    log(`Пытаюсь позвонить на: ${targetId}...`, 'system');
    
    // ПРОВЕРКА 2: Создаем звонок
    const call = peer.call(targetId, myStream);
    
    if (!call) {
        log("Критическая ошибка: Звонок не создался (PeerJS вернул null)", "error");
        return;
    }

    // Теперь безопасно вешаем обработчик
    call.on('stream', (remoteStream) => {
        log("Собеседник взял трубку, поток пошел!", 'mic-active');
        handleRemoteStream(remoteStream, targetId);
    });

    call.on('error', (err) => {
        log(`Ошибка звонка: ${err}`, 'error');
    });
}

// МИКРОФОН
document.getElementById('mic-toggle').onclick = async function() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.innerText = "МИКРОФОН ВКЛЮЧЕН";
        this.style.background = "#27ae60";
        log("Микрофон захвачен!", 'mic-active');
        startVisualizer(myStream, 'local-meter', 'local-status');
    } catch (e) {
        log(`Ошибка микрофона: ${e.message}`, 'error');
    }
};

function handleRemoteStream(stream, peerId) {
    log("Поток получен! Проверь индикатор 'ОН'.", 'mic-active');
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.setAttribute('autoplay', 'true');
        audio.setAttribute('playsinline', 'true');
        document.getElementById('audio-dump').appendChild(audio);
    }
    audio.srcObject = stream;
    startVisualizer(stream, 'remote-meter', 'remote-status');
}

// ВИЗУАЛИЗАТОР (без изменений)
function startVisualizer(stream, elementId, statusId) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const meter = document.getElementById(elementId);
    const status = document.getElementById(statusId);

    function update() {
        analyser.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a,b) => a + b, 0);
        let volume = (sum / dataArray.length);
        meter.style.width = Math.min(volume * 2, 100) + '%';
        status.innerText = volume > 2 ? "Голос есть!" : "Тишина...";
        requestAnimationFrame(update);
    }
    update();
}

// Очистка при выходе
window.onbeforeunload = () => {
    if (peer.id) set(ref(db, `test_mic_room/${peer.id}`), null);
};