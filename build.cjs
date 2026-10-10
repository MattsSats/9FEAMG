// Repacks the app into the bundled index.html (the shell, runtime, React and fonts stay as they are).
//   src/app.html  markup + styles, with a /*LOGIC*/ placeholder
//   src/logic.js  app logic, spliced into the placeholder
//   api/_shared.js  the league math the server also runs, pasted into logic.js at /*SHARED*/
//                   (its `export`s dropped, so its names are plain globals in the app)
// Season numbers live in data/season.js and load at runtime, so editing them needs no rebuild.
// Usage: node build.cjs
const fs = require("fs");
const path = require("path");

const OPEN = '<script type="__bundler/template">';
const out = path.join(__dirname, "index.html");
const html = fs.readFileSync(out, "utf8");
const shared = fs.readFileSync(path.join(__dirname, "api", "_shared.js"), "utf8")
  .split(/\r?\n/).filter(l => !/^import /.test(l)).map(l => l.replace(/^export (const|function|let) /, "$1 ")).join("\n");
if (/^export /m.test(shared)) throw new Error("api/_shared.js: only `export const|function|let` can be pasted into the app");
const logicSrc = fs.readFileSync(path.join(__dirname, "src", "logic.js"), "utf8");
if (!logicSrc.includes("/*SHARED*/")) throw new Error("src/logic.js has no /*SHARED*/ placeholder");
const logic = logicSrc.split("/*SHARED*/").join(shared);
const app = fs.readFileSync(path.join(__dirname, "src", "app.html"), "utf8")
  .split("/*LOGIC*/").join(logic);

const start = html.indexOf(OPEN);
if (start === -1) throw new Error("template script tag not found in index.html");
const bodyStart = html.indexOf("\n", start) + 1;
const end = html.indexOf("\n  </script>", bodyStart);

// Escape "</" so the template cannot close its own script tag (matches the original bundler output).
const encoded = JSON.stringify(app).split("</").join("<" + String.fromCharCode(92) + "u002F");
fs.writeFileSync(out, html.slice(0, bodyStart) + encoded + html.slice(end));
console.log(`index.html rebuilt (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
