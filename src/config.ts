/**
 * Application configuration
 */

export const config = {
  // Server port
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,

  // Device timeout in milliseconds (30 seconds)
  HEARTBEAT_TIMEOUT_MS: process.env.HEARTBEAT_TIMEOUT_MS
    ? parseInt(process.env.HEARTBEAT_TIMEOUT_MS, 10)
    : 30000,

  // Interval to sweep and mark devices as offline (5 seconds)
  SWEEP_INTERVAL_MS: process.env.SWEEP_INTERVAL_MS
    ? parseInt(process.env.SWEEP_INTERVAL_MS, 10)
    : 5000,

  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',
};
