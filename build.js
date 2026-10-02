// Repacks src/app.html into the bundled index.html (the shell, runtime, React and fonts stay as they are).
// Usage: node build.js
const fs = require("fs");
const path = require("path");

const OPEN = '<script type="__bundler/template">';
const out = path.join(__dirname, "index.html");
const html = fs.readFileSync(out, "utf8");
const app = fs.readFileSync(path.join(__dirname, "src", "app.html"), "utf8");

const start = html.indexOf(OPEN);
if (start === -1) throw new Error("template script tag not found in index.html");
const bodyStart = html.indexOf("\n", start) + 1;
const end = html.indexOf("\n  </script>", bodyStart);

// Escape "</" so the template cannot close its own script tag (matches the original bundler output).
const encoded = JSON.stringify(app).split("</").join("<" + String.fromCharCode(92) + "u002F");
fs.writeFileSync(out, html.slice(0, bodyStart) + encoded + html.slice(end));
console.log(`index.html rebuilt (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
