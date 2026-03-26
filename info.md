## Modbus TCP Tester for Home Assistant

Skanuj i testuj urządzenia Modbus TCP bezpośrednio z Home Assistant!

### Kluczowe funkcje

✅ **Automatyczne wykrywanie urządzeń** — skanuje slave ID i identyfikuje typ urządzenia  
✅ **Wsparcie dla Huawei** — falowniki SUN2000, dongle SDongle/EMMA, baterie LUNA, liczniki DTSU666  
✅ **Test połączenia** — sprawdza ping, port, i Modbus TCP  
✅ **Panel w sidebarze** — wygodny interfejs bez potrzeby konfiguracji Lovelace  
✅ **Logi w czasie rzeczywistym** — obserwuj postęp skanowania na żywo  
✅ **Rate limiting** — nie spamuje sieci, bezpieczne dla urządzeń  
✅ **Usługi HA** — integracja z automatyzacjami i skryptami  

### Instalacja

1. Dodaj repo do HACS jako Custom Repository
2. Install
3. Restart HA
4. Configuration → Add Integration → Modbus TCP Tester
5. Podaj IP i port urządzenia

### Przykład użycia

```yaml
type: custom:modbus-tester-card
host: 192.168.2.5
port: 502
start_id: 1
end_id: 100
```

### Dla kogo?

- 🔧 Instalatorzy fotowoltaiki (diagnoza urządzeń Huawei)
- 🏠 Użytkownicy Home Assistant (integracja solar)
- 🐛 Debugging Modbus TCP (znajdź slave ID!)
- 📊 Monitoring sieci Modbus

### Wsparcie

GitHub Issues: [Zgłoś problem](https://github.com/Patras3/modbus-tcp-tester/issues)

### Licencja

MIT — wolne do użytku!
