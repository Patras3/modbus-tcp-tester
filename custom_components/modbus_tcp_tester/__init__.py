"""Modbus TCP Tester integration for Home Assistant."""
import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .api import ModbusTesterWebSocketAPI
from .const import DOMAIN
from .scanner import ModbusScanner

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

PANEL_URL_PATH = DOMAIN
PANEL_TITLE = "Modbus Tester"
PANEL_ICON = "mdi:radar"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Modbus TCP Tester component (YAML)."""
    # Register static path for panel JS
    panel_path = Path(__file__).parent.parent.parent / "www"
    
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path=f"/{DOMAIN}_panel",
            path=str(panel_path / "modbus-tester-panel.js"),
            cache_headers=False
        )
    ])
    
    _LOGGER.info("Modbus TCP Tester panel JS registered at /%s_panel", DOMAIN)
    
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Modbus TCP Tester from a config entry."""
    _LOGGER.info("Setting up Modbus TCP Tester")
    
    # Create a global scanner instance
    scanner = ModbusScanner(hass=hass, host="", port=502)
    
    hass.data[DOMAIN][entry.entry_id] = {
        "scanner": scanner,
    }
    
    # Register WebSocket API
    api = ModbusTesterWebSocketAPI(hass, scanner)
    api.async_register()
    
    # Register services
    await async_register_services(hass, scanner)
    
    # Register sidebar panel (iframe pointing to custom element)
    panel_url = f"/{DOMAIN}_panel"
    
    frontend.async_register_built_in_panel(
        hass,
        component_name="iframe",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=PANEL_URL_PATH,
        config={"url": panel_url},
        require_admin=False,
    )
    
    _LOGGER.info("Modbus TCP Tester panel registered in sidebar")
    
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id, None)
    
    # Remove sidebar panel
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    _LOGGER.info("Modbus TCP Tester panel removed from sidebar")
    
    return True


async def async_register_services(hass: HomeAssistant, scanner: ModbusScanner) -> None:
    """Register integration services."""
    
    async def handle_scan(call):
        """Handle scan service call."""
        host = call.data.get("host")
        port = call.data.get("port", 502)
        start_id = call.data.get("start_id", 1)
        end_id = call.data.get("end_id", 100)
        
        if not host:
            _LOGGER.error("Scan service requires 'host' parameter")
            return
        
        await scanner.start_scan(
            host=host,
            port=port,
            start_id=start_id,
            end_id=end_id,
        )
    
    async def handle_stop_scan(call):
        """Handle stop scan service call."""
        scanner.stop_scan()
    
    async def handle_read_registers(call):
        """Handle read registers service call."""
        host = call.data.get("host")
        port = call.data.get("port", 502)
        slave_id = call.data.get("slave_id", 1)
        register = call.data.get("register", 30000)
        count = call.data.get("count", 10)
        
        if not host:
            _LOGGER.error("Read registers service requires 'host' parameter")
            return
        
        scanner.host = host
        scanner.port = port
        
        result = await scanner.read_registers(
            slave_id=slave_id,
            register=register,
            count=count,
        )
        
        _LOGGER.info("Read registers result: %s", result)
    
    # Register services only once
    if not hass.services.has_service(DOMAIN, "scan"):
        hass.services.async_register(DOMAIN, "scan", handle_scan)
    
    if not hass.services.has_service(DOMAIN, "stop_scan"):
        hass.services.async_register(DOMAIN, "stop_scan", handle_stop_scan)
    
    if not hass.services.has_service(DOMAIN, "read_registers"):
        hass.services.async_register(DOMAIN, "read_registers", handle_read_registers)
