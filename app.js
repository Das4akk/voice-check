// --- КОНФИГ И ЛОГИ ---
const logContainer = document.getElementById('debug-log');
function log(msg, type = 'system') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// --- ИНИЦИАЛИЗАЦИЯ PEERJS ---
const peer = new Peer(undefined, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    debug: 3 // Включаем полный лог PeerJS в консоль
});

let myStream = null;
let audioCtx = null;

peer.on('open', (id) => {
    document.getElementById('my-peer-id').innerText = id;
    log(`Твой ID создан: ${id}`, 'system');
    log("Скопируй этот ID на второе устройство.");
});

peer.on('error', (err) => log(`Ошибка PeerJS: ${err.type}`, 'error'));

// --- РАБОТА С МИКРОФОНОМ ---
document.getElementById('mic-toggle').onclick = async function() {
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
        this.innerText = "ВКЛЮЧИТЬ МИКРОФОН";
        log("Микрофон остановлен", 'system');
        return;
    }

    try {
        log("Запрос доступа к микрофону...");
        myStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });
        
        this.innerText = "ВЫКЛЮЧИТЬ МИКРОФОН";
        log("Микрофон захвачен успешно!", 'mic-active');
        
        // Запуск визуализатора для себя
        startVisualizer(myStream, 'local-meter', 'local-status');
        
    } catch (e) {
        log(`Ошибка микрофона: ${e.message}`, 'error');
        alert("Браузер заблокировал микрофон. Проверь настройки разрешений!");
    }
};

// --- ОБРАБОТКА ЗВОНКОВ ---
// Когда КТО-ТО звонит НАМ
peer.on('call', (call) => {
    log(`Входящий звонок от: ${call.peer}. Отвечаю...`, 'system');
    call.answer(myStream); // Отвечаем (даже если myStream null, мы просто будем слушать)
    
    call.on('stream', (remoteStream) => {
        log("Поток от собеседника получен!", 'mic-active');
        handleRemoteStream(remoteStream, call.peer);
    });
});

// Когда МЫ звоним КОМУ-ТО
document.getElementById('connect-btn').onclick = () => {
    const targetId = document.getElementById('target-id').value;
    if (!targetId) return alert("Введите ID собеседника!");

    log(`Звоню на ID: ${targetId}...`, 'system');
    const call = peer.call(targetId, myStream);
    
    call.on('stream', (remoteStream) => {
        log("Собеседник ответил, поток идет!", 'mic-active');
        handleRemoteStream(remoteStream, targetId);
    });

    call.on('error', (e) => log(`Ошибка звонка: ${e}`, 'error'));
};

function handleRemoteStream(stream, peerId) {
    // 1. Создаем аудио элемент, чтобы СЛЫШАТЬ
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        document.getElementById('audio-dump').appendChild(audio);
    }
    audio.srcObject = stream;
    audio.play().catch(e => log(`Ошибка автоплея: ${e.message}`, 'error'));

    // 2. Запускаем визуализатор, чтобы ВИДЕТЬ уровень звука собеседника
    startVisualizer(stream, 'remote-meter', 'remote-status');
}

// --- ВИЗУАЛИЗАЦИЯ (Ядро анализа звука) ---
function startVisualizer(stream, elementId, statusId) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const meter = document.getElementById(elementId);
    const status = document.getElementById(statusId);

    function update() {
        if (!stream.active) {
            meter.style.width = '0%';
            status.innerText = "Поток неактивен";
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        
        // Считаем среднюю громкость
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        let average = sum / bufferLength;
        let volume = (average / 128) * 100; // Процент громкости

        meter.style.width = Math.min(volume * 1.5, 100) + '%';
        
        if (volume > 5) {
            status.innerText = "Голос обнаружен! (OK)";
            status.style.color = "#00ff41";
        } else {
            status.innerText = "Тишина (Проверьте мут на микрофоне)";
            status.style.color = "#aaa";
        }

        requestAnimationFrame(update);
    }
    function handleRemoteStream(stream, peerId) {
    log("Пытаюсь воспроизвести входящий поток...", 'system');
    
    let audio = document.getElementById(`audio-${peerId}`);
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        // ВАЖНО: Добавляем атрибуты для мобилок
        audio.setAttribute('autoplay', 'true');
        audio.setAttribute('playsinline', 'true');
        document.getElementById('audio-dump').appendChild(audio);
    }
    audio.srcObject = stream;
    
    // Принудительный запуск при клике, если автоплей заблокирован
    window.onclick = () => { audio.play(); log("Audio Context разбужен кликом!"); };
    
    startVisualizer(stream, 'remote-meter', 'remote-status');
}
    
    update();
}