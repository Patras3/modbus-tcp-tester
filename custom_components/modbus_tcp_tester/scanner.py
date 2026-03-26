"""Modbus TCP Scanner for Huawei devices."""
import asyncio
import logging
import socket
from typing import Any

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

    async def test_connection(self, host: str, port: int) -> dict[str, Any]:
        """Test connection to Modbus TCP host (ping, port, modbus)."""
        result = {
            "host": host,
            "port": port,
            "ping": False,
            "port_open": False,
            "modbus": False,
        }

        # Step 1: Test if host is reachable (socket connect = "ping")
        _LOGGER.debug("Testing socket connection to %s:%d", host, port)
        try:
            loop = asyncio.get_event_loop()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setblocking(False)
            sock.settimeout(2)
            
            # Try to connect
            await asyncio.wait_for(
                loop.sock_connect(sock, (host, port)),
                timeout=3
            )
            sock.close()
            result["ping"] = True
            result["port_open"] = True
            _LOGGER.debug("Socket connection successful")
        except asyncio.TimeoutError:
            _LOGGER.debug("Socket connection timeout")
            result["ping"] = True  # Host exists but port timeout
            result["port_open"] = False
        except ConnectionRefusedError:
            _LOGGER.debug("Connection refused - port closed")
            result["ping"] = True  # Host exists but port refused
            result["port_open"] = False
        except OSError as e:
            if "Network is unreachable" in str(e) or "No route to host" in str(e):
                _LOGGER.debug("Host unreachable: %s", e)
                result["ping"] = False
            else:
                _LOGGER.debug("Socket error: %s", e)
                result["ping"] = True
                result["port_open"] = False
        except Exception as e:
            _LOGGER.debug("Socket test error: %s", e)
            result["ping"] = False

        # Step 2: Test Modbus TCP connection (only if port is open)
        if result["port_open"]:
            _LOGGER.debug("Testing Modbus TCP connection")
            try:
                async with AsyncModbusTcpClient(host, port=port, timeout=2) as client:
                    # Try to read from common slave IDs
                    for slave_id in [1, 100, 0]:
                        try:
                            response = await client.read_holding_registers(
                                REG_MODEL_NAME, 1, slave=slave_id
                            )
                            if not response.isError():
                                result["modbus"] = True
                                _LOGGER.debug("Modbus response OK from slave %d", slave_id)
                                break
                        except Exception:
                            continue
            except Exception as e:
                _LOGGER.debug("Modbus test error: %s", e)

        _LOGGER.info("Connection test result: %s", result)
        return result

    async def start_scan(
        self,
        host: str,
        port: int = 502,
        start_id: int = 1,
        end_id: int = 100,
    ) -> None:
        """Start scanning for Modbus devices."""
        if self._scanning:
            _LOGGER.warning("Scan already in progress")
            return

        self.host = host
        self.port = port
        self._scanning = True
        self._stop_requested = False
        self._devices = []

        # Fire scan started event
        self.hass.bus.async_fire(
            EVENT_SCAN_STARTED,
            {"host": host, "port": port, "start_id": start_id, "end_id": end_id},
        )

        try:
            async with AsyncModbusTcpClient(host, port=port, timeout=1) as client:
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

                    try:
                        device = await self._probe_device(client, slave_id)
                        if device:
                            self._devices.append(device)
                            self.hass.bus.async_fire(EVENT_DEVICE_FOUND, device)

                    except ModbusException:
                        pass
                    except Exception as err:
                        _LOGGER.debug("Error probing slave %d: %s", slave_id, err)

                    # Rate limiting
                    await asyncio.sleep(0.05)

        except Exception as err:
            _LOGGER.error("Scan error: %s", err)
        finally:
            self._scanning = False
            self.hass.bus.async_fire(
                EVENT_SCAN_COMPLETED,
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
            result = await client.read_holding_registers(
                REG_MODEL_NAME, REG_MODEL_NAME_LEN, slave=slave_id
            )

            if result.isError():
                return None

            model = self._decode_string(result.registers)

            device = {
                "slave_id": slave_id,
                "model": model,
                "type": self._guess_device_type(model),
            }

            # Try to read firmware
            try:
                fw_result = await client.read_holding_registers(
                    REG_FIRMWARE, REG_FIRMWARE_LEN, slave=slave_id
                )
                if not fw_result.isError():
                    device["firmware"] = self._decode_string(fw_result.registers)
            except:
                pass

            # Try to read serial number
            try:
                sn_result = await client.read_holding_registers(
                    REG_SERIAL_NUMBER, REG_SERIAL_NUMBER_LEN, slave=slave_id
                )
                if not sn_result.isError():
                    device["serial_number"] = self._decode_string(sn_result.registers)
            except:
                pass

            # Try to read power/voltage (inverter-specific)
            if device["type"] == DEVICE_TYPE_INVERTER:
                try:
                    power_result = await client.read_holding_registers(
                        REG_ACTIVE_POWER, 2, slave=slave_id
                    )
                    if not power_result.isError():
                        device["active_power"] = self._decode_int32(power_result.registers)

                    voltage_result = await client.read_holding_registers(
                        REG_GRID_VOLTAGE_A, 1, slave=slave_id
                    )
                    if not voltage_result.isError():
                        device["grid_voltage_a"] = voltage_result.registers[0] / 10.0

                    rated_result = await client.read_holding_registers(
                        REG_RATED_POWER, 2, slave=slave_id
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
                result = await client.read_holding_registers(register, count, slave=slave_id)

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
            byte_list = []
            for reg in registers:
                byte_list.append((reg >> 8) & 0xFF)
                byte_list.append(reg & 0xFF)
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
