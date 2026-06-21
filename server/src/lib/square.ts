import { SquareClient, SquareEnvironment } from "square";
import { config } from "./config.js";

const isProduction = process.env.NODE_ENV === "production" && !config.SQUARE_ACCESS_TOKEN?.startsWith("sandbox-");

export const squareClient = config.SQUARE_ACCESS_TOKEN
  ? new SquareClient({
      token: config.SQUARE_ACCESS_TOKEN,
      environment: isProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    })
  : null;

