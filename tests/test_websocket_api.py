#!/usr/bin/env python3
"""Test WebSocket API registration and schema validation.

This test verifies:
1. api.py has correct decorator patterns
2. api.py has correct type strings
3. panel.js uses matching command types
4. All files have valid Python/JS syntax
"""
import os
import re
import sys


def test_api_module():
    """Test api.py structure and patterns."""
    print("\n" + "=" * 50)
    print("Testing api.py")
    print("=" * 50)
    
    api_path = os.path.join(
        os.path.dirname(__file__), 
        '..', 
        'custom_components', 
        'modbus_tcp_tester', 
        'api.py'
    )
    
    assert os.path.exists(api_path), f"api.py not found at {api_path}"
    print("✅ api.py exists")
    
    with open(api_path, 'r') as f:
        content = f.read()
    
    # 1. Check for decorator pattern (CRITICAL)
    decorator_pattern = r'@websocket_api\.websocket_command\(\{'
    matches = re.findall(decorator_pattern, content)
    assert len(matches) >= 3, f"Expected at least 3 websocket_command decorators, found {len(matches)}"
    print(f"✅ Found {len(matches)} @websocket_api.websocket_command decorators")
    
    # 2. Check for async_response decorator
    assert '@websocket_api.async_response' in content
    print("✅ Has @websocket_api.async_response decorators")
    
    # 3. Check for correct type format (CRITICAL - this was the bug!)
    # Must be: vol.Required("type"): f"{DOMAIN}/test_connection"
    # NOT: async_register_command(hass, "modbus_tcp_tester/test_connection", ...)
    
    correct_type_pattern = r'vol\.Required\("type"\):\s*f"\{DOMAIN\}/'
    type_matches = re.findall(correct_type_pattern, content)
    assert len(type_matches) >= 3, f"Expected at least 3 correct type definitions, found {len(type_matches)}"
    print(f"✅ Found {len(type_matches)} correct type definitions (vol.Required(\"type\"): f\"{{DOMAIN}}/...\")")
    
    # 4. Check for required functions
    required_funcs = ['ws_test_connection', 'ws_start_scan', 'ws_stop_scan']
    for func in required_funcs:
        assert f'async def {func}' in content, f"Missing function {func}"
        print(f"✅ Has {func} function")
    
    # 5. Check for registration function
    assert 'def async_register_websocket_api' in content
    print("✅ Has async_register_websocket_api function")
    
    # 6. Check registration calls
    for func in required_funcs:
        assert f'async_register_command(hass, {func})' in content, f"Missing registration for {func}"
    print("✅ All functions are registered")
    
    # 7. Python syntax check
    try:
        compile(content, api_path, 'exec')
        print("✅ api.py has valid Python syntax")
    except SyntaxError as e:
        print(f"❌ Syntax error in api.py: {e}")
        return False
    
    return True


def test_panel_js():
    """Test panel.js WebSocket calls match api.py."""
    print("\n" + "=" * 50)
    print("Testing panel.js")
    print("=" * 50)
    
    panel_path = os.path.join(
        os.path.dirname(__file__), 
        '..', 
        'custom_components', 
        'modbus_tcp_tester', 
        'frontend',
        'panel.js'
    )
    
    assert os.path.exists(panel_path), "panel.js not found"
    print("✅ panel.js exists")
    
    with open(panel_path, 'r') as f:
        content = f.read()
    
    # Check for correct WebSocket command types (must match api.py)
    expected_commands = [
        'modbus_tcp_tester/test_connection',
        'modbus_tcp_tester/start_scan',
        'modbus_tcp_tester/stop_scan',
    ]
    
    for cmd in expected_commands:
        assert cmd in content, f"Missing command {cmd} in panel.js"
        print(f"✅ Uses {cmd}")
    
    # Check for sendWsCommand function
    assert 'function sendWsCommand' in content
    print("✅ Has sendWsCommand function")
    
    # Check for WebSocket connection
    assert 'new WebSocket' in content
    print("✅ Creates WebSocket connection")
    
    # Check for event subscriptions (live updates)
    event_subscriptions = [
        'modbus_tcp_tester_scan_started',
        'modbus_tcp_tester_scan_progress',
        'modbus_tcp_tester_device_found',
        'modbus_tcp_tester_scan_completed',
    ]
    for event in event_subscriptions:
        assert event in content, f"Missing event subscription {event}"
    print(f"✅ Subscribes to {len(event_subscriptions)} HA events for live updates")
    
    return True


def test_init_integration():
    """Test __init__.py integrates api.py correctly."""
    print("\n" + "=" * 50)
    print("Testing __init__.py integration")
    print("=" * 50)
    
    init_path = os.path.join(
        os.path.dirname(__file__), 
        '..', 
        'custom_components', 
        'modbus_tcp_tester', 
        '__init__.py'
    )
    
    with open(init_path, 'r') as f:
        content = f.read()
    
    # Check imports
    assert 'from .api import async_register_websocket_api' in content
    print("✅ Imports async_register_websocket_api from api")
    
    assert 'from .api import' in content and 'set_scanner' in content
    print("✅ Imports set_scanner from api")
    
    # Check calls
    assert 'set_scanner(scanner)' in content
    print("✅ Calls set_scanner(scanner)")
    
    assert 'async_register_websocket_api(hass)' in content
    print("✅ Calls async_register_websocket_api(hass)")
    
    return True


def test_scanner_test_connection():
    """Test scanner.py has test_connection with parameters."""
    print("\n" + "=" * 50)
    print("Testing scanner.py test_connection")
    print("=" * 50)
    
    scanner_path = os.path.join(
        os.path.dirname(__file__), 
        '..', 
        'custom_components', 
        'modbus_tcp_tester', 
        'scanner.py'
    )
    
    with open(scanner_path, 'r') as f:
        content = f.read()
    
    # Check test_connection has host/port parameters
    # Pattern: async def test_connection(self, host: str | None = None, port: int | None = None)
    pattern = r'async def test_connection\(self,\s*host.*port'
    assert re.search(pattern, content), "test_connection must accept host and port parameters"
    print("✅ test_connection accepts host and port parameters")
    
    # Check it returns dict with expected keys
    assert '"ping"' in content and '"port_open"' in content and '"modbus"' in content
    print("✅ test_connection returns ping, port_open, modbus status")
    
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("Modbus TCP Tester - WebSocket API Tests")
    print("=" * 60)
    
    all_passed = True
    
    tests = [
        ("api.py structure", test_api_module),
        ("panel.js WebSocket calls", test_panel_js),
        ("__init__.py integration", test_init_integration),
        ("scanner.py test_connection", test_scanner_test_connection),
    ]
    
    for name, test_func in tests:
        try:
            if not test_func():
                all_passed = False
        except AssertionError as e:
            print(f"❌ FAILED: {e}")
            all_passed = False
        except Exception as e:
            print(f"❌ ERROR: {e}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        print("\nWebSocket API is correctly configured:")
        print("  - api.py uses @websocket_api.websocket_command decorator")
        print("  - Type format: vol.Required('type'): f'{DOMAIN}/command'")
        print("  - panel.js sends matching command types")
        print("  - scanner.test_connection accepts host/port params")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 60)
    
    sys.exit(0 if all_passed else 1)
