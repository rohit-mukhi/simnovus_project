/**
 * Fleet Management Service
 * 
 * Handles device registration, heartbeat tracking, and status computation
 */

import { Device, DeviceStatus, HeartbeatRequest, DeviceRegistrationRequest, FleetSummary } from '../types/device';
import { config } from '../config';

export class FleetService {
  private devices: Map<string, Device> = new Map();
  private sweepInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the service and start the staleness sweep
   */
  public start(): void {
    this.sweepInterval = setInterval(() => {
      this.sweepStaleDevices();
    }, config.SWEEP_INTERVAL_MS);
  }

  /**
   * Stop the service and clear the sweep interval
   */
  public stop(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  /**
   * Register a new device
   * @throws Error if device already exists
   * Device starts as OFFLINE until it sends first heartbeat
   */
  public registerDevice(req: DeviceRegistrationRequest): Device {
    if (this.devices.has(req.id)) {
      throw new Error(`Device with id '${req.id}' already exists`);
    }

    // Set lastHeartbeat to far in the past so device shows as OFFLINE
    // Device will become ONLINE when it sends first heartbeat
    const farPast = new Date(Date.now() - config.HEARTBEAT_TIMEOUT_MS - 1000);

    const device: Device = {
      id: req.id,
      name: req.name,
      lastHeartbeat: farPast,
      status: 'OFFLINE',
      metrics: {},
    };

    this.devices.set(req.id, device);
    return device;
  }

  /**
   * Record a heartbeat for a device
   * @throws Error if device does not exist
   */
  public sendHeartbeat(deviceId: string, req: HeartbeatRequest): Device {
    const device = this.devices.get(deviceId);

    if (!device) {
      throw new Error(`Device with id '${deviceId}' not found`);
    }

    // Update the heartbeat timestamp
    device.lastHeartbeat = new Date(req.timestamp);

    // Update metrics if provided
    if (req.cpu_usage !== undefined) {
      device.metrics!.cpu_usage = req.cpu_usage;
    }
    if (req.signal_strength !== undefined) {
      device.metrics!.signal_strength = req.signal_strength;
    }

    // Store any additional metrics
    for (const [key, value] of Object.entries(req)) {
      if (!['timestamp', 'status'].includes(key)) {
        device.metrics![key] = value;
      }
    }

    // Compute and update status
    device.status = this.computeStatus(device);

    return device;
  }

  /**
   * Get a single device by ID with current status
   * @throws Error if device does not exist
   */
  public getDevice(deviceId: string): Device {
    const device = this.devices.get(deviceId);

    if (!device) {
      throw new Error(`Device with id '${deviceId}' not found`);
    }

    // Always recompute status to ensure freshness
    device.status = this.computeStatus(device);
    return device;
  }

  /**
   * Get all devices with current status
   */
  public getAllDevices(): Device[] {
    const devices = Array.from(this.devices.values());
    
    // Recompute status for all devices
    devices.forEach(device => {
      device.status = this.computeStatus(device);
    });

    return devices;
  }

  /**
   * Get fleet summary
   */
  public getSummary(): FleetSummary {
    const allDevices = this.getAllDevices();
    
    return {
      total: allDevices.length,
      online: allDevices.filter(d => d.status === 'ONLINE').length,
      offline: allDevices.filter(d => d.status === 'OFFLINE').length,
    };
  }

  /**
   * Check if device exists
   */
  public deviceExists(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }

  /**
   * Compute device status based on heartbeat timeout
   * @private
   */
  private computeStatus(device: Device): DeviceStatus {
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - device.lastHeartbeat.getTime();

    return timeSinceHeartbeat <= config.HEARTBEAT_TIMEOUT_MS ? 'ONLINE' : 'OFFLINE';
  }

  /**
   * Sweep through all devices and update status of stale ones
   * @private
   */
  private sweepStaleDevices(): void {
    this.devices.forEach(device => {
      device.status = this.computeStatus(device);
    });
  }

  /**
   * Delete a device and all its data
   */
  public deleteDevice(deviceId: string): boolean {
    if (this.devices.has(deviceId)) {
      this.devices.delete(deviceId);
      return true;
    }
    return false;
  }

  /**
   * Clear all devices (useful for testing)
   * @private
   */
  public clear(): void {
    this.devices.clear();
  }
}

// Export singleton instance
export const fleetService = new FleetService();
