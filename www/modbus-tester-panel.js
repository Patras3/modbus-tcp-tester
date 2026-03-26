import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

class ModbusTesterPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _devices: { type: Array },
      _logs: { type: Array },
      _scanning: { type: Boolean },
      _selectedDevice: { type: Object },
    };
  }

  constructor() {
    super();
    this._config = this._loadConfig();
    this._devices = [];
    this._logs = [];
    this._scanning = false;
    this._selectedDevice = null;
    this._eventListener = null;
  }

  _loadConfig() {
    const saved = localStorage.getItem("modbus_tester_config");
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      host: "",
      port: 502,
      start_id: 1,
      end_id: 100,
    };
  }

  _saveConfig() {
    localStorage.setItem("modbus_tester_config", JSON.stringify(this._config));
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribeEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._eventListener) {
      this._eventListener();
    }
  }

  _subscribeEvents() {
    this._eventListener = this.hass.connection.subscribeEvents((event) => {
      if (event.event_type === "modbus_tcp_tester_scan_started") {
        this._addLog("🚀 Scan started");
        this._scanning = true;
      } else if (event.event_type === "modbus_tcp_tester_scan_progress") {
        const { slave_id, progress } = event.data;
        this._addLog(`⏳ Testing Slave ${slave_id}... (${progress}%)`);
      } else if (event.event_type === "modbus_tcp_tester_device_found") {
        const device = event.data;
        this._addLog(
          `✅ Found ${device.type}: ${device.model} (Slave ${device.slave_id})`
        );
        this._devices = [...this._devices, device];
      } else if (event.event_type === "modbus_tcp_tester_scan_completed") {
        this._addLog(
          `✨ Scan completed! Found ${event.data.devices_found} device(s)`
        );
        this._scanning = false;
        this._devices = event.data.devices || [];
      }
    });
  }

  async _startScan() {
    if (!this._config.host) {
      this._addLog("❌ Please enter IP address first!");
      return;
    }

    this._logs = [];
    this._devices = [];
    this._scanning = true;
    this._saveConfig();
    this._addLog(`🔍 Starting scan of ${this._config.host}:${this._config.port}`);
    this._addLog(
      `📊 Range: Slave ${this._config.start_id} - ${this._config.end_id}`
    );

    try {
      await this.hass.callService("modbus_tcp_tester", "scan", {
        host: this._config.host,
        port: this._config.port,
        start_id: this._config.start_id,
        end_id: this._config.end_id,
      });
    } catch (err) {
      this._addLog(`❌ Error: ${err.message}`);
      this._scanning = false;
    }
  }

  async _stopScan() {
    try {
      await this.hass.callService("modbus_tcp_tester", "stop_scan");
      this._addLog("🛑 Scan stopped by user");
      this._scanning = false;
    } catch (err) {
      this._addLog(`❌ Error stopping scan: ${err.message}`);
    }
  }

  async _testConnection() {
    if (!this._config.host) {
      this._addLog("❌ Please enter IP address first!");
      return;
    }

    this._addLog(
      `🔌 Testing connection to ${this._config.host}:${this._config.port}...`
    );

    try {
      const result = await this.hass.callWS({
        type: "modbus_tcp_tester/test_connection",
        host: this._config.host,
        port: this._config.port,
      });

      if (result.ping) {
        this._addLog(`✅ Ping: OK`);
      } else {
        this._addLog(`❌ Ping: FAILED`);
      }

      if (result.port_open) {
        this._addLog(`✅ Port ${this._config.port}: OPEN`);
      } else {
        this._addLog(`❌ Port ${this._config.port}: CLOSED`);
      }

      if (result.modbus) {
        this._addLog(`✅ Modbus TCP: WORKING`);
      } else {
        this._addLog(`❌ Modbus TCP: NOT RESPONDING`);
      }
    } catch (err) {
      this._addLog(`❌ Connection test failed: ${err.message}`);
    }
  }

  _clearLogs() {
    this._logs = [];
  }

  _addLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    this._logs = [...this._logs, { time: timestamp, message }];
    setTimeout(() => {
      const logsContainer = this.shadowRoot.querySelector(".logs-container");
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }, 100);
  }

  async _readMoreRegisters(device) {
    this._addLog(`📖 Reading more data from Slave ${device.slave_id}...`);

    try {
      const result = await this.hass.callService("modbus_tcp_tester", "read_registers", {
        host: this._config.host,
        port: this._config.port,
        slave_id: device.slave_id,
        register: 30000,
        count: 50,
      });

      this._addLog(`✅ Sent read request for ${device.model}`);
      this._selectedDevice = { ...device, read_requested: true };
    } catch (err) {
      this._addLog(`❌ Error: ${err.message}`);
    }
  }

  _closeDeviceDetails() {
    this._selectedDevice = null;
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
  }

  render() {
    return html`
      <div class="panel-container">
        <div class="panel-header">
          <h1>🔍 Modbus TCP Tester</h1>
          <p>Dynamiczny tester urządzeń Modbus TCP (Huawei i inne)</p>
        </div>

        <!-- Configuration Section -->
        <div class="section">
          <div class="section-header">⚙️ Konfiguracja</div>
          <div class="config-grid">
            <div class="config-field">
              <label>IP Address *</label>
              <input
                type="text"
                .value=${this._config.host}
                @input=${(e) => this._updateConfig("host", e.target.value)}
                placeholder="192.168.2.5"
                ?disabled=${this._scanning}
              />
            </div>
            <div class="config-field">
              <label>Port</label>
              <input
                type="number"
                .value=${this._config.port}
                @input=${(e) => this._updateConfig("port", parseInt(e.target.value))}
                placeholder="502"
                ?disabled=${this._scanning}
              />
            </div>
            <div class="config-field">
              <label>Start Slave ID</label>
              <input
                type="number"
                .value=${this._config.start_id}
                @input=${(e) =>
                  this._updateConfig("start_id", parseInt(e.target.value))}
                min="1"
                max="247"
                ?disabled=${this._scanning}
              />
            </div>
            <div class="config-field">
              <label>End Slave ID</label>
              <input
                type="number"
                .value=${this._config.end_id}
                @input=${(e) => this._updateConfig("end_id", parseInt(e.target.value))}
                min="1"
                max="247"
                ?disabled=${this._scanning}
              />
            </div>
          </div>
          <div class="config-hint">
            💡 <strong>Wskazówka:</strong> Dla szybszego skanowania użyj mniejszego zakresu
            (np. 1-10 dla inverterów, 90-110 dla dongle)
          </div>
        </div>

        <!-- Actions -->
        <div class="section">
          <div class="actions">
            <mwc-button
              raised
              @click=${this._startScan}
              ?disabled=${this._scanning || !this._config.host}
            >
              ${this._scanning ? "⏳ Scanning..." : "🔍 Scan Now"}
            </mwc-button>
            <mwc-button @click=${this._stopScan} ?disabled=${!this._scanning}>
              ⏹️ Stop
            </mwc-button>
            <mwc-button
              @click=${this._testConnection}
              ?disabled=${this._scanning || !this._config.host}
            >
              🔌 Test Connection
            </mwc-button>
            <mwc-button @click=${this._clearLogs}> 🗑️ Clear Logs </mwc-button>
          </div>
        </div>

        <!-- Status -->
        ${this._config.host
          ? html`
              <div class="section">
                <div class="status-bar">
                  <span class="status-item">
                    <strong>Target:</strong> ${this._config.host}:${this._config.port}
                  </span>
                  <span class="status-item">
                    <strong>Range:</strong> ${this._config.start_id}-${this._config.end_id}
                  </span>
                  <span
                    class="status-item ${this._scanning ? "scanning" : "idle"}"
                  >
                    <strong>Status:</strong>
                    ${this._scanning ? "⏳ Scanning" : "✅ Ready"}
                  </span>
                  <span class="status-item">
                    <strong>Devices:</strong> ${this._devices.length}
                  </span>
                </div>
              </div>
            `
          : ""}

        <!-- Discovered Devices -->
        ${this._devices.length > 0
          ? html`
              <div class="section">
                <div class="section-header">
                  📊 Discovered Devices (${this._devices.length})
                </div>
                <div class="devices-container">
                  ${this._devices.map(
                    (device) => html`
                      <div class="device-card">
                        <div class="device-header">
                          <span class="device-icon"
                            >${this._getDeviceIcon(device.type)}</span
                          >
                          <span class="device-title">
                            Slave ${device.slave_id}: ${device.model || "Unknown"}
                          </span>
                        </div>
                        <div class="device-details">
                          <div class="device-detail">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${device.type}</span>
                          </div>
                          ${device.firmware
                            ? html`
                                <div class="device-detail">
                                  <span class="detail-label">Firmware:</span>
                                  <span class="detail-value">${device.firmware}</span>
                                </div>
                              `
                            : ""}
                          ${device.active_power !== undefined
                            ? html`
                                <div class="device-detail">
                                  <span class="detail-label">Power:</span>
                                  <span class="detail-value"
                                    >${device.active_power} W</span
                                  >
                                </div>
                              `
                            : ""}
                          ${device.grid_voltage_a !== undefined
                            ? html`
                                <div class="device-detail">
                                  <span class="detail-label">Voltage A:</span>
                                  <span class="detail-value"
                                    >${device.grid_voltage_a} V</span
                                  >
                                </div>
                              `
                            : ""}
                        </div>
                        <div class="device-actions">
                          <mwc-button
                            dense
                            @click=${() => this._readMoreRegisters(device)}
                          >
                            📖 Read More
                          </mwc-button>
                        </div>
                      </div>
                    `
                  )}
                </div>
              </div>
            `
          : ""}

        <!-- Logs -->
        <div class="section">
          <div class="section-header">📝 Logs</div>
          <div class="logs-container">
            ${this._logs.length === 0
              ? html`<div class="log-empty">
                  ${this._config.host
                    ? 'No logs yet. Click "Scan Now" to start.'
                    : "Enter IP address and configure scan parameters above."}
                </div>`
              : this._logs.map(
                  (log) => html`
                    <div class="log-entry">
                      <span class="log-time">[${log.time}]</span>
                      <span class="log-message">${log.message}</span>
                    </div>
                  `
                )}
          </div>
        </div>

        <!-- Device Details Dialog -->
        ${this._selectedDevice
          ? html`
              <div class="overlay" @click=${this._closeDeviceDetails}>
                <div class="dialog" @click=${(e) => e.stopPropagation()}>
                  <div class="dialog-header">
                    <h3>Device Details: ${this._selectedDevice.model}</h3>
                    <mwc-icon-button @click=${this._closeDeviceDetails}>
                      <ha-icon icon="mdi:close"></ha-icon>
                    </mwc-icon-button>
                  </div>
                  <div class="dialog-content">
                    <pre>${JSON.stringify(this._selectedDevice, null, 2)}</pre>
                  </div>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  _getDeviceIcon(type) {
    const icons = {
      inverter: "☀️",
      dongle: "📡",
      battery: "🔋",
      meter: "⚡",
      unknown: "❓",
    };
    return icons[type] || icons.unknown;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        background: var(--primary-background-color);
        min-height: 100vh;
        padding: 24px;
      }

      .panel-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .panel-header {
        margin-bottom: 32px;
      }

      .panel-header h1 {
        margin: 0 0 8px 0;
        font-size: 32px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .panel-header p {
        margin: 0;
        color: var(--secondary-text-color);
        font-size: 16px;
      }

      .section {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
        box-shadow: var(
          --ha-card-box-shadow,
          0 2px 4px rgba(0, 0, 0, 0.1)
        );
      }

      .section-header {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--primary-text-color);
      }

      .config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .config-field label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 6px;
        color: var(--primary-text-color);
      }

      .config-field input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        box-sizing: border-box;
      }

      .config-field input:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      .config-hint {
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 4px;
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .status-bar {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        padding: 16px;
        background: var(--secondary-background-color);
        border-radius: 6px;
      }

      .status-item {
        font-size: 14px;
      }

      .status-item.scanning {
        color: var(--warning-color);
      }

      .status-item.idle {
        color: var(--success-color);
      }

      .devices-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .device-card {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 16px;
        background: var(--card-background-color);
      }

      .device-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .device-icon {
        font-size: 28px;
      }

      .device-title {
        font-weight: 600;
        font-size: 16px;
      }

      .device-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }

      .device-detail {
        display: flex;
        gap: 12px;
        font-size: 14px;
      }

      .detail-label {
        color: var(--secondary-text-color);
        min-width: 100px;
      }

      .detail-value {
        font-weight: 500;
      }

      .device-actions {
        display: flex;
        gap: 8px;
      }

      .logs-container {
        max-height: 500px;
        overflow-y: auto;
        padding: 16px;
        background: var(--code-editor-background-color, #1e1e1e);
        border-radius: 4px;
        font-family: "Courier New", monospace;
        font-size: 13px;
      }

      .log-entry {
        margin-bottom: 6px;
        color: var(--primary-text-color);
      }

      .log-time {
        color: var(--secondary-text-color);
        margin-right: 8px;
      }

      .log-empty {
        color: var(--secondary-text-color);
        font-style: italic;
        text-align: center;
        padding: 32px;
      }

      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        background: var(--card-background-color);
        border-radius: 12px;
        padding: 24px;
        max-width: 700px;
        max-height: 85vh;
        overflow: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }

      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .dialog-header h3 {
        margin: 0;
        font-size: 20px;
      }

      .dialog-content pre {
        background: var(--code-editor-background-color, #1e1e1e);
        padding: 16px;
        border-radius: 6px;
        overflow: auto;
        font-size: 13px;
        line-height: 1.5;
      }
    `;
  }
}

customElements.define("modbus-tester-panel", ModbusTesterPanel);

// Auto-register as custom panel
if (!customElements.get("ha-panel-modbus-tester")) {
  customElements.define(
    "ha-panel-modbus-tester",
    class extends ModbusTesterPanel {}
  );
}
