import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  createPasswordResetToken,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  resetPassword,
} from "./auth.service.js";

const router = Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(2).max(120),
        phoneNumber: z.string().min(1, "Phone number is required"),
      })
      .parse(req.body);

    const session = await registerUser(body);
    res.status(201).json(session);
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(req.body);

    const session = await loginUser(body);
    res.json(session);
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    const session = await refreshUserSession(body.refreshToken);
    res.json(session);
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    await logoutUser(body.refreshToken);
    res.status(204).send();
  }),
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const result = await createPasswordResetToken(body.email);
    res.json({
      message: "If the email exists, a reset token has been generated.",
      resetToken: result.token,
    });
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8),
      })
      .parse(req.body);

    await resetPassword(body.token, body.password);
    res.status(204).send();
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.currentUser,
    });
  }),
);

export const authRouter = router;
