export interface AppLogInterface {
  check: string;
  x: string;
  db: string;
  loading: string;
  warn: string;
}

const emojis: AppLogInterface = {
  check: "✅",
  x: "❌",
  db: "📚",
  loading: "⏳",
  warn: "⚠️ ",
};

const AppLog = (
  emoji: keyof AppLogInterface,
  file: string,
  message: string,
): void => {
  console.log(`${emojis[emoji]} [${file}] ${message}`);
};

export default AppLog;
