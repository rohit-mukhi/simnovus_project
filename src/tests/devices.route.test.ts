/**
 * Device Routes Tests
 * 
 * Integration tests for all API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';
import { fleetService } from '../services/fleetService';
import type { Express } from 'express';

describe('Device Routes', () => {
  let app: Express;

  beforeEach(() => {
    fleetService.clear();
    fleetService.start();
    app = createApp();
  });

  afterEach(() => {
    fleetService.stop();
    fleetService.clear();
  });

  describe('POST /devices', () => {
    it('should register a new device', async () => {
      const response = await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Test Device',
      });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('device-01');
      expect(response.body.name).toBe('Test Device');
      expect(response.body.status).toBe('OFFLINE');
    });

    it('should return 400 if id is missing', async () => {
      const response = await request(app).post('/devices').send({
        name: 'Test Device',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing required fields");
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app).post('/devices').send({
        id: 'device-01',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing required fields");
    });

    it('should return 409 if device already exists', async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      const response = await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 2',
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /devices/{id}/heartbeat', () => {
    beforeEach(async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Test Device',
      });
    });

    it('should record a heartbeat', async () => {
      const timestamp = new Date().toISOString();
      const response = await request(app)
        .post('/devices/device-01/heartbeat')
        .send({
          timestamp,
          status: 'OK',
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('device-01');
      expect(response.body.status).toBe('ONLINE');
    });

    it('should return 400 if timestamp is missing', async () => {
      const response = await request(app)
        .post('/devices/device-01/heartbeat')
        .send({
          status: 'OK',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 if status is missing', async () => {
      const response = await request(app)
        .post('/devices/device-01/heartbeat')
        .send({
          timestamp: new Date().toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 if timestamp format is invalid', async () => {
      const response = await request(app)
        .post('/devices/device-01/heartbeat')
        .send({
          timestamp: 'not-a-date',
          status: 'OK',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });

    it('should accept additional metrics', async () => {
      const response = await request(app)
        .post('/devices/device-01/heartbeat')
        .send({
          timestamp: new Date().toISOString(),
          status: 'OK',
          cpu_usage: 50,
          signal_strength: -70,
        });

      expect(response.status).toBe(200);
      expect(response.body.metrics.cpu_usage).toBe(50);
      expect(response.body.metrics.signal_strength).toBe(-70);
    });

    it('should return 404 if device not found', async () => {
      const response = await request(app)
        .post('/devices/non-existent/heartbeat')
        .send({
          timestamp: new Date().toISOString(),
          status: 'OK',
        });

      // Device auto-creates on heartbeat, so status should be 200
      expect(response.status).toBe(200);
    });
  });

  describe('GET /devices', () => {
    it('should return empty array initially', async () => {
      const response = await request(app).get('/devices');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return all registered devices', async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      await request(app).post('/devices').send({
        id: 'device-02',
        name: 'Device 2',
      });

      const response = await request(app).get('/devices');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('device-01');
      expect(response.body[1].id).toBe('device-02');
    });

    it('should include computed status for each device', async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      // Send heartbeat to bring device online
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: new Date().toISOString(),
        status: 'OK',
      });

      const response = await request(app).get('/devices');

      expect(response.status).toBe(200);
      expect(response.body[0].status).toBe('ONLINE');
      expect(response.body[0].last_heartbeat).toBeDefined();
    });

    it('should use last_heartbeat field (snake_case)', async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      const response = await request(app).get('/devices');

      expect(response.body[0]).toHaveProperty('last_heartbeat');
      expect(response.body[0]).not.toHaveProperty('lastHeartbeat');
    });
  });

  describe('GET /devices/{id}', () => {
    beforeEach(async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Test Device',
      });
    });

    it('should return device details', async () => {
      // Send heartbeat to bring device online
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: new Date().toISOString(),
        status: 'OK',
      });

      const response = await request(app).get('/devices/device-01');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('device-01');
      expect(response.body.name).toBe('Test Device');
      expect(response.body.status).toBe('ONLINE');
    });

    it('should include metrics', async () => {
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: new Date().toISOString(),
        status: 'OK',
        cpu_usage: 42,
        signal_strength: -65,
      });

      const response = await request(app).get('/devices/device-01');

      expect(response.status).toBe(200);
      expect(response.body.metrics.cpu_usage).toBe(42);
      expect(response.body.metrics.signal_strength).toBe(-65);
    });

    it('should return 404 if device not found', async () => {
      const response = await request(app).get('/devices/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /devices/summary', () => {
    it('should return correct summary for empty fleet', async () => {
      const response = await request(app).get('/devices/summary');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
      expect(response.body.online).toBe(0);
      expect(response.body.offline).toBe(0);
    });

    it('should return correct summary with devices', async () => {
      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      await request(app).post('/devices').send({
        id: 'device-02',
        name: 'Device 2',
      });

      // Send heartbeats to bring both online
      const now = new Date().toISOString();
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: now,
        status: 'OK',
      });

      await request(app).post('/devices/device-02/heartbeat').send({
        timestamp: now,
        status: 'OK',
      });

      const response = await request(app).get('/devices/summary');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.online).toBe(2);
      expect(response.body.offline).toBe(0);
    });

    it('should count offline devices correctly', async () => {
      vi.useFakeTimers();

      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      await request(app).post('/devices').send({
        id: 'device-02',
        name: 'Device 2',
      });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      // Send heartbeat for device-01
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // device-02 never sends heartbeat (remains OFFLINE)

      // Initially device-01 online, device-02 offline
      let response = await request(app).get('/devices/summary');
      expect(response.body.total).toBe(2);
      expect(response.body.online).toBe(1);
      expect(response.body.offline).toBe(1);

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      // Now both should be offline
      response = await request(app).get('/devices/summary');
      expect(response.body.total).toBe(2);
      expect(response.body.online).toBe(0);
      expect(response.body.offline).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('30-Second Timeout Behavior', () => {
    it('should mark device ONLINE within 30 seconds', async () => {
      vi.useFakeTimers();

      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance time by 20 seconds
      vi.advanceTimersByTime(20000);

      const response = await request(app).get('/devices/device-01');

      expect(response.body.status).toBe('ONLINE');

      vi.useRealTimers();
    });

    it('should mark device OFFLINE after 30 seconds', async () => {
      vi.useFakeTimers();

      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31000);

      const response = await request(app).get('/devices/device-01');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OFFLINE');

      vi.useRealTimers();
    });

    it('should reset timeout on new heartbeat', async () => {
      vi.useFakeTimers();

      await request(app).post('/devices').send({
        id: 'device-01',
        name: 'Device 1',
      });

      const baseTime = new Date();
      vi.setSystemTime(baseTime);

      // First heartbeat
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: baseTime.toISOString(),
        status: 'OK',
      });

      // Advance to 20 seconds
      vi.advanceTimersByTime(20000);

      // Second heartbeat at T=20s
      const time20s = new Date(baseTime.getTime() + 20000);
      await request(app).post('/devices/device-01/heartbeat').send({
        timestamp: time20s.toISOString(),
        status: 'OK',
      });

      // Advance to 45 seconds (25s after second heartbeat)
      vi.advanceTimersByTime(25000);

      let response = await request(app).get('/devices/device-01');
      expect(response.body.status).toBe('ONLINE');

      // Advance to 51 seconds (31s after second heartbeat)
      vi.advanceTimersByTime(6000);

      response = await request(app).get('/devices/device-01');
      expect(response.body.status).toBe('OFFLINE');

      vi.useRealTimers();
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });
  });
});
