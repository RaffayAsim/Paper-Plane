import { logger } from "./logger.js";

const SUPPORTED_NODE_MAJORS = new Set([20, 22, 24]);

export function warnIfUnsupportedNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);

  if (Number.isNaN(major) || SUPPORTED_NODE_MAJORS.has(major)) {
    return;
  }

  logger.warn(
    `Node.js ${process.versions.node} is outside Prisma 7's supported runtimes. ` +
      "Use Node 20, 22, or 24 if you see unstable MariaDB pool behavior.",
  );
}
