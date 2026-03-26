// Modbus TCP Tester Panel JavaScript

let scanning = false;
let devices = [];
let ws = null;
let wsMessageId = 10;

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
    try {
        if (parent && parent.document) {
            const hassToken = parent.document.querySelector('home-assistant')?.hass?.auth?.data?.access_token;
            if (hassToken) return hassToken;
        }
    } catch (e) {}
    
    const stored = localStorage.getItem('hassTokens');
    if (stored) {
        try {
            const tokens = JSON.parse(stored);
            return tokens.access_token || tokens;
        } catch (e) {}
    }
    
    return null;
}

// Send WebSocket command and wait for response
function sendWsCommand(type, data = {}) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not connected'));
            return;
        }
        
        const id = ++wsMessageId;
        // 60s timeout - test_connection can take up to 30s with retries
        const timeout = setTimeout(() => {
            reject(new Error('WebSocket timeout'));
        }, 60000);
        
        const handler = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id === id) {
                clearTimeout(timeout);
                ws.removeEventListener('message', handler);
                if (msg.success === false) {
                    reject(new Error(msg.error?.message || 'Unknown error'));
                } else {
                    resolve(msg.result);
                }
            }
        };
        
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, type, ...data }));
    });
}

// Connect to HA WebSocket
function connectWebSocket() {
    return new Promise((resolve, reject) => {
        const token = getToken();
        if (!token) {
            reject(new Error('Brak tokenu autoryzacji'));
            return;
        }
        
        ws = new WebSocket(`ws://${location.host}/api/websocket`);
        
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', access_token: token }));
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'auth_ok') {
                addLog('✅ WebSocket połączony', 'success');
                // Subscribe to events
                ws.send(JSON.stringify({ id: 1, type: 'subscribe_events', event_type: 'modbus_tcp_tester_scan_started' }));
                ws.send(JSON.stringify({ id: 2, type: 'subscribe_events', event_type: 'modbus_tcp_tester_scan_progress' }));
                ws.send(JSON.stringify({ id: 3, type: 'subscribe_events', event_type: 'modbus_tcp_tester_device_found' }));
                ws.send(JSON.stringify({ id: 4, type: 'subscribe_events', event_type: 'modbus_tcp_tester_scan_completed' }));
                resolve();
            }
            
            if (data.type === 'auth_invalid') {
                reject(new Error('Nieprawidłowy token'));
            }
            
            if (data.type === 'event') {
                handleEvent(data.event);
            }
        };
        
        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
            reject(err);
        };
        
        ws.onclose = () => {
            addLog('⚠️ WebSocket rozłączony', 'warning');
            ws = null;
        };
    });
}

// Handle HA events (live scan updates)
function handleEvent(event) {
    const type = event.event_type;
    const data = event.data;
    
    switch (type) {
        case 'modbus_tcp_tester_scan_started':
            addLog('🚀 Skanowanie rozpoczęte', 'success');
            break;
        case 'modbus_tcp_tester_scan_progress':
            // Show every slave with status
            const status = data.found ? '✅' : '❌';
            addLog(`${status} Slave ${data.slave_id}: ${data.result || 'no response'}`);
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

// Test Connection (real test via WebSocket)
async function testConnection() {
    const config = saveConfig();
    
    if (!config.host) {
        addLog('❌ Podaj adres IP!', 'error');
        return false;
    }
    
    addLog(`🔌 Testuję połączenie z ${config.host}:${config.port}...`);
    
    try {
        const result = await sendWsCommand('modbus_tcp_tester/test_connection', {
            host: config.host,
            port: config.port
        });
        
        // Log results
        addLog(result.ping ? '✅ Ping: OK' : '❌ Ping: FAILED', result.ping ? 'success' : 'error');
        addLog(result.port_open ? `✅ Port ${config.port}: OTWARTY` : `❌ Port ${config.port}: ZAMKNIĘTY`, result.port_open ? 'success' : 'error');
        
        if (result.port_open) {
            addLog(result.modbus ? '✅ Modbus TCP: ODPOWIADA' : '⚠️ Modbus TCP: Brak odpowiedzi', result.modbus ? 'success' : 'warning');
        }
        
        // Summary
        if (result.ping && result.port_open && result.modbus) {
            addLog('🎉 Połączenie działa poprawnie!', 'success');
            return true;
        } else if (result.port_open) {
            addLog('⚠️ Port otwarty, ale Modbus nie odpowiada', 'warning');
            return true; // Can still try scanning
        } else {
            addLog('❌ Połączenie nie działa', 'error');
            return false;
        }
    } catch (err) {
        addLog(`❌ Błąd testu: ${err.message}`, 'error');
        return false;
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
    
    addLog(`🔍 Rozpoczynam skanowanie ${config.host}:${config.port}`);
    addLog(`📊 Zakres: Slave ${config.start_id} - ${config.end_id}`);
    
    // First test connection
    addLog('🔌 Sprawdzam połączenie...');
    const connectionOk = await testConnection();
    
    if (!connectionOk) {
        addLog('❌ Połączenie nie działa - skanowanie przerwane!', 'error');
        return;
    }
    
    // Start actual scan
    setScanningState(true);
    addLog('🚀 Rozpoczynam skanowanie Slave ID...');
    
    try {
        await sendWsCommand('modbus_tcp_tester/start_scan', {
            host: config.host,
            port: config.port,
            start_id: config.start_id,
            end_id: config.end_id
        });
    } catch (err) {
        addLog(`❌ Błąd skanowania: ${err.message}`, 'error');
        setScanningState(false);
    }
}

// Stop scan
async function stopScan() {
    try {
        await sendWsCommand('modbus_tcp_tester/stop_scan', {});
        addLog('🛑 Skanowanie zatrzymane', 'warning');
        setScanningState(false);
    } catch (err) {
        addLog(`❌ Błąd zatrzymania: ${err.message}`, 'error');
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
        <div class="device-item ${device.type === 'error' ? 'device-error' : ''}">
            <div class="device-icon">${getDeviceIcon(device.type)}</div>
            <div class="device-info">
                <div class="device-title">Slave ${device.slave_id}: ${device.type === 'error' ? 'Responds with error' : (device.model || 'Unknown')}</div>
                <div class="device-details">
                    <div class="device-detail">
                        <span class="device-detail-label">Typ:</span>
                        <span class="device-detail-value">${device.type}</span>
                    </div>
                    ${device.error ? `
                    <div class="device-detail">
                        <span class="device-detail-label">Error:</span>
                        <span class="device-detail-value" style="color: #ff9800;">${device.error.substring(0, 50)}...</span>
                    </div>` : ''}
                    ${device.firmware ? `
                    <div class="device-detail">
                        <span class="device-detail-label">Firmware:</span>
                        <span class="device-detail-value">${device.firmware}</span>
                    </div>` : ''}
                    ${device.serial_number ? `
                    <div class="device-detail">
                        <span class="device-detail-label">S/N:</span>
                        <span class="device-detail-value">${device.serial_number}</span>
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
        error: '⚠️',
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
document.addEventListener('DOMContentLoaded', async () => {
    loadConfig();
    addLog('🔧 Panel Modbus TCP Tester ładowanie...');
    
    try {
        await connectWebSocket();
    } catch (err) {
        addLog(`❌ Błąd połączenia WebSocket: ${err.message}`, 'error');
    }
});
