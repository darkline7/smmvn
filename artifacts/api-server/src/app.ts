import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessions = new Map<string, { userId: number; userRole: string; expires: number }>();

function generateSessionId(): string {
  return crypto.randomUUID();
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const sessionId = req.cookies?.sid;
  if (sessionId && sessions.has(sessionId)) {
    const s = sessions.get(sessionId)!;
    if (s.expires > Date.now()) {
      (req as any)._session = s;
      (req as any)._sessionId = sessionId;
    } else {
      sessions.delete(sessionId);
    }
  }
  next();
});

export function setSession(req: Request, res: Response, data: { userId: number; userRole: string } | null) {
  if (data === null) {
    const sid = (req as any)._sessionId;
    if (sid) sessions.delete(sid);
    res.clearCookie("sid");
    (req as any)._session = undefined;
  } else {
    const sid = generateSessionId();
    const sessionData = { userId: data.userId, userRole: data.userRole, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    sessions.set(sid, sessionData);
    res.cookie("sid", sid, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    (req as any)._session = sessionData;
    (req as any)._sessionId = sid;
  }
}

export function getSession(req: Request): { userId: number; userRole: string } | undefined {
  return (req as any)._session;
}

app.use("/api", router);

export default app;
