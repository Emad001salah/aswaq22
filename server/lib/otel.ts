import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { logger } from './logger.ts';

// Setup Prometheus metrics exporter (scraped via Express route)
export const prometheusExporter = new PrometheusExporter({
  preventServerStart: true,
});

const sdk = new NodeSDK({
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Reduce noise from local filesystem reads
      },
    }),
  ],
});

if (process.env.NODE_ENV !== 'test') {
  try {
    sdk.start();
    logger.info('[OTel] OpenTelemetry SDK initialized successfully.');
  } catch (error: any) {
    logger.error('[OTel] Error starting OpenTelemetry SDK:', error.message);
  }
}

export { sdk };
