import { spawn } from "node:child_process";

const processes = [];
let shuttingDown = false;

function start(name, command, args, extraEnv) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[dev] ${name} exited with ${reason}`);
    shutdown(typeof code === "number" ? code : 1);
  });

  processes.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start(
  "api",
  "pnpm.cmd",
  ["--filter", "@workspace/api-server", "dev"],
  {
    PORT: "3000",
    NODE_ENV: "development",
    SITE_URL: "http://localhost:5173",
  },
);

start(
  "web",
  "pnpm.cmd",
  ["--filter", "@workspace/smm-panel", "dev"],
  {
    PORT: "5173",
    VITE_API_BASE_URL: "http://localhost:3000",
    VITE_API_ORIGIN: "http://localhost:3000",
  },
);
