export const logger = {
  info: (message: string, meta?: any) => {
    if (meta) console.log("[INFO]", message, meta);
    else console.log("[INFO]", message);
  },

  warn: (message: string, meta?: any) => {
    if (meta) console.warn("[WARN]", message, meta);
    else console.warn("[WARN]", message);
  },

  error: (message: string, meta?: any) => {
    if (meta) console.error("[ERROR]", message, meta);
    else console.error("[ERROR]", message);
  },
};
