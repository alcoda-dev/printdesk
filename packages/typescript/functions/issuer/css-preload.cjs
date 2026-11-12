// oxlint-disable typescript/no-require-imports typescript/no-var-requires effecttsgo/node-builtin-import effecttsgo/global-json
// Lets `vpx` dev runs load `.css` imports as strings.
// Node has no .css handler, so vpx falls back to the JS loader and dies
// parsing the file. Prod (SST/esbuild) bundles CSS natively — dev only.
const Fs = require("node:fs");
const Module = require("node:module");

Module._extensions[".css"] = function (module, filename) {
  module._compile(
    `module.exports = ${JSON.stringify(Fs.readFileSync(filename, "utf8"))}`,
    filename,
  );
};
