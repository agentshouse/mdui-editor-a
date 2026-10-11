import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verify } from "@agentshouse/mdmodel";
const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink());
    if (entry.isDirectory()) walk(filename);
    else {
      assert(entry.isFile());
      files.push(filename);
    }
  }
}
walk(dist);
const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
assert(files.length <= 2000 && bytes <= 20 * 1024 * 1024);
for (const name of ["app.json", "schema.yaml"])
  assert.equal(
    fs.readFileSync(path.join(root, name), "utf8"),
    fs.readFileSync(path.join(dist, name), "utf8"),
  );
assert.equal(
  verify(fs.readFileSync(path.join(dist, "schema.yaml"), "utf8")).verdict,
  "accept",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(dist, "app.json"), "utf8"),
);
assert.equal(manifest.entry, "index.html");
assert(!manifest.external_origins);
function asset(value, from) {
  if (/^(data:|#)/.test(value)) return;
  assert(
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value),
    `External asset ${value}`,
  );
  const filename = path.resolve(
    path.dirname(from),
    decodeURIComponent(value.split(/[?#]/)[0]),
  );
  assert(
    filename.startsWith(`${dist}/`) && fs.existsSync(filename),
    `Missing or escaped asset ${value}`,
  );
}
for (const file of files) {
  const name = path.relative(dist, file);
  if (/\.(html|css|js|svg)$/.test(file)) {
    const content = fs.readFileSync(file, "utf8");
    if (file.endsWith(".html")) {
      for (const match of content.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
      ))
        assert(
          /\bsrc=/.test(match[1]) ||
            /type=["']application\/json["']/.test(match[1]) ||
            !match[2].trim(),
          "Inline executable script",
        );
      for (const tag of content.matchAll(
        /<(?:script|link|img|source|video|audio|iframe)\b[^>]*>/gi,
      ))
        for (const match of tag[0].matchAll(
          /\b(?:src|href|poster)=["']([^"']+)["']/gi,
        ))
          asset(match[1], file);
    }
    if (file.endsWith(".css"))
      for (const match of content.matchAll(
        /url\(\s*["']?([^"'\s)]+)["']?\s*\)/g,
      ))
        asset(match[1], file);
    if (file.endsWith(".svg")) {
      assert(
        !/<script|<foreignObject|\bon[a-z]+\s*=/i.test(content),
        `Unsafe SVG ${name}`,
      );
      for (const match of content.matchAll(/(?:xlink:)?href=["']([^"']+)["']/g))
        asset(match[1], file);
    }
    if (file.endsWith(".js")) {
      assert(
        !/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(content),
        `Network API in ${name}`,
      );
      assert(
        !/localStorage|indexedDB|connectMdRuntime|serveMdRuntime|createMemoryAdapter/.test(
          content,
        ),
        `Fallback or constructed runtime ${name}`,
      );
      for (const match of content.matchAll(
        /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      ))
        asset(match[1], file);
    }
  }
}
for(const name of ['licenses/dokieli-Apache-2.0.txt','licenses/PROVENANCE.txt','licenses/CC-BY-4.0.txt','licenses/Ubuntu-Font-Licence-1.0.txt','licenses/Font-Awesome-Free-7.1.0.txt','favicon.ico'])assert(fs.existsSync(path.join(dist,name)),`Missing ${name}`);
const result = {
  result: "passed",
  files: files.length,
  bytes,
  mebibytes: Number((bytes / 1048576).toFixed(3)),
  limits: "20 MiB / 2000 files",
  localAssetsOnly: true,
  sourceAndReleaseSchemasIdentical: true,
  browserAcceptance:
    "Not claimed by static checks; see Porting hosted acceptance evidence.",
};
fs.writeFileSync(
  path.join(root, "reports/release-check.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(result);
