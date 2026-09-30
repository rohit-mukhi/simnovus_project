/**
 * Device routes
 * 
 * Endpoints:
 * - POST /devices                    - Register a device
 * - POST /devices/{id}/heartbeat     - Send a heartbeat
 * - GET /devices                     - List all devices
 * - GET /devices/summary             - Get fleet summary
 * - GET /devices/{id}                - Get single device
 */

import { Router, Request, Response } from 'express';
import { fleetService } from '../services/fleetService';
import { DeviceRegistrationRequest, HeartbeatRequest } from '../types/device';

const router = Router();

/**
 * POST /devices
 * Register a new device
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { id, name } = req.body as DeviceRegistrationRequest;

    if (!id || !name) {
      return res.status(400).json({
        error: "Missing required fields: 'id' and 'name'",
      });
    }

    const device = fleetService.registerDevice({ id, name });

    res.status(201).json(device);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /devices/{id}/heartbeat
 * Record a heartbeat for a device
 * Auto-creates device if it doesn't exist
 */
router.post('/:id/heartbeat', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const heartbeatReq = req.body as HeartbeatRequest;

    if (!heartbeatReq.timestamp || !heartbeatReq.status) {
      return res.status(400).json({
        error: "Missing required fields: 'timestamp' and 'status'",
      });
    }

    // Validate timestamp is ISO format
    const heartbeatDate = new Date(heartbeatReq.timestamp);
    if (isNaN(heartbeatDate.getTime())) {
      return res.status(400).json({
        error: "Invalid 'timestamp' format. Use ISO 8601 format (e.g., 2026-09-21T10:30:00Z)",
      });
    }

    // Auto-create device if it doesn't exist
    if (!fleetService.deviceExists(id)) {
      console.log(`[AUTO-CREATE] Device ${id} created on first heartbeat`);
      
      // Get device name from heartbeat or use default
      const deviceName = (heartbeatReq as any).device_name || `Device ${id}`;
      
      fleetService.registerDevice({ 
        id: id, 
        name: deviceName 
      });
    }

    const device = fleetService.sendHeartbeat(id, heartbeatReq);

    res.status(200).json(device);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /devices
 * List all devices
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const devices = fleetService.getAllDevices();

    // Format response to match specification
    const response = devices.map(device => ({
      id: device.id,
      name: device.name,
      status: device.status,
      last_heartbeat: device.lastHeartbeat.toISOString(),
    }));

    res.status(200).json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /devices/summary
 * Get fleet summary - MUST come BEFORE /:id route to work correctly
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = fleetService.getSummary();
    res.status(200).json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /devices/{id}
 * Get details for a single device
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = fleetService.getDevice(id);

    const response = {
      id: device.id,
      name: device.name,
      status: device.status,
      last_heartbeat: device.lastHeartbeat.toISOString(),
      metrics: device.metrics || {},
    };

    res.status(200).json(response);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /devices/{id}
 * Delete a device and all its data
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = fleetService.deleteDevice(id);

    if (deleted) {
      res.status(200).json({ message: `Device ${id} deleted successfully` });
    } else {
      res.status(404).json({ error: `Device with id '${id}' not found` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
