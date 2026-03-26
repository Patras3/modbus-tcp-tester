## Modbus TCP Tester for Home Assistant

Dynamiczny tester urządzeń Modbus TCP bezpośrednio z Home Assistant!

### 🎉 v1.1.0 — Sidebar Panel + Dynamic Config

**NOWE w tej wersji:**
- ✅ **Panel w sidebarze** — natychmiastowy dostęp z głównego menu
- ✅ **Dynamiczna konfiguracja** — IP, port, zakres ustawiasz na żywo (nie hardkodowane!)
- ✅ **localStorage** — zapamiętuje ostatnie ustawienia
- ✅ **Test Connection** — przed skanowaniem sprawdź dostępność

### Kluczowe funkcje

✅ **Automatyczne wykrywanie urządzeń** — skanuje slave ID i identyfikuje typ  
✅ **Wsparcie dla Huawei** — falowniki SUN2000, dongle SDongle/EMMA, baterie LUNA, liczniki DTSU666  
✅ **Test połączenia** — ping, port, Modbus TCP  
✅ **Panel w sidebarze** — bez potrzeby konfiguracji Lovelace  
✅ **Logi w czasie rzeczywistym** — obserwuj postęp na żywo  
✅ **Rate limiting** — bezpieczne dla urządzeń  
✅ **Usługi HA** — integracja z automatyzacjami  

### Instalacja

1. HACS → Integrations → Custom repositories
2. URL: `https://github.com/Patras3/modbus-tcp-tester`
3. Category: Integration
4. Install → Restart HA
5. **Sidebar → 🔍 Modbus Tester** (pojawi się automatycznie!)

### Użycie

1. Otwórz **🔍 Modbus Tester** w sidebarze
2. Wpisz IP urządzenia (np. 192.168.2.5)
3. Port: 502 (lub 6607)
4. Range: 1-100 (lub dostosuj)
5. Kliknij **Scan Now**

Twoje ustawienia są automatycznie zapisywane!

### Dla kogo?

- 🔧 Instalatorzy fotowoltaiki (diagnoza Huawei)
- 🏠 Użytkownicy Home Assistant (integracja solar)
- 🐛 Debugging Modbus TCP (znajdź slave ID!)
- 📊 Monitoring sieci Modbus

### Wsparcie

GitHub Issues: [Zgłoś problem](https://github.com/Patras3/modbus-tcp-tester/issues)

### Licencja

MIT — wolne do użytku!
