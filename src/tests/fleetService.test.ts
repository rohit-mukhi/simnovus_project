/**
 * Fleet Service Tests
 * 
 * Tests for device registration, heartbeat handling, and status computation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FleetService } from '../services/fleetService';

describe('FleetService', () => {
  let service: FleetService;

  beforeEach(() => {
    service = new FleetService();
  });

  afterEach(() => {
    service.stop();
    service.clear();
  });

  describe('registerDevice', () => {
    it('should register a new device', () => {
      const device = service.registerDevice({ id: 'device-01', name: 'Test Device' });

      expect(device.id).toBe('device-01');
      expect(device.name).toBe('Test Device');
      expect(device.status).toBe('OFFLINE');
      expect(device.lastHeartbeat).toBeDefined();
    });

    it('should throw error if device already exists', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      expect(() => {
        service.registerDevice({ id: 'device-01', name: 'Duplicate Device' });
      }).toThrow("Device with id 'device-01' already exists");
    });

    it('should register multiple devices independently', () => {
      const device1 = service.registerDevice({ id: 'device-01', name: 'Device 1' });
      const device2 = service.registerDevice({ id: 'device-02', name: 'Device 2' });

      expect(device1.id).toBe('device-01');
      expect(device2.id).toBe('device-02');
    });
  });

  describe('sendHeartbeat', () => {
    it('should record a heartbeat for registered device', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const timestamp = new Date().toISOString();
      const device = service.sendHeartbeat('device-01', {
        timestamp,
        status: 'OK',
      });

      expect(device.lastHeartbeat.toISOString()).toBe(timestamp);
    });

    it('should throw error if device not found', () => {
      expect(() => {
        service.sendHeartbeat('non-existent', {
          timestamp: new Date().toISOString(),
          status: 'OK',
        });
      }).toThrow("Device with id 'non-existent' not found");
    });

    it('should update device metrics', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const device = service.sendHeartbeat('device-01', {
        timestamp: new Date().toISOString(),
        status: 'OK',
        cpu_usage: 45,
        signal_strength: -70,
      });

      expect(device.metrics?.cpu_usage).toBe(45);
      expect(device.metrics?.signal_strength).toBe(-70);
    });

    it('should store additional custom metrics', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const device = service.sendHeartbeat('device-01', {
        timestamp: new Date().toISOString(),
        status: 'OK',
        temperature: 42.5,
        memory_usage: 512,
      } as any);

      expect(device.metrics?.temperature).toBe(42.5);
      expect(device.metrics?.memory_usage).toBe(512);
    });
  });

  describe('Device Status - 30 Second Timeout', () => {
    it('should mark device as ONLINE within 30 seconds', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const now = new Date();
      const recentTime = new Date(now.getTime() - 20000).toISOString(); // 20 seconds ago

      const device = service.sendHeartbeat('device-01', {
        timestamp: recentTime,
        status: 'OK',
      });

      expect(device.status).toBe('ONLINE');
    });

    it('should mark device as OFFLINE after 30 seconds', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const now = new Date();
      vi.setSystemTime(now);

      // Send heartbeat at T=0
      service.sendHeartbeat('device-01', {
        timestamp: now.toISOString(),
        status: 'OK',
      });

      // Check status immediately - should be ONLINE
      let device = service.getDevice('device-01');
      expect(device.status).toBe('ONLINE');

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      // Check status - should now be OFFLINE
      device = service.getDevice('device-01');
      expect(device.status).toBe('OFFLINE');

      vi.useRealTimers();
    });

    it('should transition from ONLINE to OFFLINE after timeout', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Test Device' });
      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      // Send heartbeat at T=0
      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // At T=20s, should be ONLINE
      vi.advanceTimersByTime(20000);
      let device = service.getDevice('device-01');
      expect(device.status).toBe('ONLINE');

      // At T=35s, should be OFFLINE
      vi.advanceTimersByTime(15000);
      device = service.getDevice('device-01');
      expect(device.status).toBe('OFFLINE');

      vi.useRealTimers();
    });

    it('should handle boundary case at exactly 30 seconds', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Test Device' });
      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // At exactly 30 seconds, device should still be ONLINE
      vi.advanceTimersByTime(30000);
      let device = service.getDevice('device-01');
      expect(device.status).toBe('ONLINE');

      // At 30001 milliseconds, device should be OFFLINE
      vi.advanceTimersByTime(1);
      device = service.getDevice('device-01');
      expect(device.status).toBe('OFFLINE');

      vi.useRealTimers();
    });

    it('should reset timeout on new heartbeat', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Test Device' });
      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      // Send first heartbeat at T=0
      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance to T=20s
      vi.advanceTimersByTime(20000);
      let device = service.getDevice('device-01');
      expect(device.status).toBe('ONLINE');

      // Send second heartbeat at T=20s
      const time20s = new Date(baseTime.getTime() + 20000);
      service.sendHeartbeat('device-01', {
        timestamp: time20s.toISOString(),
        status: 'OK',
      });

      // Advance to T=45s (25s after second heartbeat)
      vi.advanceTimersByTime(25000);
      device = service.getDevice('device-01');
      expect(device.status).toBe('ONLINE');

      // Advance to T=51s (31s after second heartbeat)
      vi.advanceTimersByTime(6000);
      device = service.getDevice('device-01');
      expect(device.status).toBe('OFFLINE');

      vi.useRealTimers();
    });
  });

  describe('getDevice', () => {
    it('should retrieve a registered device', () => {
      service.registerDevice({ id: 'device-01', name: 'Test Device' });

      const device = service.getDevice('device-01');

      expect(device.id).toBe('device-01');
      expect(device.name).toBe('Test Device');
    });

    it('should throw error if device not found', () => {
      expect(() => {
        service.getDevice('non-existent');
      }).toThrow("Device with id 'non-existent' not found");
    });

    it('should always compute fresh status', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Test Device' });
      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      // Get device should show OFFLINE even though we never explicitly called sweep
      const device = service.getDevice('device-01');
      expect(device.status).toBe('OFFLINE');

      vi.useRealTimers();
    });
  });

  describe('getAllDevices', () => {
    it('should return empty array initially', () => {
      const devices = service.getAllDevices();
      expect(devices).toEqual([]);
    });

    it('should return all registered devices', () => {
      service.registerDevice({ id: 'device-01', name: 'Device 1' });
      service.registerDevice({ id: 'device-02', name: 'Device 2' });

      const devices = service.getAllDevices();

      expect(devices).toHaveLength(2);
      expect(devices.map((d) => d.id)).toContain('device-01');
      expect(devices.map((d) => d.id)).toContain('device-02');
    });

    it('should compute status for all devices', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Device 1' });
      service.registerDevice({ id: 'device-02', name: 'Device 2' });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      service.sendHeartbeat('device-02', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // All online initially
      let devices = service.getAllDevices();
      expect(devices.every((d) => d.status === 'ONLINE')).toBe(true);

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      // All should now be offline
      devices = service.getAllDevices();
      expect(devices.every((d) => d.status === 'OFFLINE')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for empty fleet', () => {
      const summary = service.getSummary();

      expect(summary.total).toBe(0);
      expect(summary.online).toBe(0);
      expect(summary.offline).toBe(0);
    });

    it('should return correct summary with all online', () => {
      service.registerDevice({ id: 'device-01', name: 'Device 1' });
      service.registerDevice({ id: 'device-02', name: 'Device 2' });

      // Send heartbeats to bring devices online
      const now = new Date();
      service.sendHeartbeat('device-01', {
        timestamp: now.toISOString(),
        status: 'OK',
      });
      service.sendHeartbeat('device-02', {
        timestamp: now.toISOString(),
        status: 'OK',
      });

      const summary = service.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.online).toBe(2);
      expect(summary.offline).toBe(0);
    });

    it('should return correct summary with offline devices', () => {
      vi.useFakeTimers();

      service.registerDevice({ id: 'device-01', name: 'Device 1' });
      service.registerDevice({ id: 'device-02', name: 'Device 2' });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      service.sendHeartbeat('device-01', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // device-02 never gets a heartbeat, so it's registered but will show as offline after timeout
      service.sendHeartbeat('device-02', {
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      const summary = service.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.online).toBe(0);
      expect(summary.offline).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('deviceExists', () => {
    it('should return true for registered device', () => {
      service.registerDevice({ id: 'device-01', name: 'Device 1' });

      expect(service.deviceExists('device-01')).toBe(true);
    });

    it('should return false for non-existent device', () => {
      expect(service.deviceExists('non-existent')).toBe(false);
    });
  });

  describe('start and stop', () => {
    it('should start and stop the sweep interval', () => {
      const service = new FleetService();

      service.start();
      expect(service['sweepInterval']).toBeDefined();

      service.stop();
      expect(service['sweepInterval']).toBeNull();
    });

    it('should not throw error when stopping without starting', () => {
      const service = new FleetService();

      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });
});
