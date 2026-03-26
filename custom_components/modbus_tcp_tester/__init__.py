"""Modbus TCP Tester integration for Home Assistant."""
import logging
import os
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.frontend import add_extra_js_url

from .api import ModbusTesterWebSocketAPI
from .const import DOMAIN
from .scanner import ModbusScanner

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Modbus TCP Tester component."""
    _LOGGER.info("Setting up Modbus TCP Tester (singleton mode)")
    
    hass.data.setdefault(DOMAIN, {})
    
    # Create a global scanner instance (no specific host yet - frontend will provide)
    scanner = ModbusScanner(hass=hass, host="", port=502)
    
    hass.data[DOMAIN]["scanner"] = scanner
    
    # Register WebSocket API
    api = ModbusTesterWebSocketAPI(hass, scanner)
    api.async_register()
    
    # Register services
    await async_register_services(hass, scanner)
    
    # Add JS to frontend
    await hass.http.async_register_static_paths([{
        "url": "/modbus-tester-panel.js",
        "path": os.path.join(os.path.dirname(__file__), "../../www/modbus-tester-panel.js"),
    }])
    
    add_extra_js_url(hass, "/modbus-tester-panel.js")
    
    # Register sidebar panel
    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="Modbus Tester",
        sidebar_icon="mdi:radar",
        frontend_url_path="modbus-tester",
        config={
            "_panel_custom": {
                "name": "modbus-tester-panel",
            }
        },
        require_admin=False,
    )
    
    _LOGGER.info("Modbus TCP Tester setup complete - panel added to sidebar")
    
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
        
        # Temporarily set scanner host/port
        scanner.host = host
        scanner.port = port
        
        result = await scanner.read_registers(
            slave_id=slave_id,
            register=register,
            count=count,
        )
        
        _LOGGER.info("Read registers result: %s", result)
    
    hass.services.async_register(DOMAIN, "scan", handle_scan)
    hass.services.async_register(DOMAIN, "stop_scan", handle_stop_scan)
    hass.services.async_register(DOMAIN, "read_registers", handle_read_registers)
