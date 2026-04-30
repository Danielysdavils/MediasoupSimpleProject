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
  // server
  port: num("PORT", 3031),
  corsOrigin: str("CORS_ORIGIN", "*"),

  // mediasoup
  numWorkers: num("NUM_WORKERS", 2),

  listenIp: str("MEDIASOUP_LISTEN_IP", "0.0.0.0")!,
  announcedIp: str("MEDIASOUP_ANNOUNCED_IP"),

  rtcMinPort: num("RTC_MIN_PORT", 40000),
  rtcMaxPort: num("RTC_MAX_PORT", 41000),
};
