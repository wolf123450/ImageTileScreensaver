// Keeps src-tauri/Cargo.toml's [package].version in sync with package.json.
// Run automatically by `npm version` (see the "version" script in package.json).
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const cargoPath = path.join(__dirname, "..", "src-tauri", "Cargo.toml");
const cargoToml = fs.readFileSync(cargoPath, "utf8");

const updated = cargoToml.replace(
  /^version = "[^"]*"/m,
  `version = "${pkg.version}"`
);

if (updated === cargoToml) {
  console.error("Could not find a version field to update in Cargo.toml");
  process.exit(1);
}

fs.writeFileSync(cargoPath, updated);
console.log(`Synced src-tauri/Cargo.toml version -> ${pkg.version}`);
