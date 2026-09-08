import os from "os";
import process from "process";
import stringWidth from "string-width";

// ─────────────────────────────────────────────────────────────────────────────
// Colors & Styling
// ─────────────────────────────────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[37m",

  // Brand Palette
  orange: "\x1b[38;5;208m",
  amber: "\x1b[38;5;214m",
  gold: "\x1b[38;5;220m",
  darkOrange: "\x1b[38;5;166m",
};

const c = (text: string | number, color: string) =>
  `${color}${text}${colors.reset}`;

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Width Helpers
// ─────────────────────────────────────────────────────────────────────────────

const stripAnsi = (str: string) =>
  str.replace(/\x1b\[[0-9;]*m/g, "");

const visibleLen = (str: string) =>
  stringWidth(stripAnsi(str));

const padRight = (str: string, width: number) =>
  str + " ".repeat(Math.max(0, width - visibleLen(str)));

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────
//
// CARD_WIDTH is the COMPLETE visible width:
//
// ╭────────────────────────────────────────────────────────────╮
// │ content                                                    │
// ├────────────────────────────────────────────────────────────┤
// │ content                                                    │
// ╰────────────────────────────────────────────────────────────╯
//
// Everything is calculated from this single value.
// ─────────────────────────────────────────────────────────────────────────────

const CARD_WIDTH = 60;

// Characters outside the content area:
// │ + space + CONTENT + space + │
//
// Therefore:
const CONTENT_WIDTH = CARD_WIDTH - 4;

const box = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",

  horizontal: "─",
  vertical: "│",

  crossRight: "├",
  crossLeft: "┤",
};

// ─────────────────────────────────────────────────────────────────────────────
// Box Drawing Helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawTopBorder() {
  console.log(
    c(
      `${box.topLeft}${box.horizontal.repeat(CARD_WIDTH - 2)}${box.topRight}`,
      colors.gray,
    ),
  );
}

function drawBottomBorder() {
  console.log(
    c(
      `${box.bottomLeft}${box.horizontal.repeat(CARD_WIDTH - 2)}${box.bottomRight}`,
      colors.gray,
    ),
  );
}

function drawDivider() {
  console.log(
    c(
      `${box.crossRight}${box.horizontal.repeat(CARD_WIDTH - 2)}${box.crossLeft}`,
      colors.gray,
    ),
  );
}

function drawEmptyRow() {
  console.log(
    `${c(box.vertical, colors.gray)} ${" ".repeat(CONTENT_WIDTH)} ${c(
      box.vertical,
      colors.gray,
    )}`,
  );
}

function drawHeader(title: string) {
  drawEmptyRow();

  const titleWidth = visibleLen(title);

  // ├─ title ────────────────────────────────────────────────────────────┤
  //
  // 2 = "├─"
  // 1 = space before title
  // 1 = space after title
  // 1 = final "┤"
  //
  // The remaining space is filled with horizontal characters.

  const horizontalLength =
    CARD_WIDTH - titleWidth - 5;

  const lineStr = box.horizontal.repeat(
    Math.max(0, horizontalLength),
  );

  console.log(
    c(
      `${box.crossRight}${box.horizontal} ${title} ${lineStr}${box.crossLeft}`,
      colors.gray,
    ),
  );

  drawEmptyRow();
}

function drawRow(
  key: string,
  value: string | number,
  keyWidth = 16,
) {
  const formattedKey = padRight(key, keyWidth);

  const valSpace = CONTENT_WIDTH - keyWidth - 3;

  const formattedVal = padRight(
    String(value),
    Math.max(0, valSpace),
  );

  const keyColored = c(formattedKey, colors.gray);
  const sep = c(box.vertical, colors.gray);

  console.log(
    `${c(box.vertical, colors.gray)} ${keyColored} ${sep} ${formattedVal} ${c(
      box.vertical,
      colors.gray,
    )}`,
  );
}

function drawBadgeList(items: string[]) {
  items.forEach((item) => {
    const content = `${c("✔", colors.green)} ${c(
      item,
      colors.white,
    )}`;

    const padded = padRight(
      content,
      CONTENT_WIDTH,
    );

    console.log(
      `${c(box.vertical, colors.gray)} ${padded} ${c(
        box.vertical,
        colors.gray,
      )}`,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Forge Logo
// ─────────────────────────────────────────────────────────────────────────────

function forgeLogo() {
  const logo = [
    "      ███████╗ ██████╗  ██████╗   ██████╗ ███████╗",
    "      ██╔════╝██╔═══██╗██╔══██╗ ██╔════╝ ██╔════╝",
    "      █████╗  ██║   ██║██████╔╝ ██║  ███╗█████╗  ",
    "      ██╔══╝  ██║   ██║██╔══██╗ ██║   ██║██╔══╝  ",
    "      ██║     ╚██████╔╝██║  ██║ ╚██████╔╝███████╗",
    "      ╚═╝      ╚═════╝ ╚═╝  ╚═╝  ╚═════╝ ╚══════╝",
  ];

  console.log();

  // Top border
  drawTopBorder();

  drawEmptyRow();

  // Brand Tagline Header
  const brand = c("STARKLABS", colors.amber);

  const brandPadding = Math.max(
    0,
    Math.floor(
      (CONTENT_WIDTH - visibleLen(brand)) / 2,
    ),
  );

  const centeredBrand = padRight(
    " ".repeat(brandPadding) + brand,
    CONTENT_WIDTH,
  );

  console.log(
    `${c(box.vertical, colors.gray)} ${centeredBrand} ${c(
      box.vertical,
      colors.gray,
    )}`,
  );

  drawEmptyRow();

  // Divider
  drawDivider();

  drawEmptyRow();

  // Logo Body with Vertical Gradient
  logo.forEach((lineText, index) => {
    let color = colors.orange;

    if (index >= 2 && index <= 3) {
      color = colors.amber;
    }

    if (index >= 4) {
      color = colors.gold;
    }

    const paddedLogo = padRight(
      "  " + lineText,
      CONTENT_WIDTH,
    );

    console.log(
      `${c(box.vertical, colors.gray)} ${c(
        paddedLogo,
        color,
      )} ${c(box.vertical, colors.gray)}`,
    );
  });

  drawEmptyRow();

  // Subtitle / Tagline
  const slogan = c(
    "Build less. Ship everything.",
    colors.gray,
  );

  const sloganPadding = Math.max(
    0,
    Math.floor(
      (CONTENT_WIDTH - visibleLen(slogan)) / 2,
    ),
  );

  const centeredSlogan = padRight(
    " ".repeat(sloganPadding) + slogan,
    CONTENT_WIDTH,
  );

  console.log(
    `${c(box.vertical, colors.gray)} ${centeredSlogan} ${c(
      box.vertical,
      colors.gray,
    )}`,
  );

  drawEmptyRow();

  // Bottom border
  drawBottomBorder();
}

// ─────────────────────────────────────────────────────────────────────────────
// Date
// ─────────────────────────────────────────────────────────────────────────────

const formatDate = () =>
  new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short"
  })

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface Config {
  env: string;

  host: string;

  port: number | string;

  url: string;

  apiPrefix: string;

  health: string;

  db: {
    driver: string;
    name: string;
    connected: boolean;
    status: string;
  };

  generated: {
    models: number;
    validators: number;
    routes: number;
    middlewares?: number;
  };

  features: string[];

  resources: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Printer Function
// ─────────────────────────────────────────────────────────────────────────────

export const printBanner = (config: Config) => {
  // ───────────────────────────────────────────────────────────────────────────
  // Logo
  // ───────────────────────────────────────────────────────────────────────────

  forgeLogo();

  // ───────────────────────────────────────────────────────────────────────────
  // Runtime
  // ───────────────────────────────────────────────────────────────────────────

  drawHeader(
    c("🚀 Runtime", colors.cyan),
  );

  drawRow(
    "Status",
    `${c("●", colors.green)} ${c(
      "Running",
      colors.white,
    )}`,
  );

  drawRow(
    "Environment",
    c(config.env, colors.yellow),
  );

  drawRow(
    "Node Version",
    process.version,
  );

  drawRow(
    "Platform",
    `${os.platform()} (${os.arch()})`,
  );

  drawRow(
    "Process PID",
    process.pid,
  );

  drawRow(
    "Started At",
    formatDate(),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Server
  // ───────────────────────────────────────────────────────────────────────────

  drawHeader(
    c("🌐 Server", colors.cyan),
  );

  drawRow(
    "Host / Port",
    `${config.host}:${config.port}`,
  );

  drawRow(
    "Base URL",
    c(config.url, colors.blue),
  );

  drawRow(
    "API Prefix",
    config.apiPrefix,
  );

  drawRow(
    "Healthcheck",
    c(
      `${config.url}${config.health}`,
      colors.magenta,
    ),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Database
  // ───────────────────────────────────────────────────────────────────────────

  drawHeader(
    c("🗄 Database", colors.cyan),
  );

  drawRow(
    "Driver / Name",
    `${config.db.driver} (${config.db.name})`,
  );

  drawRow(
    "Connection",
    config.db.connected
      ? c("✔ Connected", colors.green)
      : c("✖ Disconnected", colors.red),
  );

  drawRow(
    "Status",
    config.db.status,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Generated Assets
  // ───────────────────────────────────────────────────────────────────────────

  drawHeader(
    c("⚡ Generated Code", colors.cyan),
  );

  drawRow(
    "Models",
    config.generated.models,
  );

  drawRow(
    "Validators",
    config.generated.validators,
  );

  drawRow(
    "Routes",
    config.generated.routes,
  );

  if (
    config.generated.middlewares !== undefined
  ) {
    drawRow(
      "Middlewares",
      config.generated.middlewares,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Features
  // ───────────────────────────────────────────────────────────────────────────

  if (config.features?.length) {
    drawHeader(
      c("🧩 Features", colors.cyan),
    );

    drawBadgeList(config.features);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Resources
  // ───────────────────────────────────────────────────────────────────────────

  if (config.resources?.length) {
    drawHeader(
      c("📦 Resources", colors.cyan),
    );

    drawBadgeList(config.resources);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // System
  // ───────────────────────────────────────────────────────────────────────────

  drawHeader(
    c("💻 System Context", colors.cyan),
  );

  drawRow(
    "CPU Architecture",
    `${os.cpus().length} Cores`,
  );

  drawRow(
    "OS Type",
    os.type(),
  );

  drawRow(
    "Hostname",
    os.hostname(),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Footer
  // ───────────────────────────────────────────────────────────────────────────

  drawEmptyRow();

  drawDivider();

  drawEmptyRow();

  const footerText =
    `${c(
      "Listening on:",
      colors.gray,
    )} ${c(
      `${config.url}${config.apiPrefix}/[route]`,
      colors.blue,
    )}`;

  const paddedFooter = padRight(
    " " + footerText,
    CONTENT_WIDTH,
  );

  console.log(
    `${c(box.vertical, colors.gray)} ${paddedFooter} ${c(
      box.vertical,
      colors.gray,
    )}`,
  );

  drawEmptyRow();

  drawBottomBorder();

  console.log();
};

export default printBanner;