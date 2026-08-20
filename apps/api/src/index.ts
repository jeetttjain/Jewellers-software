import { buildServer } from './server.js';
import { env } from './config/env.js';

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 Jewellery POS API server running on http://${env.HOST}:${env.PORT}`);
    console.log(`📋 Health check available at: http://${env.HOST}:${env.PORT}/api/v1/health`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
