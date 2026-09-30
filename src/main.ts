/**
 * Application entry point
 */

import { createApp } from './server';
import { config } from './config';
import { fleetService } from './services/fleetService';

const app = createApp();

// Start the fleet service sweep
fleetService.start();

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  fleetService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  fleetService.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
