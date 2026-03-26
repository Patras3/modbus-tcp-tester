# 🚀 Quick Start Guide

## Dla Ciebie (testowanie lokalne)

### 1. Instalacja w HA

```bash
# Kopiuj folder do HA
scp -r modbus-tcp-tester/custom_components/modbus_tcp_tester root@HA_IP:/config/custom_components/

# Restart HA
ssh root@HA_IP "ha core restart"
```

### 2. Konfiguracja

1. Settings → Devices & Services → Add Integration
2. Wyszukaj: **Modbus TCP Tester**
3. Podaj:
   - IP: `192.168.2.5` (Twój dongle/inverter)
   - Port: `502`
   - Range: `1` - `100`
4. Submit

### 3. Dodaj kartę Lovelace

**Opcja A: Przez UI**

1. Dashboard → Edit
2. Add Card → Manual card
3. Wklej:

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 1
end_id: 100
title: 🔍 Mój Scanner
```

**Opcja B: resources (lepsze dla HACS)**

W `configuration.yaml`:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/modbus-tester-card.js
      type: module
```

Kopiuj JS:

```bash
scp www/modbus-tester-card.js root@HA_IP:/config/www/
```

### 4. Test!

1. Otwórz dashboard
2. Kliknij **Scan Now**
3. Obserwuj logi
4. Sprawdź znalezione urządzenia

---

## Dla Sąsiada (instalacja przez HACS)

### Przygotowanie (jednorazowe)

1. Stwórz repo na GitHub: `Patras3/modbus-tcp-tester`
2. Push kod:

```bash
cd modbus-tcp-tester
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Patras3/modbus-tcp-tester.git
git push -u origin main
```

### Instalacja u sąsiada

1. HACS → Integrations → ⋮ (trzy kropki) → Custom repositories
2. URL: `https://github.com/Patras3/modbus-tcp-tester`
3. Category: **Integration**
4. Add
5. Search: **Modbus TCP Tester**
6. Install
7. Restart HA

### Konfiguracja u sąsiada

1. Settings → Devices & Services → Add Integration → Modbus TCP Tester
2. IP: (jego dongle/inverter IP)
3. Port: 502
4. Done!

### Użycie (proste!)

1. Dashboard → dodaj kartę (jak wyżej)
2. Kliknij **Scan Now**
3. Gotowe! Zobacz urządzenia

---

## Troubleshooting dla sąsiada

### "Cannot connect"

1. Sprawdź IP (ping z terminala HA)
2. Sprawdź czy Modbus TCP włączony w urządzeniu
3. Spróbuj portu 6607 (nowsze firmware)

### "No devices found"

1. Kliknij **Test Connection** najpierw
2. Jeśli port open ale Modbus fail → sprawdź slave ID ręcznie (spróbuj 1, 100)
3. Zmień zakres: najpierw 1-10, potem rozszerzaj

### "Scan too slow"

- To normalne! Rate limiting = 0.05s per slave ID
- 100 slave ID = ~5 sekund
- Dla szybszego: zmniejsz zakres (np. 1-20)

---

## Tips

**Dla Ciebie:**
- Testuj na własnym setupie najpierw
- Sprawdź czy wykrywa wszystkie urządzenia (inverter, dongle, meter, battery)
- Zbierz logi jeśli coś nie działa

**Dla sąsiada:**
- Podaj konkretny zakres slave ID (np. "spróbuj 1-10")
- Pokaż screeny z wykrytych urządzeń jako przykład
- Przygotuj FAQ z typowymi błędami

---

## Next Steps

**Po testach:**
1. Zgłoś bugi jeśli znajdziesz
2. Dodaj więcej rejestrów Modbus (jeśli potrzeba)
3. Opcjonalnie: dodaj auto-discovery dla HA (żeby urządzenia się same pojawiły)
4. Opcjonalnie: eksport do CSV/JSON

**Community:**
- Opublikuj na Home Assistant Community Forum
- Share na reddit.com/r/homeassistant
- Dodaj do Awesome Home Assistant list

---

**Pytania? Issues na GitHub!**
