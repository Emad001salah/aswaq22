import { App } from './app.ts';

const bootstrap = async () => {
  const application = new App();
  await application.start();
};

bootstrap().catch(err => {
  console.error('❌ Failed to start Souq Yemen Architecture:', err);
});
