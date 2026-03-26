"""WebSocket API for Modbus TCP Tester."""
import logging
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .scanner import ModbusScanner

_LOGGER = logging.getLogger(__name__)


class ModbusTesterWebSocketAPI:
    """WebSocket API for Modbus TCP Tester."""

    def __init__(self, hass: HomeAssistant, scanner: ModbusScanner):
        """Initialize WebSocket API."""
        self.hass = hass
        self.scanner = scanner

    @callback
    def async_register(self) -> None:
        """Register WebSocket commands."""
        
        # Test connection
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/test_connection",
            self._handle_test_connection,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("host"): str,
                vol.Optional("port", default=502): int,
            }),
        )

        # Start scan
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/start_scan",
            self._handle_start_scan,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("host"): str,
                vol.Optional("port", default=502): int,
                vol.Optional("start_id", default=1): int,
                vol.Optional("end_id", default=100): int,
            }),
        )

        # Stop scan
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/stop_scan",
            self._handle_stop_scan,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({}),
        )

        # Get devices
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/get_devices",
            self._handle_get_devices,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({}),
        )

        # Read registers
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/read_registers",
            self._handle_read_registers,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({
                vol.Required("host"): str,
                vol.Optional("port", default=502): int,
                vol.Required("slave_id"): int,
                vol.Required("register"): int,
                vol.Optional("count", default=10): int,
            }),
        )

    @websocket_api.async_response
    async def _handle_test_connection(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Test connection to Modbus host."""
        host = msg["host"]
        port = msg.get("port", 502)
        
        _LOGGER.info("Testing connection to %s:%d", host, port)
        
        result = await self.scanner.test_connection(host, port)
        
        connection.send_result(msg["id"], result)

    @websocket_api.async_response
    async def _handle_start_scan(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Start Modbus scan."""
        await self.scanner.start_scan(
            host=msg["host"],
            port=msg.get("port", 502),
            start_id=msg.get("start_id", 1),
            end_id=msg.get("end_id", 100),
        )
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.async_response
    async def _handle_stop_scan(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Stop Modbus scan."""
        self.scanner.stop_scan()
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.async_response
    async def _handle_get_devices(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Get discovered devices."""
        connection.send_result(msg["id"], {"devices": self.scanner.get_devices()})

    @websocket_api.async_response
    async def _handle_read_registers(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Read raw registers."""
        self.scanner.host = msg["host"]
        self.scanner.port = msg.get("port", 502)
        
        result = await self.scanner.read_registers(
            slave_id=msg["slave_id"],
            register=msg["register"],
            count=msg.get("count", 10),
        )
        connection.send_result(msg["id"], result)
