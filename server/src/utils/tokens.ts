import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { config } from "../lib/config.js";

const accessTokenOptions: SignOptions = {
  expiresIn: config.JWT_ACCESS_TTL as SignOptions["expiresIn"],
};

const refreshTokenOptions: SignOptions = {
  expiresIn: `${config.JWT_REFRESH_TTL_DAYS}d` as SignOptions["expiresIn"],
};

export function signAccessToken(payload: {
  userId: string;
  email: string;
  roles: string[];
  subscriptionPlan: string;
  impersonatedByUserId?: string;
  impersonatedByEmail?: string;
  impersonatedByDisplayName?: string;
}) {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, accessTokenOptions);
}

export function signRefreshToken(payload: {
  userId: string;
  impersonatedByUserId?: string;
  impersonatedByEmail?: string;
  impersonatedByDisplayName?: string;
}) {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, refreshTokenOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as {
    userId: string;
    email: string;
    roles: string[];
    subscriptionPlan: string;
    impersonatedByUserId?: string;
    impersonatedByEmail?: string;
    impersonatedByDisplayName?: string;
  };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as {
    userId: string;
    impersonatedByUserId?: string;
    impersonatedByEmail?: string;
    impersonatedByDisplayName?: string;
    iat: number;
    exp: number;
  };
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
