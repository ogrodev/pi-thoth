/**
 * Ollama Bootstrap
 *
 * Checks, installs, starts, and validates Ollama + a required embedding model.
 * Ported from scripts/setup-local-first.sh with richer diagnostics.
 */

import { spawnSync, spawn } from "child_process";

export interface BootstrapOptions {
  /** Embedding model to ensure is present. Default: "nomic-embed-text:latest" */
  model: string;
  /** Ollama API base URL. Default: process.env.OLLAMA_HOST || "http://localhost:11434" */
  baseURL: string;
}

export interface BootstrapResult {
  success: boolean;
  messages: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(url: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(tid);
  }
}

async function postJSON(
  url: string,
  body: unknown,
  timeoutMs = 300_000,
): Promise<void> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    // Drain the stream so pull progress completes
    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  } finally {
    clearTimeout(tid);
  }
}

async function isApiReachable(baseURL: string): Promise<boolean> {
  try {
    await fetchJSON(`${baseURL}/api/tags`, 5000);
    return true;
  } catch {
    return false;
  }
}

function hasCli(name: string): boolean {
  const r = spawnSync("which", [name], { encoding: "utf8" });
  return r.status === 0;
}

function isRunningUnderBun(): boolean {
  return typeof Bun !== "undefined";
}

async function waitForApi(
  baseURL: string,
  timeoutMs = 20_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isApiReachable(baseURL)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function modelExists(baseURL: string, model: string): Promise<boolean> {
  try {
    const data = (await fetchJSON(`${baseURL}/api/tags`)) as {
      models?: { name: string }[];
    };
    const prefix = model.split(":")[0];
    return (data.models ?? []).some((m) => m.name.startsWith(prefix));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function bootstrapOllama(
  options: Partial<BootstrapOptions> = {},
): Promise<BootstrapResult> {
  const model =
    options.model ??
    process.env.OLLAMA_EMBEDDING_MODEL ??
    "nomic-embed-text:latest";
  const baseURL =
    options.baseURL ??
    process.env.OLLAMA_HOST ??
    "http://localhost:11434";

  const msgs: string[] = [];

  // Bun check — purely advisory, don't abort
  if (!isRunningUnderBun()) {
    msgs.push(
      "WARNING: Not running under Bun. Use `bunx pi-thoth` for full functionality.",
    );
  }

  // ---- Step 1: Check Ollama availability ----
  const hasCLI = hasCli("ollama");
  let apiReachable = await isApiReachable(baseURL);

  if (hasCLI) msgs.push(`Ollama CLI found.`);
  if (apiReachable) msgs.push(`Ollama API reachable at ${baseURL}.`);

  if (!hasCLI && !apiReachable) {
    // Try to install
    const platform = process.platform;
    if (platform === "linux") {
      msgs.push("Ollama not found. Installing via install.sh ...");
      const r = spawnSync("sh", ["-c", "curl -fsSL https://ollama.com/install.sh | sh"], {
        stdio: "inherit",
      });
      if (r.status !== 0) {
        return {
          success: false,
          messages: [...msgs, "Failed to install Ollama. Install manually: https://ollama.com"],
        };
      }
    } else if (platform === "darwin") {
      // Check brew
      if (hasCli("brew")) {
        msgs.push("Installing Ollama via Homebrew ...");
        const r = spawnSync("brew", ["install", "--cask", "ollama"], {
          stdio: "inherit",
        });
        if (r.status !== 0) {
          return {
            success: false,
            messages: [
              ...msgs,
              "brew install --cask ollama failed. Install manually: https://ollama.com/download",
            ],
          };
        }
      } else {
        return {
          success: false,
          messages: [
            ...msgs,
            "Ollama not found and Homebrew not available. Install from: https://ollama.com/download",
          ],
        };
      }
    } else {
      return {
        success: false,
        messages: [
          ...msgs,
          `Unsupported platform (${platform}). Install Ollama manually: https://ollama.com`,
        ],
      };
    }
  }

  // ---- Step 2: Start Ollama if API not reachable ----
  if (!apiReachable && hasCli("ollama")) {
    msgs.push("Ollama API not responding. Starting `ollama serve` ...");
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    apiReachable = await waitForApi(baseURL, 20_000);
    if (!apiReachable) {
      return {
        success: false,
        messages: [
          ...msgs,
          `Ollama did not respond at ${baseURL} within 20s. Run \`ollama serve\` manually.`,
        ],
      };
    }
    msgs.push("Ollama started successfully.");
  }

  if (!apiReachable) {
    return {
      success: false,
      messages: [
        ...msgs,
        `Cannot reach Ollama at ${baseURL}. Set OLLAMA_HOST if using a remote instance.`,
      ],
    };
  }

  // ---- Step 3: Pull model if not present ----
  if (await modelExists(baseURL, model)) {
    msgs.push(`Model ${model} already present.`);
  } else {
    msgs.push(`Pulling ${model} (this may take a few minutes) ...`);
    if (hasCli("ollama")) {
      const r = spawnSync("ollama", ["pull", model], { stdio: "inherit" });
      if (r.status !== 0) {
        return {
          success: false,
          messages: [...msgs, `Failed to pull ${model}.`],
        };
      }
    } else {
      // Pull via API (WSL / remote host scenario)
      try {
        await postJSON(`${baseURL}/api/pull`, { name: model });
      } catch (err) {
        return {
          success: false,
          messages: [
            ...msgs,
            `Failed to pull ${model} via API: ${(err as Error).message}`,
          ],
        };
      }
    }
    msgs.push(`Model ${model} pulled successfully.`);
  }

  return { success: true, messages: msgs };
}
