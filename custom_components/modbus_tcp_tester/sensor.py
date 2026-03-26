"""Sensor platform for Modbus TCP Tester."""
import logging

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Modbus TCP Tester sensors."""
    scanner = hass.data[DOMAIN][entry.entry_id]["scanner"]

    sensors = [
        ModbusTesterStatusSensor(scanner, entry),
    ]

    async_add_entities(sensors)


class ModbusTesterStatusSensor(SensorEntity):
    """Sensor showing scanner status."""

    def __init__(self, scanner, entry):
        """Initialize sensor."""
        self._scanner = scanner
        self._entry = entry
        self._attr_name = "Modbus Scanner Status"
        self._attr_unique_id = f"{entry.entry_id}_status"

    @property
    def state(self):
        """Return the state."""
        return "Scanning" if self._scanner.is_scanning else "Idle"

    @property
    def extra_state_attributes(self):
        """Return extra attributes."""
        return {
            "host": self._scanner.host,
            "port": self._scanner.port,
            "devices_found": len(self._scanner.get_devices()),
            "is_scanning": self._scanner.is_scanning,
        }

    @property
    def icon(self):
        """Return icon."""
        return "mdi:radar" if self._scanner.is_scanning else "mdi:check-network"
