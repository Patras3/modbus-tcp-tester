"""WebSocket API for Modbus TCP Tester."""
import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Global scanner reference (set in __init__.py)
_scanner = None


def set_scanner(scanner):
    """Set the scanner instance for WebSocket handlers."""
    global _scanner
    _scanner = scanner


def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register all WebSocket commands."""
    websocket_api.async_register_command(hass, ws_test_connection)
    websocket_api.async_register_command(hass, ws_start_scan)
    websocket_api.async_register_command(hass, ws_stop_scan)
    websocket_api.async_register_command(hass, ws_get_devices)
    websocket_api.async_register_command(hass, ws_read_registers)
    _LOGGER.info("Modbus TCP Tester WebSocket API registered")


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/test_connection",
    vol.Required("host"): str,
    vol.Optional("port", default=502): int,
})
@websocket_api.async_response
async def ws_test_connection(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Test connection to Modbus TCP host (ping, port, modbus)."""
    host = msg["host"]
    port = msg.get("port", 502)
    
    _LOGGER.info("WebSocket: Testing connection to %s:%d", host, port)
    
    if _scanner is None:
        connection.send_error(msg["id"], "scanner_not_ready", "Scanner not initialized")
        return
    
    result = await _scanner.test_connection(host, port)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/start_scan",
    vol.Required("host"): str,
    vol.Optional("port", default=502): int,
    vol.Optional("start_id", default=1): int,
    vol.Optional("end_id", default=100): int,
})
@websocket_api.async_response
async def ws_start_scan(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Start Modbus scan."""
    _LOGGER.info("WebSocket: Starting scan")
    
    if _scanner is None:
        connection.send_error(msg["id"], "scanner_not_ready", "Scanner not initialized")
        return
    
    # Start scan in background (don't await - it runs async)
    hass.async_create_task(
        _scanner.start_scan(
            host=msg["host"],
            port=msg.get("port", 502),
            start_id=msg.get("start_id", 1),
            end_id=msg.get("end_id", 100),
        )
    )
    
    connection.send_result(msg["id"], {"started": True})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/stop_scan",
})
@websocket_api.async_response
async def ws_stop_scan(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Stop Modbus scan."""
    _LOGGER.info("WebSocket: Stopping scan")
    
    if _scanner is None:
        connection.send_error(msg["id"], "scanner_not_ready", "Scanner not initialized")
        return
    
    _scanner.stop_scan()
    connection.send_result(msg["id"], {"stopped": True})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_devices",
})
@websocket_api.async_response
async def ws_get_devices(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Get discovered devices."""
    if _scanner is None:
        connection.send_error(msg["id"], "scanner_not_ready", "Scanner not initialized")
        return
    
    connection.send_result(msg["id"], {"devices": _scanner.get_devices()})


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/read_registers",
    vol.Required("host"): str,
    vol.Optional("port", default=502): int,
    vol.Required("slave_id"): int,
    vol.Required("register"): int,
    vol.Optional("count", default=10): int,
})
@websocket_api.async_response
async def ws_read_registers(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Read raw Modbus registers."""
    if _scanner is None:
        connection.send_error(msg["id"], "scanner_not_ready", "Scanner not initialized")
        return
    
    _scanner.host = msg["host"]
    _scanner.port = msg.get("port", 502)
    
    result = await _scanner.read_registers(
        slave_id=msg["slave_id"],
        register=msg["register"],
        count=msg.get("count", 10),
    )
    
    connection.send_result(msg["id"], result)
