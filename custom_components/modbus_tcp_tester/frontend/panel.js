// Modbus TCP Tester Panel JavaScript

let scanning = false;
let devices = [];
let eventSource = null;

// Load saved config from localStorage
function loadConfig() {
    const saved = localStorage.getItem('modbus_tester_config');
    if (saved) {
        const config = JSON.parse(saved);
        document.getElementById('host').value = config.host || '';
        document.getElementById('port').value = config.port || 502;
        document.getElementById('start-id').value = config.start_id || 1;
        document.getElementById('end-id').value = config.end_id || 100;
    }
}

// Save config to localStorage
function saveConfig() {
    const config = {
        host: document.getElementById('host').value,
        port: parseInt(document.getElementById('port').value) || 502,
        start_id: parseInt(document.getElementById('start-id').value) || 1,
        end_id: parseInt(document.getElementById('end-id').value) || 100
    };
    localStorage.setItem('modbus_tester_config', JSON.stringify(config));
    return config;
}

// Get HA auth token
function getToken() {
    // Try parent window (iframe mode)
    try {
        if (parent && parent.document) {
            const hassToken = parent.document.querySelector('home-assistant')?.hass?.auth?.data?.access_token;
            if (hassToken) return hassToken;
        }
    } catch (e) {}
    
    // Try localStorage
    const stored = localStorage.getItem('hassTokens');
    if (stored) {
        try {
            const tokens = JSON.parse(stored);
            return tokens.access_token || tokens;
        } catch (e) {}
    }
    
    return null;
}

// Call HA service
async function callService(domain, service, data) {
    const token = getToken();
    const response = await fetch('/api/services/' + domain + '/' + service, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(data)
    });
    return response.ok;
}

// Subscribe to HA events
function subscribeEvents() {
    const token = getToken();
    if (!token) {
        addLog('⚠️ Brak tokenu autoryzacji - eventy nie będą działać', 'warning');
        return;
    }
    
    // Use WebSocket for real-time events
    const wsUrl = `ws://${location.host}/api/websocket`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'auth',
            access_token: token
        }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'auth_ok') {
            // Subscribe to modbus_tcp_tester events
            ws.send(JSON.stringify({
                id: 1,
                type: 'subscribe_events',
                event_type: 'modbus_tcp_tester_scan_started'
            }));
            ws.send(JSON.stringify({
                id: 2,
                type: 'subscribe_events',
                event_type: 'modbus_tcp_tester_scan_progress'
            }));
            ws.send(JSON.stringify({
                id: 3,
                type: 'subscribe_events',
                event_type: 'modbus_tcp_tester_device_found'
            }));
            ws.send(JSON.stringify({
                id: 4,
                type: 'subscribe_events',
                event_type: 'modbus_tcp_tester_scan_completed'
            }));
        }
        
        if (data.type === 'event') {
            handleEvent(data.event);
        }
    };
    
    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
    
    return ws;
}

// Handle HA events
function handleEvent(event) {
    const type = event.event_type;
    const data = event.data;
    
    switch (type) {
        case 'modbus_tcp_tester_scan_started':
            addLog('🚀 Skanowanie rozpoczęte', 'success');
            break;
            
        case 'modbus_tcp_tester_scan_progress':
            addLog(`⏳ Sprawdzam Slave ${data.slave_id}... (${data.progress}%)`);
            break;
            
        case 'modbus_tcp_tester_device_found':
            addLog(`✅ Znaleziono ${data.type}: ${data.model} (Slave ${data.slave_id})`, 'success');
            addDevice(data);
            break;
            
        case 'modbus_tcp_tester_scan_completed':
            addLog(`✨ Skanowanie zakończone! Znaleziono ${data.devices_found} urządzeń`, 'success');
            setScanningState(false);
            break;
    }
}

// Start scan
async function startScan() {
    const config = saveConfig();
    
    if (!config.host) {
        addLog('❌ Podaj adres IP!', 'error');
        return;
    }
    
    devices = [];
    updateDevicesList();
    clearLogs();
    
    addLog(`🔍 Rozpoczynam skanowanie ${config.host}:${config.port}`);
    addLog(`📊 Zakres: Slave ${config.start_id} - ${config.end_id}`);
    
    setScanningState(true);
    
    const success = await callService('modbus_tcp_tester', 'scan', {
        host: config.host,
        port: config.port,
        start_id: config.start_id,
        end_id: config.end_id
    });
    
    if (!success) {
        addLog('❌ Błąd wywołania serwisu scan', 'error');
        setScanningState(false);
    }
}

// Stop scan
async function stopScan() {
    await callService('modbus_tcp_tester', 'stop_scan', {});
    addLog('🛑 Skanowanie zatrzymane', 'warning');
    setScanningState(false);
}

// Test connection
async function testConnection() {
    const config = saveConfig();
    
    if (!config.host) {
        addLog('❌ Podaj adres IP!', 'error');
        return;
    }
    
    addLog(`🔌 Testuję połączenie z ${config.host}:${config.port}...`);
    
    // Simple ping test via service
    const success = await callService('modbus_tcp_tester', 'scan', {
        host: config.host,
        port: config.port,
        start_id: 1,
        end_id: 1  // Just test one slave
    });
    
    if (success) {
        addLog('✅ Serwis odpowiedział - połączenie działa!', 'success');
    } else {
        addLog('❌ Błąd połączenia', 'error');
    }
}

// Set scanning state
function setScanningState(isScanning) {
    scanning = isScanning;
    
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const btnScan = document.getElementById('btn-scan');
    const btnStop = document.getElementById('btn-stop');
    const inputs = document.querySelectorAll('.form-group input');
    
    if (isScanning) {
        statusDot.classList.add('scanning');
        statusText.textContent = 'Skanowanie...';
        btnScan.disabled = true;
        btnStop.disabled = false;
        inputs.forEach(i => i.disabled = true);
    } else {
        statusDot.classList.remove('scanning');
        statusText.textContent = 'Gotowy';
        btnScan.disabled = false;
        btnStop.disabled = true;
        inputs.forEach(i => i.disabled = false);
    }
}

// Add device to list
function addDevice(device) {
    devices.push(device);
    updateDevicesList();
}

// Update devices list UI
function updateDevicesList() {
    const container = document.getElementById('devices-list');
    const card = document.getElementById('devices-card');
    const count = document.getElementById('devices-count');
    
    count.textContent = devices.length;
    
    if (devices.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    
    container.innerHTML = devices.map(device => `
        <div class="device-item">
            <div class="device-icon">${getDeviceIcon(device.type)}</div>
            <div class="device-info">
                <div class="device-title">Slave ${device.slave_id}: ${device.model || 'Unknown'}</div>
                <div class="device-details">
                    <div class="device-detail">
                        <span class="device-detail-label">Typ:</span>
                        <span class="device-detail-value">${device.type}</span>
                    </div>
                    ${device.firmware ? `
                    <div class="device-detail">
                        <span class="device-detail-label">Firmware:</span>
                        <span class="device-detail-value">${device.firmware}</span>
                    </div>` : ''}
                    ${device.active_power !== undefined ? `
                    <div class="device-detail">
                        <span class="device-detail-label">Moc:</span>
                        <span class="device-detail-value">${device.active_power} W</span>
                    </div>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Get device icon
function getDeviceIcon(type) {
    const icons = {
        inverter: '☀️',
        dongle: '📡',
        battery: '🔋',
        meter: '⚡',
        unknown: '❓'
    };
    return icons[type] || icons.unknown;
}

// Add log entry
function addLog(message, type = '') {
    const container = document.getElementById('logs');
    const emptyMsg = container.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();
    
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (type) entry.classList.add('log-' + type);
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
}

// Clear logs
function clearLogs() {
    const container = document.getElementById('logs');
    container.innerHTML = '<div class="log-empty">Brak logów. Kliknij "Scan Now" aby rozpocząć.</div>';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    subscribeEvents();
    addLog('🔧 Panel Modbus TCP Tester załadowany', 'success');
});
