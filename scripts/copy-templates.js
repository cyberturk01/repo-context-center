const { cp } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

async function main() {
  await cp(
    path.join(root, "src", "templates", "generic"),
    path.join(root, "dist", "templates", "generic"),
    { recursive: true }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
