import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

class ModbusTesterCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _status: { type: Object },
      _devices: { type: Array },
      _logs: { type: Array },
      _scanning: { type: Boolean },
      _selectedDevice: { type: Object },
    };
  }

  constructor() {
    super();
    this._status = { host: "", port: 502, scanning: false, devices_count: 0 };
    this._devices = [];
    this._logs = [];
    this._scanning = false;
    this._selectedDevice = null;
    this._eventListener = null;
  }

  setConfig(config) {
    if (!config.host) {
      throw new Error("You need to define 'host' in configuration");
    }
    this.config = {
      host: config.host,
      port: config.port || 502,
      start_id: config.start_id || 1,
      end_id: config.end_id || 100,
      title: config.title || "🔍 Modbus TCP Tester",
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this._subscribeEvents();
    this._loadStatus();
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

  async _loadStatus() {
    try {
      const result = await this.hass.callWS({
        type: "modbus_tcp_tester/get_status",
      });
      this._status = result;
    } catch (err) {
      this._addLog(`❌ Error loading status: ${err.message}`);
    }
  }

  async _startScan() {
    this._logs = [];
    this._devices = [];
    this._scanning = true;
    this._addLog(`🔍 Starting scan of ${this.config.host}:${this.config.port}`);
    this._addLog(`📊 Range: Slave ${this.config.start_id} - ${this.config.end_id}`);

    try {
      await this.hass.callWS({
        type: "modbus_tcp_tester/start_scan",
        host: this.config.host,
        port: this.config.port,
        start_id: this.config.start_id,
        end_id: this.config.end_id,
      });
    } catch (err) {
      this._addLog(`❌ Error: ${err.message}`);
      this._scanning = false;
    }
  }

  async _stopScan() {
    try {
      await this.hass.callWS({
        type: "modbus_tcp_tester/stop_scan",
      });
      this._addLog("🛑 Scan stopped by user");
      this._scanning = false;
    } catch (err) {
      this._addLog(`❌ Error stopping scan: ${err.message}`);
    }
  }

  async _testConnection() {
    this._addLog(`🔌 Testing connection to ${this.config.host}:${this.config.port}...`);

    try {
      const result = await this.hass.callWS({
        type: "modbus_tcp_tester/test_connection",
        host: this.config.host,
        port: this.config.port,
      });

      if (result.ping) {
        this._addLog(`✅ Ping: OK`);
      } else {
        this._addLog(`❌ Ping: FAILED`);
      }

      if (result.port_open) {
        this._addLog(`✅ Port ${this.config.port}: OPEN`);
      } else {
        this._addLog(`❌ Port ${this.config.port}: CLOSED`);
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
    // Auto-scroll logs
    setTimeout(() => {
      const logsContainer = this.shadowRoot.querySelector(".logs-container");
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }, 100);
  }

  _showDeviceDetails(device) {
    this._selectedDevice = device;
  }

  _closeDeviceDetails() {
    this._selectedDevice = null;
  }

  async _readMoreRegisters(device) {
    this._addLog(`📖 Reading more data from Slave ${device.slave_id}...`);

    try {
      const result = await this.hass.callWS({
        type: "modbus_tcp_tester/read_registers",
        slave_id: device.slave_id,
        register: 30000,
        count: 50,
      });

      if (result.error) {
        this._addLog(`❌ Error reading: ${result.error}`);
      } else {
        this._addLog(`✅ Read ${result.count} registers from ${device.model}`);
        this._selectedDevice = { ...device, raw_registers: result };
      }
    } catch (err) {
      this._addLog(`❌ Error: ${err.message}`);
    }
  }

  render() {
    return html`
      <ha-card header="${this.config.title}">
        <div class="card-content">
          <!-- Connection Status -->
          <div class="section">
            <div class="section-header">📡 Connection Status</div>
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">IP:</span>
                <span class="status-value">${this.config.host}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Port:</span>
                <span class="status-value">${this.config.port}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Status:</span>
                <span class="status-value ${this._scanning ? "scanning" : "idle"}">
                  ${this._scanning ? "⏳ Scanning" : "✅ Idle"}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Devices:</span>
                <span class="status-value">${this._devices.length}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="section">
            <div class="actions">
              <mwc-button raised @click=${this._startScan} ?disabled=${this._scanning}>
                ${this._scanning ? "Scanning..." : "🔍 Scan Now"}
              </mwc-button>
              <mwc-button @click=${this._stopScan} ?disabled=${!this._scanning}>
                ⏹️ Stop
              </mwc-button>
              <mwc-button @click=${this._testConnection} ?disabled=${this._scanning}>
                🔌 Test Connection
              </mwc-button>
              <mwc-button @click=${this._clearLogs}>
                🗑️ Clear Logs
              </mwc-button>
            </div>
          </div>

          <!-- Discovered Devices -->
          ${this._devices.length > 0
            ? html`
                <div class="section">
                  <div class="section-header">📊 Discovered Devices (${this._devices.length})</div>
                  <div class="devices-container">
                    ${this._devices.map(
                      (device) => html`
                        <div class="device-card">
                          <div class="device-header">
                            <span class="device-icon">${this._getDeviceIcon(device.type)}</span>
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
                                    <span class="detail-value">${device.active_power} W</span>
                                  </div>
                                `
                              : ""}
                            ${device.grid_voltage_a !== undefined
                              ? html`
                                  <div class="device-detail">
                                    <span class="detail-label">Voltage A:</span>
                                    <span class="detail-value">${device.grid_voltage_a} V</span>
                                  </div>
                                `
                              : ""}
                          </div>
                          <div class="device-actions">
                            <mwc-button dense @click=${() => this._readMoreRegisters(device)}>
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
                ? html`<div class="log-empty">No logs yet. Click "Scan Now" to start.</div>`
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
        </div>

        <!-- Device Details Dialog -->
        ${this._selectedDevice
          ? html`
              <div class="overlay" @click=${this._closeDeviceDetails}>
                <div class="dialog" @click=${(e) => e.stopPropagation()}>
                  <div class="dialog-header">
                    <h3>Device Details: ${this._selectedDevice.model}</h3>
                    <mwc-icon-button @click=${this._closeDeviceDetails}>
                      <mdi:close></mdi:close>
                    </mwc-icon-button>
                  </div>
                  <div class="dialog-content">
                    <pre>${JSON.stringify(this._selectedDevice, null, 2)}</pre>
                  </div>
                </div>
              </div>
            `
          : ""}
      </ha-card>
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
      }

      .section {
        margin-bottom: 24px;
      }

      .section-header {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--primary-text-color);
      }

      .status-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 8px;
      }

      .status-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .status-label {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .status-value {
        font-size: 14px;
        font-weight: 500;
      }

      .status-value.scanning {
        color: var(--warning-color);
      }

      .status-value.idle {
        color: var(--success-color);
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .devices-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .device-card {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
        background: var(--card-background-color);
      }

      .device-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .device-icon {
        font-size: 24px;
      }

      .device-title {
        font-weight: 600;
        font-size: 14px;
      }

      .device-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
      }

      .device-detail {
        display: flex;
        gap: 8px;
        font-size: 13px;
      }

      .detail-label {
        color: var(--secondary-text-color);
        min-width: 80px;
      }

      .detail-value {
        font-weight: 500;
      }

      .device-actions {
        display: flex;
        gap: 8px;
      }

      .logs-container {
        max-height: 400px;
        overflow-y: auto;
        padding: 12px;
        background: var(--code-editor-background-color, #1e1e1e);
        border-radius: 4px;
        font-family: "Courier New", monospace;
        font-size: 12px;
      }

      .log-entry {
        margin-bottom: 4px;
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
        padding: 24px;
      }

      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .dialog {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        max-height: 80vh;
        overflow: auto;
      }

      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .dialog-content pre {
        background: var(--code-editor-background-color, #1e1e1e);
        padding: 12px;
        border-radius: 4px;
        overflow: auto;
        font-size: 12px;
      }
    `;
  }
}

customElements.define("modbus-tester-card", ModbusTesterCard);
