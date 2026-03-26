"""Constants for Modbus TCP Tester integration."""

DOMAIN = "modbus_tcp_tester"

# Config
CONF_HOST = "host"
CONF_PORT = "port"
CONF_SCAN_RANGE_START = "scan_range_start"
CONF_SCAN_RANGE_END = "scan_range_end"

# Defaults
DEFAULT_PORT = 502
DEFAULT_SCAN_START = 1
DEFAULT_SCAN_END = 100

# Services
SERVICE_SCAN = "scan"
SERVICE_STOP_SCAN = "stop_scan"
SERVICE_READ_REGISTERS = "read_registers"

# Events
EVENT_SCAN_STARTED = f"{DOMAIN}_scan_started"
EVENT_SCAN_PROGRESS = f"{DOMAIN}_scan_progress"
EVENT_SCAN_COMPLETED = f"{DOMAIN}_scan_completed"
EVENT_DEVICE_FOUND = f"{DOMAIN}_device_found"

# Device types
DEVICE_TYPE_INVERTER = "inverter"
DEVICE_TYPE_DONGLE = "dongle"
DEVICE_TYPE_BATTERY = "battery"
DEVICE_TYPE_METER = "meter"
DEVICE_TYPE_UNKNOWN = "unknown"
DEVICE_TYPE_ERROR = "error"  # Device responds but with error

# Modbus registers (Huawei specific)
REG_MODEL_NAME = 30000
REG_MODEL_NAME_LEN = 15
REG_FIRMWARE = 30015
REG_FIRMWARE_LEN = 10
REG_SERIAL_NUMBER = 30025
REG_SERIAL_NUMBER_LEN = 10
REG_ACTIVE_POWER = 32080
REG_INPUT_POWER = 32064
REG_GRID_VOLTAGE_A = 32066
REG_GRID_VOLTAGE_B = 32067
REG_GRID_VOLTAGE_C = 32068
REG_STATE = 32000
REG_RATED_POWER = 30073
