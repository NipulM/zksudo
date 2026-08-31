import { Router } from "express";
import { adminRouter } from "./v1/admin.router";

export const router = Router();

router.use("/admin", adminRouter);
