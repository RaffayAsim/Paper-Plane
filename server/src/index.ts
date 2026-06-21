import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { warnIfUnsupportedNodeVersion } from "./lib/runtime-checks.js";
import { startBackgroundEmailSync } from "./modules/email/email.service.js";

const app = createApp();
warnIfUnsupportedNodeVersion();
startBackgroundEmailSync();

app.listen(config.PORT, () => {
  logger.info(`API server listening on http://localhost:${config.PORT}${config.API_PREFIX}`);
});
