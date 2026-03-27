# Modbus TCP Tester for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

**Modbus TCP Tester** to dynamiczny tester urządzeń Modbus TCP dla Home Assistant, ze szczególnym uwzględnieniem urządzeń Huawei (falowniki, dongle, baterie, liczniki).

## 🎯 Funkcje

- ✅ **Panel w sidebarze** — natychmiastowy dostęp z głównego menu HA
- ✅ **Dynamiczna konfiguracja** — IP, port, zakres slave ID ustawiasz na bieżąco
- ✅ **Skanowanie slave ID** (1-247)
- ✅ **Automatyczne wykrywanie** typu urządzenia (inverter, dongle, battery, meter)
- ✅ **Test połączenia** (ping, port, Modbus)
- ✅ **Loop mode** — ciągłe skanowanie przez X minut (diagnostyka stabilności)
- ✅ **Loop History** — historia iteracji z statusem połączenia
- ✅ **Mobile responsive** — działa na telefonie
- ✅ **SSL auto-detect** — ws:// lub wss:// w zależności od HTTPS
- ✅ **Real-time logi**
- ✅ **Rate limiting** z cooldown (jak huawei_solar)
- ✅ **localStorage** — zapamiętuje ostatnie ustawienia

## 📦 Instalacja

### Przez HACS (zalecane)

1. Otwórz HACS → Integrations
2. Kliknij menu (⋮) → **Custom repositories**
3. Dodaj: `https://github.com/Patras3/modbus-tcp-tester`
4. Kategoria: **Integration**
5. Znajdź "Modbus TCP Tester" i kliknij **Download**
6. **Zrestartuj Home Assistant**

### ⚠️ WAŻNE: Dodaj integrację!

**Po restarcie musisz jeszcze dodać integrację:**

1. Settings → Devices & Services
2. Kliknij **+ Add Integration**
3. Szukaj: **Modbus TCP Tester**
4. Kliknij i potwierdź

**Dopiero teraz** panel pojawi się w sidebarze! 🎉

### Ręcznie

```bash
cd /config/custom_components
curl -L https://github.com/Patras3/modbus-tcp-tester/archive/refs/tags/v1.3.0.tar.gz | tar xz
mv modbus-tcp-tester-1.3.0/custom_components/modbus_tcp_tester .
rm -rf modbus-tcp-tester-1.3.0
```

Potem restart HA i dodaj integrację jak wyżej.

## 🚀 Użycie

### 1. Otwórz panel

Po dodaniu integracji, w **sidebarze** pojawi się: **Modbus Tester**

### 2. Skonfiguruj

- **IP Address:** adres Twojego dongle/invertera
- **Port:** `502` (standard Modbus TCP)
- **Start/End Slave ID:** zakres do skanowania (domyślnie 1-10)
- **Loop (minuty):** 0 = wyłączony, 1-60 = ciągłe skanowanie

### 3. Skanuj

1. Kliknij **Scan Now**
2. Obserwuj logi w czasie rzeczywistym
3. Wykryte urządzenia pojawią się w **Discovered Devices**

### 4. Loop mode (diagnostyka stabilności)

Ustaw **Loop = 5** (minut) i kliknij Scan Now:
- Skanowanie powtarza się co ~15-20s
- **Loop History** pokazuje status każdej iteracji
- Ping ✅/❌ | Port ✅/❌ | Modbus ✅/❌ | Devices: X
- Idealne do testowania stabilności połączenia SDongle

## 📊 Przykłady wykrytych urządzeń

### Falownik SUN2000

```
☀️ Slave 1: SUN2000-10KTL-M1
   Typ: inverter
   Firmware: V200R001C00SPC172
   S/N: HV12345678901
```

### Loop History

```
#4  Ping ✅ | Port ✅ | Modbus ✅ | Devices: 1    02:06:40
#3  Ping ✅ | Port ✅ | Modbus ✅ | Devices: 1    02:06:26
#2  Ping ✅ | Port ✅ | Modbus ⚠️ | Devices: 0    02:06:03
#1  Ping ❌ | Port ❌ | Modbus ❌ | Devices: 0    02:05:50
```

## 🔧 Troubleshooting

### Panel nie pojawia się w sidebarze

**Najpierw:** Czy dodałeś integrację?
1. Settings → Devices & Services → + Add Integration
2. Szukaj "Modbus TCP Tester"

**Jeśli tak:** 
- Hard refresh: Ctrl+Shift+R
- Wyczyść cache przeglądarki
- Sprawdź logi: Settings → System → Logs → filtruj `modbus_tcp_tester`

### WebSocket error (SSL)

Jeśli widzisz "insecure WebSocket" błąd:
- Integracja automatycznie wykrywa HTTPS i używa wss://
- Zaktualizuj do najnowszej wersji

### Brak połączenia

1. Sprawdź czy Modbus TCP jest włączony w urządzeniu
2. Port 502 (standard) lub 6607 (niektóre firmware)
3. Firewall?
4. Użyj **Test Connection** żeby zdiagnozować

### Wolne/niestabilne połączenie

- SDongle obsługuje tylko 1 połączenie naraz
- Integracja używa cooldown 100ms między requestami
- Użyj **Loop mode** żeby monitorować stabilność

## 💡 Wskazówki

### Typowe Slave ID

| Urządzenie | Slave ID |
|------------|----------|
| Inverter   | 1        |
| Meter      | 2        |
| Battery    | 200      |
| Dongle     | nie odpowiada (bridge only) |

### Best practices

1. **Test Connection** przed skanowaniem
2. Zacznij od małego zakresu (1-10)
3. Użyj **Loop mode** do diagnostyki stabilności
4. SDongle potrzebuje ~2s cooldown między połączeniami

## 📝 Wspierane urządzenia

**Huawei:**
- ✅ SUN2000 (inverters)
- ✅ SDongleA-05, EMMA (dongles jako bridge)
- ✅ LUNA2000 (batteries)
- ✅ DTSU666, DDSU666 (meters)

**Inne urządzenia Modbus TCP:**
- ⚠️ Mogą być wykryte, ale bez szczegółów

## 🔄 Changelog

### v1.3.0 (2026-03-27)

- ✅ **Loop mode** — ciągłe skanowanie przez X minut
- ✅ **Loop History** — historia iteracji z statusem
- ✅ **SSL auto-detect** — automatyczny wss:// dla HTTPS
- ✅ **Mobile responsive** — działa na telefonie
- ✅ **Cooldown** jak huawei_solar (100ms między requestami)
- ✅ **Cache busting** — wymusza przeładowanie plików frontend
- ✅ Retry logic dla stabilności
- ✅ Persistent devices (nie znikają między iteracjami)

### v1.2.0 (2026-03-26)

- ✅ WebSocket API (zamiast REST)
- ✅ pymodbus 3.12+ kompatybilność
- ✅ Exponential backoff retry

### v1.1.0 (2026-03-26)

- ✅ Sidebar panel
- ✅ Dynamiczna konfiguracja
- ✅ localStorage

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
