# Device App Specification

This document specifies how individual device applications should communicate with the Device Fleet Monitor to be tracked and monitored.

---

## Overview

Each physical device (sensor, IoT device, server, etc.) needs a small application that:
1. **Registers itself** with the monitor on startup
2. **Collects metrics** periodically (CPU, temperature, signal strength, etc.)
3. **Sends heartbeats** with those metrics to the monitor
4. **Handles errors** gracefully if the monitor is unavailable

---

## Device Registration

### When: On Application Startup

The device app must register itself with the monitor **once** when it starts.

### Endpoint
```
POST http://{monitor-host}:3000/devices
```

### Request Body
```json
{
  "id": "device-sensor-01",
  "name": "Temperature Sensor - Lab A"
}
```

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique device identifier (e.g., `sensor-01`, `pi-kitchen`, `gateway-02`) |
| `name` | string | Yes | Human-readable device name |

### Example (curl)
```bash
curl -X POST http://monitor-app:3000/devices \
  -H "Content-Type: application/json" \
  -d '{
    "id": "device-sensor-01",
    "name": "Temperature Sensor - Lab A"
  }'
```

### Response (201 Created)
```json
{
  "id": "device-sensor-01",
  "name": "Temperature Sensor - Lab A",
  "status": "OFFLINE",
  "lastHeartbeat": "2026-09-21T10:15:00.000Z",
  "metrics": {}
}
```

### Error Handling
- **409 Conflict:** Device already registered (this is OK, device can continue)
- **400 Bad Request:** Missing required fields (check id and name)
- **Connection Error:** Retry registration every 5-10 seconds until successful

---

## Heartbeat with Metrics

### When: Periodically (Every 5-30 seconds)

After successful registration, the device must send **heartbeats** with its current metrics.

### Endpoint
```
POST http://{monitor-host}:3000/devices/{device-id}/heartbeat
```

### Request Body - Minimal (Required)
```json
{
  "timestamp": "2026-09-21T10:15:30.123Z",
  "status": "OK"
}
```

### Request Body - With Metrics (Recommended)
```json
{
  "timestamp": "2026-09-21T10:15:30.123Z",
  "status": "OK",
  "cpu_usage": 42,
  "memory_usage": 512,
  "signal_strength": -71,
  "temperature": 28.5,
  "uptime_seconds": 3600,
  "battery_level": 85
}
```

### Parameters
| Field | Type | Required | Description | Notes |
|-------|------|----------|-------------|-------|
| `timestamp` | string | Yes | ISO 8601 UTC timestamp | Format: `2026-09-21T10:15:30.123Z` |
| `status` | string | Yes | Device status | Typically `"OK"` or `"WARNING"` |
| `cpu_usage` | number | No | CPU usage percentage | 0-100 |
| `memory_usage` | number | No | Memory usage in MB | e.g., 512 for 512MB |
| `signal_strength` | number | No | Wireless signal in dBm | e.g., -71 (negative values) |
| `temperature` | number | No | Temperature in Celsius | e.g., 28.5 |
| `uptime_seconds` | number | No | Device uptime in seconds | e.g., 3600 for 1 hour |
| `battery_level` | number | No | Battery percentage | 0-100 |
| `*custom_field*` | any | No | Any custom metric | Device can send additional fields |

### Example (curl)
```bash
curl -X POST http://monitor-app:3000/devices/device-sensor-01/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2026-09-21T10:15:30.123Z",
    "status":"OK",
    "cpu_usage":42,
    "memory_usage":512,
    "signal_strength":-71,
    "temperature":28.5,
    "battery_level":85
  }'
```

### Response (200 OK)
```json
{
  "id": "device-sensor-01",
  "name": "Temperature Sensor - Lab A",
  "status": "ONLINE",
  "lastHeartbeat": "2026-09-21T10:15:30.123Z",
  "metrics": {
    "cpu_usage": 42,
    "memory_usage": 512,
    "signal_strength": -71,
    "temperature": 28.5,
    "battery_level": 85
  }
}
```

### Error Handling
- **404 Not Found:** Device not registered (auto-creates, then updates)
- **400 Bad Request:** Invalid timestamp format or missing required fields
- **Connection Error:** Retry heartbeat after 10-30 seconds

---

## Metric Collection Strategy

### For Different Device Types

#### IoT Sensor Device (Raspberry Pi, Arduino with WiFi)
```json
{
  "timestamp": "2026-09-21T10:15:30.123Z",
  "status": "OK",
  "cpu_usage": 45,
  "memory_usage": 256,
  "temperature": 32.5,
  "signal_strength": -65,
  "battery_level": 92
}
```

#### Server/Machine
```json
{
  "timestamp": "2026-09-21T10:15:30.123Z",
  "status": "OK",
  "cpu_usage": 78,
  "memory_usage": 4096,
  "disk_usage": 512000,
  "network_latency": 15,
  "uptime_seconds": 864000
}
```

#### Smart Sensor
```json
{
  "timestamp": "2026-09-21T10:15:30.123Z",
  "status": "OK",
  "temperature": 22.3,
  "humidity": 65,
  "air_quality": 45,
  "battery_level": 78,
  "signal_strength": -72
}
```

---

## Device App Implementation Example

### Python Device App
```python
import requests
import time
import psutil
from datetime import datetime

class DeviceApp:
    def __init__(self, device_id, device_name, monitor_url):
        self.device_id = device_id
        self.device_name = device_name
        self.monitor_url = monitor_url
        self.registered = False
    
    def register(self):
        """Register device with monitor"""
        try:
            response = requests.post(
                f"{self.monitor_url}/devices",
                json={"id": self.device_id, "name": self.device_name},
                timeout=5
            )
            if response.status_code in [201, 409]:
                self.registered = True
                print(f"✓ Device registered: {self.device_id}")
                return True
        except Exception as e:
            print(f"✗ Registration failed: {e}")
        return False
    
    def collect_metrics(self):
        """Collect device metrics"""
        return {
            "cpu_usage": psutil.cpu_percent(interval=1),
            "memory_usage": psutil.virtual_memory().used // (1024*1024),
            "temperature": 28.5,  # Read from sensor
            "battery_level": 85
        }
    
    def send_heartbeat(self):
        """Send heartbeat with metrics"""
        if not self.registered:
            return False
        
        try:
            response = requests.post(
                f"{self.monitor_url}/devices/{self.device_id}/heartbeat",
                json={
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "status": "OK",
                    **self.collect_metrics()
                },
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"✗ Heartbeat failed: {e}")
            return False
    
    def run(self):
        """Main loop"""
        print(f"Starting device: {self.device_id}")
        
        # Register once
        while not self.registered:
            self.register()
            if not self.registered:
                time.sleep(5)
        
        # Send heartbeats forever
        while True:
            self.send_heartbeat()
            time.sleep(10)  # Every 10 seconds

# Usage
if __name__ == "__main__":
    app = DeviceApp(
        device_id="device-sensor-01",
        device_name="Temperature Sensor - Lab A",
        monitor_url="http://localhost:3000"
    )
    app.run()
```

### Node.js Device App
```javascript
const http = require('http');

class DeviceApp {
    constructor(deviceId, deviceName, monitorUrl) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.monitorUrl = monitorUrl;
        this.registered = false;
    }

    register() {
        return this.makeRequest('POST', '/devices', {
            id: this.deviceId,
            name: this.deviceName
        });
    }

    collectMetrics() {
        return {
            cpu_usage: Math.floor(Math.random() * 100),
            memory_usage: 512,
            temperature: 28.5,
            battery_level: 85
        };
    }

    sendHeartbeat() {
        if (!this.registered) return false;
        
        return this.makeRequest(
            'POST',
            `/devices/${this.deviceId}/heartbeat`,
            {
                timestamp: new Date().toISOString(),
                status: "OK",
                ...this.collectMetrics()
            }
        );
    }

    makeRequest(method, path, body) {
        return new Promise((resolve) => {
            const data = JSON.stringify(body);
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                this.registered = res.statusCode === 200 || res.statusCode === 201;
                resolve(this.registered);
            });

            req.on('error', () => resolve(false));
            req.write(data);
            req.end();
        });
    }

    async run() {
        console.log(`Starting device: ${this.deviceId}`);
        
        // Register once
        while (!this.registered) {
            await this.register();
            if (!this.registered) await this.sleep(5000);
        }
        
        // Send heartbeats forever
        while (true) {
            await this.sendHeartbeat();
            await this.sleep(10000);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const app = new DeviceApp(
    'device-sensor-01',
    'Temperature Sensor - Lab A',
    'http://localhost:3000'
);
app.run();
```

---

## Dashboard Display

### What the Monitor Shows

When you click on a device in the monitor dashboard, it displays:

```
Device: device-sensor-01
Name: Temperature Sensor - Lab A
Status: ONLINE ✅
Last Heartbeat: 2 seconds ago

Metrics:
┌─────────────────┬─────────┐
│ CPU Usage       │ 42 %    │
│ Memory Usage    │ 512 MB  │
│ Temperature     │ 28.5 °C │
│ Signal Strength │ -71 dBm │
│ Battery Level   │ 85 %    │
└─────────────────┴─────────┘
```

---

## Best Practices for Device Apps

### 1. Registration
- Register once on startup
- If registration fails, retry every 5-10 seconds
- Device ID should be **unique and persistent** (don't change it)

### 2. Heartbeat Frequency
- Send heartbeat every **5-30 seconds**
- If monitor is unreachable, keep trying (don't exit)
- Use randomized intervals to avoid thundering herd

### 3. Metrics Collection
- Collect metrics **just before** sending heartbeat
- Include only metrics that are relevant to the device
- Use sensible units (CPU %, Memory MB, Temp °C, Signal dBm)

### 4. Error Handling
- Handle network timeouts gracefully
- Retry failed heartbeats
- Log errors for debugging
- Don't crash if monitor is temporarily down

### 5. Timestamp Format
- Always use UTC time
- Format: `2026-09-21T10:15:30.123Z` (ISO 8601)
- Include milliseconds for accuracy

### 6. Device Naming
- Use clear, descriptive names
- Include location or purpose (e.g., "Temperature Sensor - Lab A")
- Keep it under 100 characters

---

## Status Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Heartbeat received | Device is being monitored ✅ |
| 201 | Device created | First heartbeat (device auto-created) ✅ |
| 400 | Bad request | Check timestamp format or fields |
| 404 | Device not found | Shouldn't happen (auto-create on heartbeat) |
| 500 | Server error | Retry after 10 seconds |
| Timeout | No response | Retry after 10 seconds |

---

## Testing Your Device App

### Step 1: Start Monitor
```bash
npm run dev
```

### Step 2: Start Your Device App
```bash
python device_app.py
# or
node device_app.js
```

### Step 3: Open Monitor Dashboard
```
http://localhost:3000
```

### Step 4: Verify
- Device appears in the list ✅
- Status shows as ONLINE ✅
- Click device to see metrics ✅
- Stop device app → Device goes OFFLINE after 30 seconds ✅

---

## Future Enhancements

Devices could support:
- **Custom webhooks** — Device sends alerts on specific conditions
- **Configuration** — Monitor pushes configuration to devices
- **OTA Updates** — Over-the-air firmware updates from monitor
- **Logging** — Device sends logs to monitor for centralized logging
- **Commands** — Monitor sends commands to device (reboot, restart service, etc.)

---

## Summary

A proper device app needs to:

1. **Register once** — `POST /devices` with device ID and name
2. **Send heartbeats periodically** — `POST /devices/{id}/heartbeat` every 5-30 seconds
3. **Include metrics** — CPU, memory, temperature, battery, etc.
4. **Handle errors** — Retry on failure, don't crash
5. **Use proper timestamps** — ISO 8601 UTC format

That's it! The monitor will handle the rest.
