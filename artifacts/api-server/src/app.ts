import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import router from "./routes/index.js";

const app: Express = express();

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_SALT || "smm-panel-salt-2024";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

interface SessionData {
  userId: number;
  userRole: string;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.sid;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as SessionData;
      (req as any)._session = { userId: payload.userId, userRole: payload.userRole };
    } catch {
      // expired or invalid token — session stays undefined
    }
  }
  next();
});

export function setSession(req: Request, res: Response, data: SessionData | null) {
  if (data === null) {
    res.clearCookie("sid", { httpOnly: true, sameSite: "lax" });
    (req as any)._session = undefined;
  } else {
    const token = jwt.sign(
      { userId: data.userId, userRole: data.userRole },
      JWT_SECRET,
      { expiresIn: COOKIE_MAX_AGE_SECONDS }
    );
    res.cookie("sid", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
    });
    (req as any)._session = { userId: data.userId, userRole: data.userRole };
  }
}

export function getSession(req: Request): SessionData | undefined {
  return (req as any)._session;
}

app.use("/api", router);

export default app;
