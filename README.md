# Device Fleet Monitor

A real-time monitoring application that tracks a fleet of devices. Each device sends periodic heartbeats to the application. The application displays device status (ONLINE/OFFLINE) on a web dashboard.

## Features

- **Real-time Dashboard** — Beautiful dark-themed web interface
- **Device Monitoring** — Track device status with automatic 30-second timeout detection
- **Device Registration** — Register devices via web form or automatic creation on first heartbeat
- **Device Details** — Click any device to view detailed information and metrics
- **Device Management** — Delete devices with a single click
- **REST API** — Full API for device registration, heartbeat tracking, and status queries
- **Device Simulator** — Simulate multiple devices for testing

---

## Prerequisites

- **Node.js v18+** — Download from [nodejs.org](https://nodejs.org)
- **npm** — Comes with Node.js

---

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application (One-time)
```bash
npm run build
```

### 3. Start the Server
```bash
npm run dev
```
Server runs at `http://localhost:3000`

### 4. Run the Simulator (In another terminal)
```bash
npm run simulator
```

---

## How to Use

1. Open your browser: `http://localhost:3000`
2. You'll see the dashboard with a registration form
3. Register a device or start the simulator to see devices appear
4. Click on any device to see its details
5. Use the three-dot menu to delete devices
6. Watch devices turn OFFLINE after 30 seconds of no heartbeat

---

## Device Behavior

- **ONLINE** — Device sends heartbeat within last 30 seconds ✅
- **OFFLINE** — No heartbeat received for 30+ seconds ❌
- **Auto-created** — Devices created automatically on first heartbeat
- **Metrics** — Devices can send CPU usage, signal strength, and custom metrics

---

## API Endpoints

```
POST /devices                      - Register a device
POST /devices/{id}/heartbeat       - Send device heartbeat
GET /devices                       - List all devices
GET /devices/{id}                  - Get device details
GET /devices/summary               - Get fleet summary
DELETE /devices/{id}               - Delete a device
```

---

## Testing

Run all tests:
```bash
npm run test:run
```

Tests cover:
- Device registration
- Heartbeat handling
- Device status (ONLINE/OFFLINE)
- 30-second timeout behavior
- API endpoints

---

## Architecture

**Monolithic Service** — Frontend and backend together
- **Backend:** Express.js + TypeScript
- **Frontend:** HTML + CSS + Vanilla JavaScript
- **Storage:** In-memory (no database needed)
- **Status Check:** Background sweep every 5 seconds

---

## File Structure

```
├── src/
│   ├── config.ts              - Configuration
│   ├── main.ts                - Server startup
│   ├── server.ts              - Express setup
│   ├── simulator.ts           - Device simulator
│   ├── types/device.ts        - TypeScript types
│   ├── services/fleetService.ts - Core logic
│   ├── routes/devices.ts      - API endpoints
│   └── tests/                 - Test files
├── public/index.html          - Dashboard UI
├── package.json               - Dependencies
├── tsconfig.json              - TypeScript config
└── README.md                  - This file
```

---

## Example: Send Heartbeat via curl

```bash
curl -X POST http://localhost:3000/devices/device-01/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2026-09-21T14:23:15.123Z",
    "status":"OK",
    "cpu_usage":45,
    "signal_strength":-70
  }'
```

---

## Environment Variables (Optional)

```bash
PORT=3000                          # Server port
HEARTBEAT_TIMEOUT_MS=30000         # 30 second timeout
SWEEP_INTERVAL_MS=5000             # Check every 5 seconds
DEVICES_COUNT=5                    # Simulator device count
```

---

## Notes

- Devices are stored in memory (no persistence)
- All timestamps use UTC/ISO 8601 format
- 30-second timeout is configurable
- Dashboard refreshes every 3 seconds
- Simulator can be stopped with `Ctrl+C`

---

## AI Usage

This project was built with assistance from Kiro AI:
- **Used for:** Architecture design, code generation, test suite, UI styling
- **Verified:** 30-second timeout logic, API behavior, device registration flow
- **Changed:** Improved status computation with background sweep, enhanced UI animations
- **Chats:** Find the chat used to develop this application in the kiro-session-sess_7645079e-ba26-4aa6-b8a2-2d781d23c2ff.zip file
