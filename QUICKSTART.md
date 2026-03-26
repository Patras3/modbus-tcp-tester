# 🚀 Quick Start Guide

## Instalacja

### Przez HACS (zalecane)

1. **HACS → Integrations → Custom repositories**
2. URL: `https://github.com/Patras3/modbus-tcp-tester`
3. Category: **Integration**
4. **Install**
5. **Restart Home Assistant**
6. **GOTOWE!** Panel pojawi się w sidebarze

### Ręcznie

```bash
# Kopiuj integrację
scp -r custom_components/modbus_tcp_tester root@HA_IP:/config/custom_components/

# Kopiuj panel JS
scp www/modbus-tester-panel.js root@HA_IP:/config/www/

# Restart
ssh root@HA_IP "ha core restart"
```

---

## Pierwsze uruchomienie

### 1. Otwórz panel

W **sidebarze** HA zobaczysz nową pozycję: **🔍 Modbus Tester**

Kliknij!

### 2. Skonfiguruj

Zobaczysz formularz **Konfiguracja**:

```
IP Address:     192.168.2.5       [Wpisz IP dongle/invertera]
Port:           502                [Lub 6607 dla nowszych FW]
Start Slave ID: 1
End Slave ID:   100
```

### 3. Test połączenia (opcjonalnie)

Kliknij **🔌 Test Connection**

Zobaczysz:
```
[23:10:45] 🔌 Testing connection to 192.168.2.5:502...
[23:10:46] ✅ Ping: OK
[23:10:46] ✅ Port 502: OPEN
[23:10:47] ✅ Modbus TCP: WORKING
```

### 4. Skanuj!

Kliknij **🔍 Scan Now**

Obserwuj logi:
```
[23:10:50] 🔍 Starting scan of 192.168.2.5:502
[23:10:50] 📊 Range: Slave 1 - 100
[23:10:51] ⏳ Testing Slave 1... (1%)
[23:10:52] ✅ Found inverter: SUN2000-10KTL-M1 (Slave 1)
[23:10:53] ⏳ Testing Slave 100... (100%)
[23:10:54] ✅ Found dongle: SDongleA-05 (Slave 100)
[23:10:55] ✨ Scan completed! Found 2 device(s)
```

### 5. Zobacz urządzenia

Sekcja **Discovered Devices** pokaże:

```
☀️ Slave 1: SUN2000-10KTL-M1
   Type: inverter
   Firmware: V200R001C00SPC172
   Power: 5234 W
   Voltage A: 235.2 V
   [📖 Read More]

📡 Slave 100: SDongleA-05
   Type: dongle
   Firmware: V200R022C10SPC300
   [📖 Read More]
```

---

## Tipsy

### Szybkie skanowanie

**Dla inverterów/liczników:**
```
Start: 1
End: 10
```

**Dla dongle:**
```
Start: 90
End: 110
```

### Zapisywanie ustawień

Twoje ustawienia (IP, port, zakres) są **automatycznie zapisywane** w localStorage przeglądarki. Przy kolejnym otwarciu będą przywrócone!

### Różne porty

- **502** — standard Modbus TCP (starsze firmware)
- **6607** — nowsze firmware Huawei (≥ SPC124, grudzień 2021+)

Jeśli nie działa na 502, spróbuj 6607!

---

## Dla sąsiada (instalacja krok po kroku)

### 1. HACS

1. Otwórz **HACS** w Home Assistant
2. Kliknij **Integrations**
3. Kliknij **⋮** (trzy kropki) w prawym górnym rogu
4. Wybierz **Custom repositories**
5. Wklej: `https://github.com/Patras3/modbus-tcp-tester`
6. Category: **Integration**
7. Kliknij **Add**
8. Znajdź **Modbus TCP Tester** na liście
9. Kliknij **Install**
10. **Restart Home Assistant**

### 2. Panel

Po restarcie:
1. Sidebar → **🔍 Modbus Tester** (nowa pozycja!)
2. Wpisz IP dongle (np. `192.168.2.5`)
3. Port: `502`
4. Kliknij **Scan Now**

### 3. Gotowe!

Jeśli znalazło urządzenia → **działa!** 🎉

---

## Troubleshooting

### Panel nie widać

1. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) lub **Cmd+Shift+R** (Mac)
2. Wyczyść cache przeglądarki
3. Sprawdź logi: Settings → System → Logs → filtruj `modbus_tcp_tester`

### Connection Failed

1. Użyj **Test Connection** żeby zdiagnozować
2. Sprawdź czy Modbus TCP włączony w urządzeniu (Settings → Communication)
3. Spróbuj portu 6607 (jeśli 502 nie działa)

### No Devices Found

1. Zmniejsz zakres: najpierw 1-10
2. Jeśli dalej nic: spróbuj 90-110 (dongle)
3. Sprawdź slave ID w dokumentacji urządzenia

---

**Pytania? → GitHub Issues:** https://github.com/Patras3/modbus-tcp-tester/issues
