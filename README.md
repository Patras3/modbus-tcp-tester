# Modbus TCP Tester for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

**Modbus TCP Tester** to dynamiczny tester urządzeń Modbus TCP dla Home Assistant, ze szczególnym uwzględnieniem urządzeń Huawei (falowniki, dongle, baterie, liczniki).

## 🎯 Funkcje

- ✅ **Panel w sidebarze** — natychmiastowy dostęp z głównego menu HA
- ✅ **Dynamiczna konfiguracja** — IP, port, zakres slave ID ustawiasz na bieżąco
- ✅ **Skanowanie slave ID** (1-247)
- ✅ **Automatyczne wykrywanie** typu urządzenia (inverter, dongle, battery, meter)
- ✅ **Test połączenia** (ping, port, Modbus)
- ✅ **Odczyt parametrów** (model, firmware, moc, napięcie)
- ✅ **Real-time logi**
- ✅ **Rate limiting** (nie spamuje sieci)
- ✅ **localStorage** — zapamiętuje ostatnie ustawienia

## 📦 Instalacja

### Przez HACS (zalecane)

1. Otwórz HACS → Integrations
2. Kliknij "Custom repositories" (trzy kropki w prawym górnym rogu)
3. Dodaj: `https://github.com/Patras3/modbus-tcp-tester`
4. Kategoria: **Integration**
5. Kliknij **Install**
6. Zrestartuj Home Assistant
7. **GOTOWE!** Panel pojawi się w sidebarze

### Ręcznie

1. Pobierz folder `custom_components/modbus_tcp_tester`
2. Skopiuj do `<config>/custom_components/modbus_tcp_tester`
3. Pobierz `www/modbus-tester-panel.js`
4. Skopiuj do `<config>/www/modbus-tester-panel.js`
5. Zrestartuj Home Assistant

## 🚀 Użycie

### 1. Otwórz panel

Po instalacji i restarcie HA, w **sidebarze** pojawi się nowa pozycja: **🔍 Modbus Tester**

### 2. Skonfiguruj

W panelu zobaczysz sekcję **Konfiguracja**:

- **IP Address:** `192.168.2.5` (adres Twojego dongle/invertera)
- **Port:** `502` (lub `6607` dla nowszych firmware)
- **Start Slave ID:** `1` (pierwsze ID do skanowania)
- **End Slave ID:** `100` (ostatnie ID do skanowania)

**Wszystko dynamiczne!** Możesz zmieniać na bieżąco.

### 3. Skanuj

1. Kliknij **🔍 Scan Now**
2. Obserwuj logi w czasie rzeczywistym
3. Wykryte urządzenia pojawią się w sekcji **Discovered Devices**

### 4. Testuj połączenie

Przed skanowaniem możesz kliknąć **🔌 Test Connection** żeby sprawdzić:
- ✅ Ping
- ✅ Port otwarty/zamknięty
- ✅ Modbus TCP odpowiada

## 📊 Przykłady wykrytych urządzeń

### Falownik SUN2000

```
☀️ Slave ID: 1
Model: SUN2000-10KTL-M1
Firmware: V200R001C00SPC172
Type: inverter
Active Power: 5234 W
Grid Voltage A: 235.2 V
```

### Dongle SDongleA-05

```
📡 Slave ID: 100
Model: SDongleA-05
Firmware: V200R022C10SPC300
Type: dongle
```

### Bateria LUNA2000

```
🔋 Slave ID: 1
Model: LUNA2000-15-S0
Type: battery
```

### Licznik DTSU666

```
⚡ Slave ID: 2
Model: DTSU666-H
Type: meter
```

## ⚙️ Usługi (Services)

### `modbus_tcp_tester.scan`

Rozpocznij skanowanie (np. z automatyzacji):

```yaml
service: modbus_tcp_tester.scan
data:
  host: 192.168.2.5
  port: 502
  start_id: 1
  end_id: 100
```

### `modbus_tcp_tester.stop_scan`

Zatrzymaj skanowanie:

```yaml
service: modbus_tcp_tester.stop_scan
```

### `modbus_tcp_tester.read_registers`

Odczytaj surowe rejestry:

```yaml
service: modbus_tcp_tester.read_registers
data:
  host: 192.168.2.5
  port: 502
  slave_id: 1
  register: 30000
  count: 15
```

## 🔧 Troubleshooting

### Panel nie pojawia się w sidebarze

1. Sprawdź czy integracja jest załadowana: Settings → System → Logs → filtruj `modbus_tcp_tester`
2. Hard refresh przeglądarki: Ctrl+Shift+R (Windows/Linux) lub Cmd+Shift+R (Mac)
3. Wyczyść cache przeglądarki

### Brak połączenia

1. Sprawdź czy Modbus TCP jest włączony w urządzeniu (Settings → Communication → Modbus TCP)
2. Sprawdź port (502 lub 6607 — zależy od firmware)
3. Sprawdź firewall w routerze/urządzeniu
4. Użyj **Test Connection** żeby zdiagnozować

### Wolne skanowanie

- Rate limiting: 0.05s delay między slave ID
- Dla 100 slave ID → ~5 sekund
- **To normalne** — nie spamuje sieci!
- Dla szybszego: zmniejsz zakres (np. 1-20)

### Nie znajduje urządzeń

1. Sprawdź czy używasz właściwego portu (502 vs 6607)
2. Spróbuj zmienić zakres (np. 1-10, potem 90-110)
3. Sprawdź logi HA (Settings → System → Logs)

## 💡 Wskazówki

### Szybkie skanowanie

**Dla inverterów i liczników:**
```
Start: 1
End: 10
```

**Dla dongle:**
```
Start: 90
End: 110
```

### localStorage

Twoje ostatnie ustawienia (IP, port, zakres) są zapisywane automatycznie w przeglądarce. Przy kolejnym otwarciu panelu zostaną przywrócone.

### Best practices

1. Najpierw użyj **Test Connection** żeby sprawdzić dostępność
2. Zacznij od małego zakresu (1-10)
3. Rozszerz jeśli potrzeba (1-50, 1-100)
4. Zapisz znalezione slave ID dla przyszłości

## 📝 Wspierane urządzenia

**Huawei:**
- ✅ SUN2000 (inverters)
- ✅ SDongleA-05, EMMA (dongles)
- ✅ LUNA2000 (batteries)
- ✅ DTSU666, DDSU666 (meters)

**Inne urządzenia Modbus TCP:**
- ⚠️ Mogą być wykryte, ale bez szczegółów

## 🔄 Changelog

### v1.1.0 (2026-03-26)

- ✅ **Sidebar panel** — natychmiastowy dostęp z głównego menu
- ✅ **Dynamiczna konfiguracja** — brak hardkodowanego IP/port
- ✅ **localStorage** — zapamiętuje ustawienia
- ✅ Usunięto config entry (integracja singleton)
- ✅ Lepszy UX dla testowania "na żywo"

### v1.0.0 (2026-03-26)

- 🎉 Initial release

## 🤝 Wkład

Zgłoszenia błędów i pull requesty mile widziane!

**Issues:** https://github.com/Patras3/modbus-tcp-tester/issues

## 📄 Licencja

MIT License

## ⭐ Autor

[@Patras3](https://github.com/Patras3)

---

**Jeśli pomogło — zostaw ⭐ na GitHubie!**
