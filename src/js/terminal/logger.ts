import os from "os";
import process from "process";

const colors = {
  reset: "\x1b[0m",

  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[37m",

  bold: "\x1b[1m",
};

const c = (text: string, color: string) => `${color}${text}${colors.reset}`;

const line = (width = 72) => "─".repeat(width);

const formatDate = () =>
  new Date().toISOString().replace("T", " ").slice(0, 19);

function section(title: string) {
  console.log();
  console.log(c(title, colors.cyan));
  console.log(c(line(), colors.gray));
}

function row(key: string, value: string) {
  console.log(
    ` ${c(key.padEnd(18), colors.gray)} ${c("│", colors.gray)} ${value}`,
  );
}

const printBanner = (config: any) => {
  console.clear();

  console.log(
    c(
      "╔════════════════════════════════════════════════════════════════════════╗",
      colors.cyan,
    ),
  );

  console.log(
    c(
      "║                         ⚒ STARKLABS FORGE                              ║",
      colors.cyan,
    ),
  );

  console.log(
    c(
      "║                     Build less. Ship everything.                       ║",
      colors.cyan,
    ),
  );

  console.log(
    c(
      "╚════════════════════════════════════════════════════════════════════════╝",
      colors.cyan,
    ),
  );

  section("🚀 Runtime");

  row("Status", c("Running", colors.green));
  row("Environment", config.env);
  row("Node", process.version);
  row("Platform", `${os.platform()} ${os.arch()}`);
  row("PID", process.pid.toString());
  row("Started", formatDate());

  section("🌐 Server");

  row("Host", config.host);
  row("Port", config.port);
  row("URL", c(config.url, colors.blue));
  row("API Prefix", config.apiPrefix);
  row("Health", c(`${config.url}${config.health}`, colors.red));

  section("🗄 Database");

  row("Driver", config.db.driver);
  row("Database", config.db.name);
  row(
    "Status",
    config.db.connected
      ? c("Connected", colors.green)
      : c("Disconnected", colors.red),
  );

  section("⚡ Generated");

  row("Models", config.generated.models);
  row("Validators", config.generated.validators);
  row("Routes", config.generated.routes);

  if (config.generated.middlewares)
    row("Middlewares", config.generated.middlewares);

  section("🧩 Features");

  config.features.forEach((f: any) =>
    console.log(` ${c("✓", colors.green)} ${f}`),
  );

  section("📦 Resources");

  config.resources.forEach((r: any) =>
    console.log(` ${c("✓", colors.green)} ${r}`),
  );

  section("💻 System");

  row("CPU", os.cpus().length + " Cores");
  row("OS", os.type());
  row("Hostname", os.hostname());

  console.log();
  console.log(c(line(), colors.gray));

  console.log(` • Listening on ${c(config.url, colors.blue)}`);

  console.log();
};

export default printBanner;
