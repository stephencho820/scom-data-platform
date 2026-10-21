import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
const ROOT = process.cwd();
const output = path.join(ROOT, "public");
await mkdir(output, { recursive: true });
for (const [source, destination] of [
  ["web/agent.html", "index.html"],
  ["web/agent.css", "agent.css"],
  ["web/agent.js", "agent.js"]
]) await copyFile(path.join(ROOT, source), path.join(output, destination));
await writeFile(path.join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log("Shopping Agent static frontend built in public/");
