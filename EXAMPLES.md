# Przykłady użycia

## Lovelace Card Configuration

### Podstawowa konfiguracja

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 1
end_id: 100
title: 🔍 Huawei Modbus Scanner
```

### Szybkie skanowanie (tylko popularne slave ID)

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 1
end_id: 10  # Tylko 1-10 (inverter zazwyczaj 1, dongle 100)
title: Quick Scan
```

### Scan dongle (port 6607, nowszy firmware)

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 6607  # Nowsze firmware używają 6607
start_id: 90
end_id: 110
title: Dongle Scanner
```

## Automatyzacje

### Auto-scan o 6:00 rano

```yaml
automation:
  - alias: "Modbus Daily Scan"
    trigger:
      - platform: time
        at: "06:00:00"
    action:
      - service: modbus_tcp_tester.scan
        data:
          host: 192.168.2.5
          port: 502
          start_id: 1
          end_id: 100
```

### Powiadomienie gdy znajdzie nowe urządzenie

```yaml
automation:
  - alias: "Notify New Modbus Device"
    trigger:
      - platform: event
        event_type: modbus_tcp_tester_device_found
    action:
      - service: notify.mobile_app
        data:
          title: "🔍 New Modbus Device Found"
          message: >
            Found {{ trigger.event.data.model }}
            (Slave {{ trigger.event.data.slave_id }})
            Type: {{ trigger.event.data.type }}
```

## Scripts

### Scan i zapisz do pliku

```yaml
script:
  scan_and_log:
    sequence:
      - service: modbus_tcp_tester.scan
        data:
          host: 192.168.2.5
          port: 502
          start_id: 1
          end_id: 100
      - delay: "00:02:00"  # Czekaj 2 min na zakończenie
      - service: logbook.log
        data:
          name: "Modbus Scan"
          message: "Scan completed"
```

### Read raw registers (dla zaawansowanych)

```yaml
script:
  read_inverter_power:
    sequence:
      - service: modbus_tcp_tester.read_registers
        data:
          slave_id: 1
          register: 32080  # Active power register
          count: 2
        response_variable: power_data
      - service: persistent_notification.create
        data:
          title: "Inverter Power"
          message: "Raw data: {{ power_data }}"
```

## Sensory

### Status scannera jako sensor

```yaml
sensor:
  - platform: template
    sensors:
      modbus_scanner_status:
        friendly_name: "Modbus Scanner"
        value_template: >
          {% set state = states('sensor.modbus_scanner_status') %}
          {{ state if state else 'Unknown' }}
        attribute_templates:
          devices_found: >
            {{ state_attr('sensor.modbus_scanner_status', 'devices_found') }}
```

## Dashboard Example

### Pełny dashboard dla diagnostyki

```yaml
title: Modbus Diagnostics
views:
  - title: Scanner
    path: scanner
    cards:
      - type: custom:modbus-tester-card
        host: 192.168.2.5
        port: 502
        start_id: 1
        end_id: 100

      - type: entities
        title: Scanner Status
        entities:
          - sensor.modbus_scanner_status

      - type: history-graph
        title: Scan History
        entities:
          - sensor.modbus_scanner_status
        hours_to_show: 24

      - type: button
        name: Quick Scan
        tap_action:
          action: call-service
          service: modbus_tcp_tester.scan
          service_data:
            host: 192.168.2.5
            port: 502
            start_id: 1
            end_id: 10
```

## Panel Configuration

### Dodaj panel do sidebara

W `configuration.yaml`:

```yaml
panel_custom:
  - name: modbus-tester
    sidebar_title: "Modbus Tester"
    sidebar_icon: mdi:radar
    url_path: modbus-tester
    module_url: /local/modbus-tester-card.js
    config:
      host: 192.168.2.5
      port: 502
```

## Tips & Tricks

### Szybkie znajdowanie slave ID dla sąsiada

1. Konfiguruj kartę z małym zakresem (1-10)
2. Sprawdź najczęstsze: 1 (inverter), 100 (dongle), 2 (meter)
3. Jeśli nie znajdzie, rozszerz do 1-50, potem 50-100

### Diagnozowanie problemów z połączeniem

1. Użyj "Test Connection" najpierw
2. Sprawdź ping, port, modbus osobno
3. Jeśli port zamknięty → sprawdź firewall
4. Jeśli Modbus nie odpowiada → sprawdź czy włączony w urządzeniu

### Best practices dla wielu urządzeń

Jeśli masz:
- Inverter (Slave 1)
- Battery (Slave 1)
- Meter (Slave 2)
- Dongle (Slave 100)

Skanuj 1-10 (urządzenia) + 90-110 (dongle)

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 1
end_id: 10
```

Potem:

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 90
end_id: 110
```
