// OpenTelemetry bootstrap. This module MUST be imported before Nest/Fastify or
// any instrumented library (http, pg) so the auto-instrumentations can patch
// them as they load — hence it is the very first import in `main.ts`.
//
// Tracing is opt-in: with no `OTEL_EXPORTER_OTLP_ENDPOINT` set, the SDK starts
// with no exporter (spans are created but dropped) so the API runs fine without
// a collector. When the endpoint is set, spans go to it over OTLP/HTTP.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'helpkoro-api';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
  // Read the endpoint from the environment (OTEL_EXPORTER_OTLP_*). Undefined ⇒
  // no exporter ⇒ no-op tracing, which is the correct default without a backend.
  traceExporter: otlpEndpoint ? new OTLPTraceExporter() : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Filesystem spans are extremely noisy and rarely useful.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
} catch {
  // Never let telemetry setup crash the process; the API must still serve.
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void sdk.shutdown().catch(() => undefined);
  });
}
