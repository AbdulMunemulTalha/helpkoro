// Telemetry must be initialised before anything it instruments is imported.
import './instrumentation';
import 'reflect-metadata';
import { createApp } from './bootstrap';

async function main(): Promise<void> {
  const { app, env } = await createApp();
  // Bind to all interfaces so the app is reachable inside containers.
  await app.listen(env.PORT, '0.0.0.0');
}

void main();
