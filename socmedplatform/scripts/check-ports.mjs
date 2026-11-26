// Checks that the ports this app wants are free before starting, so it never collides with other local services.
// Usage: node scripts/check-ports.mjs [appPort] [dbPort]
import net from "node:net";

const appPort = Number(process.argv[2] ?? process.env.PORT ?? 3107);
const dbPort = Number(process.argv[3] ?? 55432);

const free = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });

const results = [[`App (Next.js)`, appPort], [`Database (Postgres container)`, dbPort]];
let ok = true;
for (const [label, port] of results) {
  const isFree = await free(port);
  console.log(`${isFree ? "✓ free " : "✗ IN USE"}  ${port}  ${label}`);
  if (!isFree) ok = false;
}
if (!ok) {
  console.log("\nA port is taken. Either stop what's using it, or pick another port:");
  console.log("  App:      npm run dev -- -p 3207   (and set APP_URL in .env to match)");
  console.log("  Database: change 55432 in docker-compose.yml AND in DATABASE_URL in .env");
  console.log("  (If the database port is in use by majlis-db itself, that's fine — it's already running.)");
  process.exitCode = 1;
}
