"""Modbus TCP Tester integration for Home Assistant."""
import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .api import ModbusTesterWebSocketAPI
from .const import DOMAIN
from .scanner import ModbusScanner

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Modbus TCP Tester component (YAML)."""
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
    
    # Register frontend panel
    await hass.http.async_register_static_paths(
        [
            {
                "url": "/modbus_tcp_tester_panel",
                "path": hass.config.path("www/modbus-tester-panel.js"),
            }
        ]
    )
    
    # Add panel to sidebar
    hass.data.setdefault("frontend_panels", {})
    hass.data["frontend_panels"]["modbus-tester"] = {
        "component_name": "custom",
        "sidebar_title": "Modbus Tester",
        "sidebar_icon": "mdi:radar",
        "url_path": "modbus-tester",
        "require_admin": False,
        "config": {
            "_panel_custom": {
                "name": "modbus-tester-panel",
                "js_url": "/modbus_tcp_tester_panel",
            }
        },
    }
    
    _LOGGER.info("Modbus TCP Tester setup complete - panel registered")
    
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop(entry.entry_id, None)
    
    # Remove panel
    hass.data.get("frontend_panels", {}).pop("modbus-tester", None)
    
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
