import "dotenv/config";
import { loadEnvironment } from "./config/env.js";
import { buildApp } from "./interfaces/http/app.js";

const environment = loadEnvironment();
const app = buildApp(environment);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: environment.PORT, host: environment.HOST });
