import { spawn } from "node:child_process";

async function isUp(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

let vite = null;
if (!(await isUp("http://localhost:5173"))) {
  vite = spawn("npx", ["vite", "--port", "5173", "--strictPort"], {
    stdio: "inherit",
    shell: true,
  });
}

const env = { ...process.env, SLIDEAGENT_URL: "http://localhost:5173" };
delete env.ELECTRON_RUN_AS_NODE;

const electron = spawn("npx", ["electron", "."], {
  stdio: "inherit",
  shell: true,
  env,
});

const stop = () => {
  vite?.kill();
  electron.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
electron.on("exit", (code) => {
  vite?.kill();
  process.exit(code ?? 0);
});
