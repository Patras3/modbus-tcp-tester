"""Modbus TCP Tester integration for Home Assistant."""
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .api import ModbusTesterWebSocketAPI
from .const import DOMAIN
from .scanner import ModbusScanner

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Modbus TCP Tester component."""
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Modbus TCP Tester from a config entry."""
    _LOGGER.info("Setting up Modbus TCP Tester for %s", entry.data["host"])
    
    # Create scanner instance
    scanner = ModbusScanner(
        hass=hass,
        host=entry.data["host"],
        port=entry.data.get("port", 502),
    )
    
    # Store scanner in hass.data
    hass.data[DOMAIN][entry.entry_id] = {
        "scanner": scanner,
    }
    
    # Register WebSocket API
    api = ModbusTesterWebSocketAPI(hass, scanner)
    api.async_register()
    
    # Register services
    await async_register_services(hass, scanner)
    
    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    
    return unload_ok


async def async_register_services(hass: HomeAssistant, scanner: ModbusScanner) -> None:
    """Register integration services."""
    
    async def handle_scan(call):
        """Handle scan service call."""
        host = call.data.get("host", scanner.host)
        port = call.data.get("port", scanner.port)
        start_id = call.data.get("start_id", 1)
        end_id = call.data.get("end_id", 100)
        
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
        slave_id = call.data.get("slave_id", 1)
        register = call.data.get("register", 30000)
        count = call.data.get("count", 10)
        
        result = await scanner.read_registers(
            slave_id=slave_id,
            register=register,
            count=count,
        )
        
        _LOGGER.info("Read registers result: %s", result)
    
    hass.services.async_register(DOMAIN, "scan", handle_scan)
    hass.services.async_register(DOMAIN, "stop_scan", handle_stop_scan)
    hass.services.async_register(DOMAIN, "read_registers", handle_read_registers)
