# Modbus TCP Tester for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

**Modbus TCP Tester** to integracja dla Home Assistant umożliwiająca skanowanie i testowanie urządzeń Modbus TCP, ze szczególnym uwzględnieniem urządzeń Huawei (falowniki, dongle, baterie, liczniki).

## 🎯 Funkcje

- ✅ Skanowanie slave ID (1-247, domyślnie 1-100)
- ✅ Automatyczne wykrywanie typu urządzenia (inverter, dongle, battery, meter)
- ✅ Test połączenia (ping, port, Modbus)
- ✅ Odczyt podstawowych parametrów (model, firmware, moc, napięcie)
- ✅ Panel kontrolny w sidebarze HA
- ✅ Logi w czasie rzeczywistym
- ✅ Rate limiting (nie spamuje sieci)
- ✅ Łatwa instalacja przez HACS

## 📦 Instalacja

### Przez HACS (zalecane)

1. Otwórz HACS → Integrations
2. Kliknij "Custom repositories" (trzy kropki w prawym górnym rogu)
3. Dodaj: `https://github.com/Patras3/modbus-tcp-tester`
4. Kategoria: **Integration**
5. Kliknij **Install**
6. Zrestartuj Home Assistant

### Ręcznie

1. Pobierz folder `custom_components/modbus_tcp_tester`
2. Skopiuj do `<config>/custom_components/modbus_tcp_tester`
3. Zrestartuj Home Assistant

## ⚙️ Konfiguracja

1. Settings → Devices & Services → **Add Integration**
2. Wyszukaj: **Modbus TCP Tester**
3. Podaj:
   - **IP Address**: np. `192.168.2.5` (adres dongle/invertera)
   - **Port**: `502` (lub `6607` dla nowszych firmware)
   - **Scan Range**: `1` do `100` (opcjonalnie do 247)
4. Kliknij **Submit**

## 🚀 Użycie

### Panel w sidebarze

Po zainstalowaniu pojawi się nowy panel w sidebarze HA: **🔍 Modbus Tester**

### Skanowanie urządzeń

1. Otwórz panel **Modbus Tester**
2. Kliknij **Scan Now**
3. Obserwuj logi w czasie rzeczywistym
4. Wykryte urządzenia pojawią się w sekcji **Discovered Devices**

### Usługi (Services)

#### `modbus_tcp_tester.scan`

Rozpocznij skanowanie:

```yaml
service: modbus_tcp_tester.scan
data:
  host: 192.168.2.5
  port: 502
  start_id: 1
  end_id: 100
```

#### `modbus_tcp_tester.stop_scan`

Zatrzymaj skanowanie:

```yaml
service: modbus_tcp_tester.stop_scan
```

#### `modbus_tcp_tester.read_registers`

Odczytaj surowe rejestry:

```yaml
service: modbus_tcp_tester.read_registers
data:
  slave_id: 1
  register: 30000
  count: 15
```

## 📊 Przykłady wykrytych urządzeń

### Falownik SUN2000

```
Slave ID: 1
Model: SUN2000-10KTL-M1
Firmware: V200R001C00SPC172
Type: inverter
Active Power: 5234 W
Grid Voltage A: 235.2 V
```

### Dongle SDongleA-05

```
Slave ID: 100
Model: SDongleA-05
Firmware: V200R022C10SPC300
Type: dongle
```

### Bateria LUNA2000

```
Slave ID: 1
Model: LUNA2000-15-S0
Type: battery
```

### Licznik DTSU666

```
Slave ID: 2
Model: DTSU666-H
Type: meter
```

## 🔧 Troubleshooting

### Brak połączenia

1. Sprawdź czy Modbus TCP jest włączony w urządzeniu (Settings → Communication → Modbus TCP)
2. Sprawdź port (502 lub 6607 — zależy od firmware)
3. Sprawdź firewall w routerze/urządzeniu
4. Spróbuj różnych slave ID (1, 0, 100)

### Wolne skanowanie

- Rate limiting: 0.05s delay między slave ID (domyślnie)
- Dla 100 slave ID → ~5 sekund
- To normalne — nie spamuje sieci!

### Nie znajduje urządzeń

1. Sprawdź czy używasz właściwego portu (502 vs 6607)
2. Spróbuj zmienić zakres skanowania (np. 1-10, potem 90-110)
3. Sprawdź logi HA (Settings → System → Logs)

## 📝 Wspierane urządzenia

**Huawei:**
- ✅ SUN2000 (inverters)
- ✅ SDongleA-05, EMMA (dongles)
- ✅ LUNA2000 (batteries)
- ✅ DTSU666, DDSU666 (meters)

**Inne urządzenia Modbus TCP:**
- ⚠️ Mogą być wykryte, ale bez szczegółów

## 🤝 Wkład

Zgłoszenia błędów i pull requesty mile widziane!

**Issues:** https://github.com/Patras3/modbus-tcp-tester/issues

## 📄 Licencja

MIT License

## ⭐ Autor

[@Patras3](https://github.com/Patras3)

---

**Jeśli pomogło — zostaw ⭐ na GitHubie!**
