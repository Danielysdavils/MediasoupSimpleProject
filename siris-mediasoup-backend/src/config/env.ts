import dotenv from "dotenv";

dotenv.config();

function num(name: string, def: number): number {
  const v = process.env[name];
  return v ? Number(v) : def;
}

function str(name: string, def?: string): string | undefined {
  return process.env[name] ?? def;
}

export const env = {
  // server 2
  port: num("PORT", 3032),
  corsOrigin: str("CORS_ORIGIN", "*"),

  // mediasoup
  numWorkers: num("NUM_WORKERS", 2),

  listenIp: str("MEDIASOUP_LISTEN_IP", "0.0.0.0")!,
  announcedIp: str("MEDIASOUP_ANNOUNCED_IP"),

  rtcMinPort: num("RTC_MIN_PORT", 41001),
  rtcMaxPort: num("RTC_MAX_PORT", 42000),
};
