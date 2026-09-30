const path = require("node:path");

const workerDir = __dirname;

module.exports = {
  apps: [
    {
      name: "cook-worker",
      script: path.join(workerDir, "dist/main.js"),
      cwd: workerDir,
      node_args: `--env-file=${path.join(workerDir, ".env")}`,
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
