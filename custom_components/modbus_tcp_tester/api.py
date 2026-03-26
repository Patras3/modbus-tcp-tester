"""WebSocket API for Modbus TCP Tester."""
import logging
from typing import Any

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
        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/get_status",
            self.websocket_get_status,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({}),
        )

        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/start_scan",
            self.websocket_start_scan,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
                {
                    "host": str,
                    "port": int,
                    "start_id": int,
                    "end_id": int,
                }
            ),
        )

        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/stop_scan",
            self.websocket_stop_scan,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({}),
        )

        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/get_devices",
            self.websocket_get_devices,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend({}),
        )

        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/test_connection",
            self.websocket_test_connection,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
                {
                    "host": str,
                    "port": int,
                }
            ),
        )

        websocket_api.async_register_command(
            self.hass,
            f"{DOMAIN}/read_registers",
            self.websocket_read_registers,
            websocket_api.BASE_COMMAND_MESSAGE_SCHEMA.extend(
                {
                    "slave_id": int,
                    "register": int,
                    "count": int,
                }
            ),
        )

    @websocket_api.async_response
    async def websocket_get_status(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Get current scanner status."""
        connection.send_result(
            msg["id"],
            {
                "host": self.scanner.host,
                "port": self.scanner.port,
                "scanning": self.scanner.is_scanning,
                "devices_count": len(self.scanner.get_devices()),
            },
        )

    @websocket_api.async_response
    async def websocket_start_scan(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Start Modbus scan."""
        await self.scanner.start_scan(
            host=msg["host"],
            port=msg["port"],
            start_id=msg["start_id"],
            end_id=msg["end_id"],
        )

        connection.send_result(msg["id"], {"success": True})

    @websocket_api.async_response
    async def websocket_stop_scan(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Stop Modbus scan."""
        self.scanner.stop_scan()
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.async_response
    async def websocket_get_devices(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Get discovered devices."""
        connection.send_result(msg["id"], {"devices": self.scanner.get_devices()})

    @websocket_api.async_response
    async def websocket_test_connection(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Test connection to Modbus host."""
        result = await self.scanner.test_connection()
        connection.send_result(msg["id"], result)

    @websocket_api.async_response
    async def websocket_read_registers(
        self,
        hass: HomeAssistant,
        connection: websocket_api.ActiveConnection,
        msg: dict[str, Any],
    ) -> None:
        """Read raw registers."""
        result = await self.scanner.read_registers(
            slave_id=msg["slave_id"],
            register=msg["register"],
            count=msg["count"],
        )
        connection.send_result(msg["id"], result)
