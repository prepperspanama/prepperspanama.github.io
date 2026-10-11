import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const OUT_DIR = join(process.cwd(), "out");
const PLACEHOLDER = "__CSP_SCRIPT_HASHES__";

// Types the CSP/HTML spec classifies as executable script. Anything else
// (notably `application/ld+json`) is never governed by script-src.
const EXECUTABLE_SCRIPT_TYPES = new Set(["", "text/javascript", "application/javascript", "module"]);

const SCRIPT_TAG_RE = /<script((?:\s+[^>]*)?)>([\s\S]*?)<\/script>/gi;
const SRC_ATTR_RE = /\bsrc\s*=/i;
const TYPE_ATTR_RE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function walkHtmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walkHtmlFiles(full));
    else if (entry.endsWith(".html")) files.push(full);
  }
  return files;
}

function inlineScriptHashes(html) {
  const hashes = new Set();
  let match;
  while ((match = SCRIPT_TAG_RE.exec(html))) {
    const [, attrs, body] = match;
    if (SRC_ATTR_RE.test(attrs) || body.length === 0) continue;

    const typeMatch = attrs.match(TYPE_ATTR_RE);
    const type = (typeMatch ? typeMatch[1] ?? typeMatch[2] ?? typeMatch[3] : "").toLowerCase();
    if (!EXECUTABLE_SCRIPT_TYPES.has(type)) continue;

    const digest = createHash("sha256").update(body, "utf8").digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
  return [...hashes].sort();
}

const files = walkHtmlFiles(OUT_DIR);
let patched = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  if (!html.includes(PLACEHOLDER)) continue;

  const hashes = inlineScriptHashes(html);
  writeFileSync(file, html.replace(PLACEHOLDER, hashes.join(" ")));
  patched++;
}

console.log(`✓ CSP: hashes de scripts en línea inyectados en ${patched} páginas`);
