// Dummy fallback exporter for serverless (Vercel) environment to prevent heavy bundle overhead
export const prometheusExporter = {
  getMetricsHTTP: async () => '# Prometheus metrics disabled on serverless\n'
};

export const sdk = {
  start: () => {},
  shutdown: async () => {}
};

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');

    const realExporter = new PrometheusExporter({ preventServerStart: true });
    const realSdk = new NodeSDK({
      metricReader: realExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });
    realSdk.start();
    logger.info('[OTel] OpenTelemetry SDK initialized successfully.');
  } catch (error: any) {
    logger.warn('[OTel] OpenTelemetry SDK skipped or not loaded:', error?.message || error);
  }
}
