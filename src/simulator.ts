/**
 * Device Simulator
 * 
 * Simulates multiple devices sending heartbeats to the fleet monitor API
 */

import http from 'http';

interface SimulatedDevice {
  id: string;
  name: string;
  interval: NodeJS.Timeout | null;
}

const API_BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const DEVICES_COUNT = parseInt(process.env.DEVICES_COUNT || '5', 10);
const HEARTBEAT_MIN_INTERVAL = parseInt(process.env.HEARTBEAT_MIN_INTERVAL || '5000', 10);
const HEARTBEAT_MAX_INTERVAL = parseInt(process.env.HEARTBEAT_MAX_INTERVAL || '15000', 10);

const devices: SimulatedDevice[] = [];
let stopRequested = false;

/**
 * Generate a random interval between min and max
 */
function getRandomInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Make HTTP request
 */
function makeRequest(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode || 200, data: jsonData });
        } catch {
          resolve({ status: res.statusCode || 200, data: null });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Register a device
 */
async function registerDevice(deviceId: string, deviceName: string): Promise<boolean> {
  try {
    const response = await makeRequest('POST', '/devices', {
      id: deviceId,
      name: deviceName,
    });

    if (response.status === 201) {
      console.log(`[REGISTERED] Device ${deviceId}`);
      return true;
    } else if (response.status === 409) {
      console.log(`[ALREADY_EXISTS] Device ${deviceId}`);
      return true;
    } else {
      console.error(`[ERROR] Failed to register device ${deviceId}:`, response.data);
      return false;
    }
  } catch (error: any) {
    console.error(`[ERROR] Failed to register device ${deviceId}:`, error.message);
    return false;
  }
}

/**
 * Send a heartbeat for a device
 */
async function sendHeartbeat(deviceId: string): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    const cpuUsage = Math.floor(Math.random() * 100);
    const signalStrength = -50 - Math.floor(Math.random() * 50); // -50 to -100

    const response = await makeRequest(`POST`, `/devices/${deviceId}/heartbeat`, {
      timestamp,
      status: 'OK',
      cpu_usage: cpuUsage,
      signal_strength: signalStrength,
    });

    if (response.status === 200) {
      console.log(`[HEARTBEAT] ${deviceId} at ${timestamp} (CPU: ${cpuUsage}%, Signal: ${signalStrength}dBm)`);
      return true;
    } else if (response.status === 404) {
      console.error(`[ERROR] Device ${deviceId} not found`);
      return false;
    } else {
      console.error(`[ERROR] Failed to send heartbeat for ${deviceId}:`, response.data);
      return false;
    }
  } catch (error: any) {
    console.error(`[ERROR] Failed to send heartbeat for ${deviceId}:`, error.message);
    return false;
  }
}

/**
 * Start sending heartbeats for a device
 */
function startDeviceHeartbeat(device: SimulatedDevice): void {
  const sendNextHeartbeat = async () => {
    if (!stopRequested) {
      await sendHeartbeat(device.id);

      const nextInterval = getRandomInterval(HEARTBEAT_MIN_INTERVAL, HEARTBEAT_MAX_INTERVAL);
      device.interval = setTimeout(sendNextHeartbeat, nextInterval);
    }
  };

  sendNextHeartbeat();
}

/**
 * Stop heartbeat for a device
 */
function stopDeviceHeartbeat(deviceId: string): void {
  const device = devices.find((d) => d.id === deviceId);
  if (device && device.interval) {
    clearTimeout(device.interval);
    device.interval = null;
    console.log(`[STOPPED] Device ${deviceId} stopped sending heartbeats`);
  }
}

/**
 * Initialize and start the simulator
 */
async function startSimulator(): Promise<void> {
  console.log(`\n🚀 Device Fleet Simulator`);
  console.log(`📡 Target API: ${API_BASE_URL}`);
  console.log(`📊 Simulating ${DEVICES_COUNT} devices`);
  console.log(`⏱️  Heartbeat interval: ${HEARTBEAT_MIN_INTERVAL}-${HEARTBEAT_MAX_INTERVAL}ms\n`);

  // Create device list
  for (let i = 1; i <= DEVICES_COUNT; i++) {
    const deviceId = `device-${String(i).padStart(2, '0')}`;
    const deviceName = `Simulated Device ${i}`;
    devices.push({
      id: deviceId,
      name: deviceName,
      interval: null,
    });
  }

  // Register all devices
  console.log('📝 Registering devices...');
  for (const device of devices) {
    const success = await registerDevice(device.id, device.name);
    if (!success) {
      console.error(`Failed to register ${device.id}, continuing anyway...`);
    }
  }

  console.log('\n📤 Starting heartbeat streams...');
  for (const device of devices) {
    startDeviceHeartbeat(device);
  }

  console.log(`\n✅ Simulator running. ${DEVICES_COUNT} devices sending heartbeats.\n`);
  console.log('💡 Commands:');
  console.log('  - Press Ctrl+C to stop all devices');
  console.log('  - Type "stop <device-id>" to stop a specific device');
  console.log('  - Type "status" to see current device list');
  console.log('');
}

/**
 * Handle command input
 */
function setupCommandHandler(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  let commandBuffer = '';

  process.stdin.on('data', (data) => {
    const char = data.toString();

    if (char === '\n' || char === '\r') {
      if (commandBuffer.trim()) {
        handleCommand(commandBuffer.trim());
      }
      commandBuffer = '';
    } else if (char === '\u0003') {
      // Ctrl+C
      shutdown();
    } else {
      commandBuffer += char;
    }
  });
}

/**
 * Handle user commands
 */
function handleCommand(command: string): void {
  const parts = command.split(' ');
  const action = parts[0].toLowerCase();

  if (action === 'stop' && parts[1]) {
    const deviceId = parts[1];
    stopDeviceHeartbeat(deviceId);
  } else if (action === 'status') {
    console.log(`\n📊 Device Status:`);
    devices.forEach((device) => {
      const running = device.interval !== null ? '✅ Running' : '❌ Stopped';
      console.log(`  ${device.id}: ${running}`);
    });
    console.log('');
  } else {
    console.log(`Unknown command: ${action}`);
  }
}

/**
 * Shutdown gracefully
 */
function shutdown(): void {
  console.log('\n\n🛑 Shutting down...');
  stopRequested = true;

  devices.forEach((device) => {
    if (device.interval) {
      clearTimeout(device.interval);
    }
  });

  console.log('✅ All devices stopped');
  process.exit(0);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Start the simulator
  await startSimulator();

  // Setup command handler for interactive control
  setupCommandHandler();

  // Handle process signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Simulator error:', error);
  process.exit(1);
});
