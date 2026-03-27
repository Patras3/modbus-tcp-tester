// Modbus TCP Tester Panel JavaScript

let scanning = false;
let devices = [];
let ws = null;
let wsMessageId = 10;
let loopEndTime = null;  // When loop should stop
let loopIteration = 0;   // Current loop iteration
let loopHistory = [];    // History of loop iterations
let autoAddRetryEndTime = null;  // When to stop auto-add retry
let autoAddAttempt = 0;  // Current auto-add attempt

// Load saved config from localStorage
function loadConfig() {
    const saved = localStorage.getItem('modbus_tester_config');
    if (saved) {
        const config = JSON.parse(saved);
        document.getElementById('host').value = config.host || '';
        document.getElementById('port').value = config.port || 502;
        document.getElementById('start-id').value = config.start_id || 1;
        document.getElementById('end-id').value = config.end_id || 10;
    }
}

// Save config to localStorage
function saveConfig() {
    const config = {
        host: document.getElementById('host').value,
        port: parseInt(document.getElementById('port').value) || 502,
        start_id: parseInt(document.getElementById('start-id').value) || 1,
        end_id: parseInt(document.getElementById('end-id').value) || 10
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
        
        // Auto-detect SSL: use wss:// for HTTPS, ws:// for HTTP
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${wsProtocol}//${location.host}/api/websocket`);
        
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
            if (data.found) {
                addLog(`✅ Slave ${data.slave_id}: ${data.result || 'found'}`, 'success');
            } else if (data.result && data.result.startsWith('error:')) {
                addLog(`⚠️ Slave ${data.slave_id}: ${data.result}`, 'warning');
            } else {
                addLog(`❌ Slave ${data.slave_id}: ${data.result || 'no response'}`);
            }
            break;
        case 'modbus_tcp_tester_device_found':
            addLog(`✅ Znaleziono ${data.type}: ${data.model} (Slave ${data.slave_id})`, 'success');
            addDevice(data);
            
            // Try auto-add to Huawei Solar (only for inverter type)
            if (data.type === 'inverter') {
                const config = saveConfig();
                tryAddHuaweiSolar(config.host, config.port, data.slave_id);
            }
            break;
        case 'modbus_tcp_tester_scan_completed':
            addLog(`✨ Iteracja #${loopIteration} zakończona! Znaleziono ${data.devices_found} urządzeń`, 'success');
            setScanningState(false);
            
            // Add loop history entry
            if (loopEndTime && window._currentLoopConnResult) {
                const conn = window._currentLoopConnResult;
                addLoopEntry(loopIteration, conn.ping, conn.port, conn.modbus, data.devices_found);
            }
            
            // Check loop mode with time
            if (loopEndTime && Date.now() < loopEndTime) {
                const remainingMs = loopEndTime - Date.now();
                const remainingSec = Math.ceil(remainingMs / 1000);
                const remainingMin = Math.floor(remainingSec / 60);
                const remainingSecMod = remainingSec % 60;
                addLog(`🔁 Loop: pozostało ${remainingMin}m ${remainingSecMod}s - restart za 2s...`, 'warning');
                setTimeout(() => {
                    if (loopEndTime && Date.now() < loopEndTime) {
                        startScan(true);  // true = loop continuation
                    } else {
                        addLog('🏁 Loop zakończony!', 'success');
                        loopEndTime = null;
                        loopIteration = 0;
                    }
                }, 2000);
            } else if (loopEndTime) {
                addLog('🏁 Loop zakończony (czas minął)!', 'success');
                loopEndTime = null;
                loopIteration = 0;
            }
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
        
        // Compact status line for loop diagnostics
        const pingIcon = result.ping ? '✅' : '❌';
        const portIcon = result.port_open ? '✅' : '❌';
        const modbusIcon = result.modbus ? '✅' : (result.port_open ? '⚠️' : '❌');
        const statusClass = (result.ping && result.port_open && result.modbus) ? 'success' : 
                           (result.port_open ? 'warning' : 'error');
        addLog(`📡 Status: Ping ${pingIcon} | Port ${portIcon} | Modbus ${modbusIcon}`, statusClass);
        
        // Return full result for loop history
        if (result.ping && result.port_open && result.modbus) {
            return { ok: true, ping: true, port: true, modbus: true };
        } else if (result.port_open) {
            addLog('⚠️ Port otwarty, ale Modbus nie odpowiada - próbuję skanować...', 'warning');
            return { ok: true, ping: result.ping, port: true, modbus: false };
        } else {
            addLog('❌ Połączenie nie działa!', 'error');
            return { ok: false, ping: result.ping, port: false, modbus: false };
        }
    } catch (err) {
        addLog(`❌ Błąd testu: ${err.message}`, 'error');
        return { ok: false, ping: false, port: false, modbus: false };
    }
}

// Scan ports
async function scanPorts() {
    const config = saveConfig();
    
    if (!config.host) {
        addLog('❌ Podaj adres IP!', 'error');
        return;
    }
    
    // Parse port input
    const portInput = document.getElementById('port-scan')?.value?.trim() || '';
    let ports = null;  // null = default ports
    
    if (portInput) {
        if (portInput.includes('-')) {
            // Range: 500-510
            const [start, end] = portInput.split('-').map(p => parseInt(p.trim()));
            if (!isNaN(start) && !isNaN(end) && start <= end && start > 0 && end <= 65535) {
                ports = [];
                for (let p = start; p <= end; p++) {
                    ports.push(p);
                }
                addLog(`🔍 Skanowanie portów ${start}-${end} na ${config.host}...`);
            } else {
                addLog('❌ Nieprawidłowy zakres portów!', 'error');
                return;
            }
        } else {
            // Single port or comma-separated
            ports = portInput.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
            if (ports.length === 0) {
                addLog('❌ Nieprawidłowy port!', 'error');
                return;
            }
            addLog(`🔍 Skanowanie portów ${ports.join(', ')} na ${config.host}...`);
        }
    } else {
        addLog(`🔍 Skanowanie portów na ${config.host}...`);
        addLog('📋 Porty: 22, 23, 80, 443, 502, 1502, 4196, 5000, 6607, 8080, 8443, 8899');
    }
    
    try {
        const result = await sendWsCommand('modbus_tcp_tester/scan_ports', {
            host: config.host,
            ports: ports
        });
        
        if (result.open_ports && result.open_ports.length > 0) {
            addLog(`✅ Otwarte porty: ${result.open_ports.join(', ')}`, 'success');
            
            // Show port details
            result.open_ports.forEach(port => {
                const portNames = {
                    22: 'SSH',
                    23: 'Telnet',
                    80: 'HTTP',
                    443: 'HTTPS',
                    502: 'Modbus TCP',
                    1502: 'Modbus TCP Alt',
                    4196: 'Huawei API',
                    5000: 'API',
                    6607: 'SDongle Modbus',
                    8080: 'HTTP Alt',
                    8443: 'HTTPS Alt',
                    8899: 'Huawei'
                };
                const name = portNames[port] || 'Unknown';
                addLog(`   🟢 Port ${port}: ${name}`, 'success');
            });
        } else {
            addLog('❌ Nie znaleziono otwartych portów!', 'error');
        }
    } catch (err) {
        addLog(`❌ Błąd skanowania portów: ${err.message}`, 'error');
    }
}

// Start scan
async function startScan(isLoopContinuation = false) {
    const config = saveConfig();
    
    if (!config.host) {
        addLog('❌ Podaj adres IP!', 'error');
        return;
    }
    
    // Get loop minutes
    const loopMinutes = parseInt(document.getElementById('loop-minutes')?.value) || 0;
    
    // First scan in loop - set end time and clear devices/history
    if (!isLoopContinuation) {
        devices = [];
        loopHistory = [];
        updateDevicesList();
        updateLoopsList();
        loopIteration = 0;
        
        if (loopMinutes > 0) {
            loopEndTime = Date.now() + (loopMinutes * 60 * 1000);
            addLog(`🔁 Loop mode: ${loopMinutes} minut`, 'warning');
        } else {
            loopEndTime = null;
        }
    }
    // Loop continuation - keep devices (persistent)
    
    loopIteration++;
    addLog(`🔍 Iteracja #${loopIteration}: ${config.host}:${config.port} (Slave ${config.start_id}-${config.end_id})`);
    
    // Test connection (logs status automatically, returns {ok, ping, port, modbus})
    const connResult = await testConnection();
    
    // Store connection result for loop history (will be completed after scan)
    window._currentLoopConnResult = connResult;
    
    if (!connResult.ok) {
        // Add loop entry for failed connection
        if (loopEndTime) {
            addLoopEntry(loopIteration, connResult.ping, connResult.port, connResult.modbus, 0);
        }
        
        // In loop mode - don't stop, just log and continue to next iteration
        if (loopEndTime && Date.now() < loopEndTime) {
            const remainingMs = loopEndTime - Date.now();
            const remainingSec = Math.ceil(remainingMs / 1000);
            addLog(`🔁 Loop: połączenie fail, retry za 5s... (${Math.floor(remainingSec/60)}m ${remainingSec%60}s pozostało)`, 'warning');
            setTimeout(() => {
                if (loopEndTime && Date.now() < loopEndTime) {
                    startScan(true);
                }
            }, 5000);
            return;
        }
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
    // Stop loop
    loopEndTime = null;
    loopIteration = 0;
    
    try {
        await sendWsCommand('modbus_tcp_tester/stop_scan', {});
        addLog('🛑 Skanowanie i loop zatrzymane', 'warning');
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

// Add device to list (no duplicates - update if exists)
function addDevice(device) {
    const existingIdx = devices.findIndex(d => d.slave_id === device.slave_id);
    if (existingIdx >= 0) {
        // Update existing device (refresh data)
        devices[existingIdx] = { ...devices[existingIdx], ...device, lastSeen: Date.now() };
    } else {
        // New device
        devices.push({ ...device, lastSeen: Date.now() });
    }
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

// Add loop history entry
function addLoopEntry(iteration, pingOk, portOk, modbusOk, devicesFound) {
    const now = new Date();
    const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const entry = {
        iteration,
        ping: pingOk,
        port: portOk,
        modbus: modbusOk,
        devices: devicesFound,
        time,
        status: (pingOk && portOk && modbusOk) ? 'success' : (portOk ? 'warning' : 'error')
    };
    
    loopHistory.push(entry);
    updateLoopsList();
}

// Update loops list UI
function updateLoopsList() {
    const container = document.getElementById('loops-list');
    const card = document.getElementById('loops-card');
    const count = document.getElementById('loops-count');
    
    count.textContent = loopHistory.length;
    
    if (loopHistory.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    
    // Show newest first
    container.innerHTML = loopHistory.slice().reverse().map(entry => {
        const pingIcon = entry.ping ? '✅' : '❌';
        const portIcon = entry.port ? '✅' : '❌';
        const modbusIcon = entry.modbus ? '✅' : (entry.port ? '⚠️' : '❌');
        
        return `
            <div class="loop-entry ${entry.status}">
                <span class="loop-num">#${entry.iteration}</span>
                <span class="loop-status">Ping ${pingIcon} | Port ${portIcon} | Modbus ${modbusIcon} | Devices: ${entry.devices}</span>
                <span class="loop-time">${entry.time}</span>
            </div>
        `;
    }).join('');
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

// Toggle retry duration visibility
function updateAutoAddUI() {
    const autoAdd = document.getElementById('auto-add')?.value || 'off';
    const retryGroup = document.getElementById('retry-duration-group');
    if (retryGroup) {
        retryGroup.style.display = (autoAdd === 'auto') ? 'block' : 'none';
    }
}

// Try to add Huawei Solar integration
async function tryAddHuaweiSolar(host, port, slaveId) {
    const autoAdd = document.getElementById('auto-add')?.value || 'off';
    
    if (autoAdd === 'off') return;
    
    if (autoAdd === 'manual') {
        // Just show link to config flow
        const configUrl = `/config/integrations/integration/huawei_solar`;
        addLog(`🔗 Otwórz config flow: <a href="${configUrl}" target="_blank">Huawei Solar</a>`, 'success');
        addLog(`📋 Host: ${host}, Port: ${port}, Slave: ${slaveId}`);
        return;
    }
    
    // Auto mode - brute-force retry
    const retryMinutes = parseInt(document.getElementById('retry-duration')?.value) || 5;
    autoAddRetryEndTime = Date.now() + (retryMinutes * 60 * 1000);
    autoAddAttempt = 0;
    
    addLog(`🔄 Auto-add Huawei Solar: próbuję przez ${retryMinutes} minut...`, 'warning');
    
    await doAutoAddAttempt(host, port, slaveId);
}

// Single auto-add attempt
async function doAutoAddAttempt(host, port, slaveId) {
    if (!autoAddRetryEndTime || Date.now() > autoAddRetryEndTime) {
        addLog('⏱️ Auto-add timeout - czas minął', 'error');
        autoAddRetryEndTime = null;
        return;
    }
    
    autoAddAttempt++;
    const remainingSec = Math.ceil((autoAddRetryEndTime - Date.now()) / 1000);
    addLog(`🔄 Auto-add próba #${autoAddAttempt} (${Math.floor(remainingSec/60)}m ${remainingSec%60}s pozostało)...`);
    
    try {
        const result = await sendWsCommand('modbus_tcp_tester/add_huawei_solar', {
            host: host,
            port: port,
            slave_id: slaveId
        });
        
        if (result.success) {
            addLog(`✅ Huawei Solar dodany pomyślnie!`, 'success');
            autoAddRetryEndTime = null;
            return;
        } else {
            addLog(`❌ Błąd: ${result.error || 'unknown'}`, 'error');
        }
    } catch (err) {
        addLog(`❌ Błąd: ${err.message}`, 'error');
    }
    
    // Retry after 10 seconds
    if (autoAddRetryEndTime && Date.now() < autoAddRetryEndTime) {
        addLog('⏳ Retry za 10s...', 'warning');
        setTimeout(() => doAutoAddAttempt(host, port, slaveId), 10000);
    }
}

// Stop auto-add
function stopAutoAdd() {
    autoAddRetryEndTime = null;
    addLog('🛑 Auto-add zatrzymany', 'warning');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadConfig();
    addLog('🔧 Panel Modbus TCP Tester ładowanie...');
    
    // Setup auto-add UI toggle
    const autoAddSelect = document.getElementById('auto-add');
    if (autoAddSelect) {
        autoAddSelect.addEventListener('change', updateAutoAddUI);
        updateAutoAddUI();
    }
    
    try {
        await connectWebSocket();
    } catch (err) {
        addLog(`❌ Błąd połączenia WebSocket: ${err.message}`, 'error');
    }
});
