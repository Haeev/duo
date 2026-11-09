// Client minimal du serveur MCP officiel de Meshy (@meshy-ai/meshy-mcp-server), par stdio.
// Un lancement = une poignée de main, puis un appel d'outil (ou la liste des outils).
//
// Usage:
//   node meshy-mcp.mjs <dossier de travail> list-tools <fichier de sortie .json>
//   node meshy-mcp.mjs <dossier de travail> <outil> '<arguments JSON>' [journal.jsonl]
//
// Le serveur écrit ses téléchargements dans <dossier de travail>/meshy_output/: choisir un dossier
// hors du dépôt (sorties brutes). La clé n'est jamais lue ni écrite ici: dans l'environnement cloud,
// le proxy remplace l'en-tête Authorization des requêtes vers api.meshy.ai.
import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const SERVER_PACKAGE = "@meshy-ai/meshy-mcp-server@0.6.9";
// Un appel avec attente (meshy_get_task_status, wait=true) dure jusqu'à 300 s côté serveur.
const CALL_TIMEOUT_MS = 330_000;

const [workDir, toolName, rawArgs = "{}", journalPath] = process.argv.slice(2);
if (!workDir || !toolName) {
  process.stderr.write("usage: node meshy-mcp.mjs <dossier> <outil|list-tools> [arguments JSON|sortie] [journal]\n");
  process.exit(2);
}

const server = spawn("npx", ["-y", SERVER_PACKAGE], {
  cwd: workDir,
  env: { ...process.env, MESHY_API_KEY: "proxy-injected", MESHY_CLIENT: "duo-studio/0.1" },
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const pending = new Map();
server.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, end).trim();
    buffer = buffer.slice(end + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});
// Les journaux du serveur (relances, progression) vont sur stderr: on les garde visibles.
server.stderr.on("data", (chunk) => process.stderr.write(`[serveur] ${chunk}`));

let nextId = 1;
function request(method, params, timeoutMs) {
  const id = nextId++;
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => reject(new Error(`délai dépassé pour ${method}`)), timeoutMs);
  });
}

let exitCode = 0;
try {
  await request(
    "initialize",
    { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "duo-studio", version: "0.1.0" } },
    120_000,
  );
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  if (toolName === "list-tools") {
    const listed = await request("tools/list", {}, 60_000);
    writeFileSync(rawArgs, JSON.stringify(listed.result, null, 2) + "\n");
    process.stdout.write(`${listed.result.tools.length} outils écrits dans ${rawArgs}\n`);
  } else {
    const args = JSON.parse(rawArgs);
    const startedAt = new Date().toISOString();
    const reply = await request("tools/call", { name: toolName, arguments: args }, CALL_TIMEOUT_MS);
    const result = reply.result ?? { error: reply.error };
    const text = (result.content ?? []).map((block) => block.text ?? "").join("\n");
    process.stdout.write(`${text}\n`);
    if (result.structuredContent) {
      process.stdout.write(`--- structuredContent ---\n${JSON.stringify(result.structuredContent, null, 2)}\n`);
    }
    if (result.isError || reply.error) exitCode = 1;
    if (journalPath) {
      appendFileSync(
        journalPath,
        JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), tool: toolName, args, result }) + "\n",
      );
    }
  }
} catch (error) {
  process.stdout.write(`échec: ${error instanceof Error ? error.message : String(error)}\n`);
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
