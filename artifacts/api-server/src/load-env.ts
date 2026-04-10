import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(currentDir, "..", ".env"),
];

for (const envPath of envCandidates) {
  if (!fs.existsSync(envPath)) continue;

  try {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;

      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();

      if (
        (val.startsWith("\"") && val.endsWith("\"")) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
    break;
  } catch (error) {
    console.warn(`[startup] Could not read ${envPath}:`, error);
  }
}
