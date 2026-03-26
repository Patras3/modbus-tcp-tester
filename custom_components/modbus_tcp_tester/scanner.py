"""Modbus TCP Scanner for Huawei devices."""
import asyncio
import logging
import socket
import struct
from typing import Any, Callable

from pymodbus.client import AsyncModbusTcpClient
from pymodbus.exceptions import ModbusException

from homeassistant.core import HomeAssistant

from .const import (
    DEVICE_TYPE_BATTERY,
    DEVICE_TYPE_DONGLE,
    DEVICE_TYPE_INVERTER,
    DEVICE_TYPE_METER,
    DEVICE_TYPE_UNKNOWN,
    EVENT_DEVICE_FOUND,
    EVENT_SCAN_COMPLETED,
    EVENT_SCAN_PROGRESS,
    EVENT_SCAN_STARTED,
    REG_ACTIVE_POWER,
    REG_FIRMWARE,
    REG_FIRMWARE_LEN,
    REG_GRID_VOLTAGE_A,
    REG_MODEL_NAME,
    REG_MODEL_NAME_LEN,
    REG_RATED_POWER,
    REG_SERIAL_NUMBER,
    REG_SERIAL_NUMBER_LEN,
    REG_STATE,
)

_LOGGER = logging.getLogger(__name__)


class ModbusScanner:
    """Modbus TCP Scanner for Huawei devices."""

    def __init__(self, hass: HomeAssistant, host: str, port: int = 502):
        """Initialize scanner."""
        self.hass = hass
        self.host = host
        self.port = port
        self._scanning = False
        self._stop_requested = False
        self._devices: list[dict[str, Any]] = []
        self._callbacks: list[Callable] = []

    def register_callback(self, callback: Callable) -> None:
        """Register a callback for scan events."""
        self._callbacks.append(callback)

    async def _notify_callbacks(self, event_type: str, data: dict[str, Any]) -> None:
        """Notify all registered callbacks."""
        for callback in self._callbacks:
            try:
                await callback(event_type, data)
            except Exception as err:
                _LOGGER.error("Callback error: %s", err)

    async def test_connection(self, host: str | None = None, port: int | None = None) -> dict[str, Any]:
        """Test connection to Modbus TCP host."""
        test_host = host or self.host
        test_port = port or self.port
        
        result = {
            "host": test_host,
            "port": test_port,
            "ping": False,
            "port_open": False,
            "modbus": False,
        }

        # Test socket connection (async)
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(test_host, test_port),
                timeout=3
            )
            writer.close()
            await writer.wait_closed()
            result["port_open"] = True
            result["ping"] = True
            _LOGGER.debug("Socket connection to %s:%d successful", test_host, test_port)
        except asyncio.TimeoutError:
            _LOGGER.debug("Socket connection to %s:%d timed out", test_host, test_port)
        except ConnectionRefusedError:
            result["ping"] = True  # Host exists but port refused
            _LOGGER.debug("Connection refused to %s:%d", test_host, test_port)
        except OSError as err:
            _LOGGER.debug("Socket test failed: %s", err)

        # Test Modbus connection
        if result["port_open"]:
            try:
                async with AsyncModbusTcpClient(test_host, port=test_port, timeout=2) as client:
                    # Try to read from common slave IDs
                    for slave_id in [1, 100]:
                        try:
                            response = await client.read_holding_registers(
                                address=REG_MODEL_NAME, count=REG_MODEL_NAME_LEN, device_id=slave_id
                            )
                            if hasattr(response, 'registers') and response.registers:
                                result["modbus"] = True
                                _LOGGER.debug("Modbus test OK with slave %d", slave_id)
                                break
                        except Exception as e:
                            _LOGGER.debug("Modbus test slave %d failed: %s", slave_id, e)
                            continue
            except Exception as err:
                _LOGGER.warning("Modbus test failed: %s", err)

        return result

    async def start_scan(
        self,
        host: str | None = None,
        port: int | None = None,
        start_id: int = 1,
        end_id: int = 100,
    ) -> None:
        """Start scanning for Modbus devices."""
        if self._scanning:
            _LOGGER.warning("Scan already in progress")
            return

        self.host = host or self.host
        self.port = port or self.port
        self._scanning = True
        self._stop_requested = False
        self._devices = []

        # Fire scan started event
        self.hass.bus.async_fire(
            EVENT_SCAN_STARTED,
            {"host": self.host, "port": self.port, "start_id": start_id, "end_id": end_id},
        )

        await self._notify_callbacks(
            "scan_started",
            {"host": self.host, "port": self.port, "range": f"{start_id}-{end_id}"},
        )

        try:
            async with AsyncModbusTcpClient(self.host, port=self.port, timeout=1) as client:
                total = end_id - start_id + 1
                current = 0

                for slave_id in range(start_id, end_id + 1):
                    if self._stop_requested:
                        break

                    current += 1
                    progress = int((current / total) * 100)

                    # Fire progress event
                    self.hass.bus.async_fire(
                        EVENT_SCAN_PROGRESS,
                        {"slave_id": slave_id, "progress": progress},
                    )

                    await self._notify_callbacks(
                        "scan_progress",
                        {"slave_id": slave_id, "progress": progress},
                    )

                    try:
                        device = await self._probe_device(client, slave_id)
                        if device:
                            self._devices.append(device)

                            # Fire device found event
                            self.hass.bus.async_fire(EVENT_DEVICE_FOUND, device)

                            await self._notify_callbacks("device_found", device)

                    except ModbusException:
                        pass  # Silent fail for no response
                    except Exception as err:
                        _LOGGER.debug("Error probing slave %d: %s", slave_id, err)

                    # Rate limiting to avoid spamming
                    await asyncio.sleep(0.05)

        except Exception as err:
            _LOGGER.error("Scan error: %s", err)
        finally:
            self._scanning = False

            # Fire scan completed event
            self.hass.bus.async_fire(
                EVENT_SCAN_COMPLETED,
                {"devices_found": len(self._devices), "devices": self._devices},
            )

            await self._notify_callbacks(
                "scan_completed",
                {"devices_found": len(self._devices), "devices": self._devices},
            )

    def stop_scan(self) -> None:
        """Stop the current scan."""
        self._stop_requested = True

    async def _probe_device(
        self, client: AsyncModbusTcpClient, slave_id: int
    ) -> dict[str, Any] | None:
        """Probe a single Modbus slave ID."""
        try:
            # Read model name first
            result = await client.read_holding_registers(
                address=REG_MODEL_NAME, count=REG_MODEL_NAME_LEN, device_id=slave_id
            )

            if result.isError():
                return None

            model = self._decode_string(result.registers)

            # If we got a model, read more details
            device = {
                "slave_id": slave_id,
                "model": model,
                "type": self._guess_device_type(model),
            }

            # Try to read firmware
            try:
                fw_result = await client.read_holding_registers(
                    address=REG_FIRMWARE, count=REG_FIRMWARE_LEN, device_id=slave_id
                )
                if not fw_result.isError():
                    device["firmware"] = self._decode_string(fw_result.registers)
            except:
                pass

            # Try to read serial number
            try:
                sn_result = await client.read_holding_registers(
                    address=REG_SERIAL_NUMBER, count=REG_SERIAL_NUMBER_LEN, device_id=slave_id
                )
                if not sn_result.isError():
                    device["serial_number"] = self._decode_string(sn_result.registers)
            except:
                pass

            # Try to read power/voltage (inverter-specific)
            if device["type"] == DEVICE_TYPE_INVERTER:
                try:
                    power_result = await client.read_holding_registers(
                        address=REG_ACTIVE_POWER, count=2, device_id=slave_id
                    )
                    if not power_result.isError():
                        device["active_power"] = self._decode_int32(power_result.registers)

                    voltage_result = await client.read_holding_registers(
                        address=REG_GRID_VOLTAGE_A, count=1, device_id=slave_id
                    )
                    if not voltage_result.isError():
                        device["grid_voltage_a"] = voltage_result.registers[0] / 10.0

                    rated_result = await client.read_holding_registers(
                        address=REG_RATED_POWER, count=2, device_id=slave_id
                    )
                    if not rated_result.isError():
                        device["rated_power"] = self._decode_uint32(rated_result.registers)

                except:
                    pass

            return device

        except Exception as err:
            _LOGGER.debug("Probe error slave %d: %s", slave_id, err)
            return None

    async def read_registers(
        self, slave_id: int, register: int, count: int = 10
    ) -> dict[str, Any] | None:
        """Read raw registers from a device."""
        try:
            async with AsyncModbusTcpClient(self.host, port=self.port, timeout=2) as client:
                result = await client.read_holding_registers(address=register, count=count, device_id=slave_id)

                if result.isError():
                    return {"error": str(result)}

                return {
                    "slave_id": slave_id,
                    "register": register,
                    "count": count,
                    "values": result.registers,
                    "hex": [hex(r) for r in result.registers],
                }

        except Exception as err:
            return {"error": str(err)}

    def get_devices(self) -> list[dict[str, Any]]:
        """Get list of discovered devices."""
        return self._devices

    @property
    def is_scanning(self) -> bool:
        """Return True if scan is in progress."""
        return self._scanning

    @staticmethod
    def _decode_string(registers: list[int]) -> str:
        """Decode Modbus registers to string."""
        try:
            # Convert registers to bytes (big-endian)
            byte_list = []
            for reg in registers:
                byte_list.append((reg >> 8) & 0xFF)
                byte_list.append(reg & 0xFF)

            # Decode as UTF-8 and strip nulls/spaces
            text = bytes(byte_list).decode("utf-8", errors="ignore")
            return text.strip().rstrip("\x00")

        except Exception:
            return "Unknown"

    @staticmethod
    def _decode_int32(registers: list[int]) -> int:
        """Decode two registers as signed int32."""
        try:
            high = registers[0]
            low = registers[1]
            value = (high << 16) | low
            # Handle signed
            if value & 0x80000000:
                value = -(0x100000000 - value)
            return value
        except:
            return 0

    @staticmethod
    def _decode_uint32(registers: list[int]) -> int:
        """Decode two registers as unsigned int32."""
        try:
            high = registers[0]
            low = registers[1]
            return (high << 16) | low
        except:
            return 0

    @staticmethod
    def _guess_device_type(model: str) -> str:
        """Guess device type from model name."""
        model_upper = model.upper()

        if "SUN2000" in model_upper:
            return DEVICE_TYPE_INVERTER
        elif "SDONGLE" in model_upper or "EMMA" in model_upper:
            return DEVICE_TYPE_DONGLE
        elif "LUNA" in model_upper:
            return DEVICE_TYPE_BATTERY
        elif "DTSU" in model_upper or "DDSU" in model_upper:
            return DEVICE_TYPE_METER

        return DEVICE_TYPE_UNKNOWN
