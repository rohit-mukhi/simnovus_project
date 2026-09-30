/**
 * Express server setup and middleware configuration
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { config } from './config';
import devicesRouter from './routes/devices';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // Determine the correct path for public directory
  // When running from dist, go up 1 level to reach public
  // When running from src (dev), go up 1 level to reach public
  const publicPath = path.resolve(__dirname, '..', 'public');
  
  console.log(`[DEBUG] Serving static files from: ${publicPath}`);

  // Serve static files from public directory
  app.use(express.static(publicPath));

  // Request logging middleware (development only)
  if (config.NODE_ENV === 'development') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  // Routes
  app.use('/devices', devicesRouter);

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Serve index.html for root path (SPA fallback)
  app.get('/', (req: Request, res: Response) => {
    const indexPath = path.resolve(__dirname, '..', 'public', 'index.html');
    console.log(`[DEBUG] Serving index.html from: ${indexPath}`);
    res.sendFile(indexPath);
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
