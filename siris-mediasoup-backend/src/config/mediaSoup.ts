import { env } from "./env.js";

/**
 * MediaSoup configuration
 *
 * - Network / ports / IPs come from ENV
 * - Media capabilities stay in code (contract with clients)
 */
export const mediaSoupConfig = {
  /**
   * Worker-level settings
   * These are infra-related and depend on the environment
   */
  workerSettings: {
    rtcMinPort: env.rtcMinPort,
    rtcMaxPort: env.rtcMaxPort,
    logLevel: "debug" as const,
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "transport", "rtcp"] as const,
  },

  /**
   * Router media codecs
   * This defines what the SFU SUPPORTS
   * (should NOT be in .env)
   */
  routerMediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
      parameters: {
        maxaveragebitrate: 64000,
        useinbandfec: 1,
        usedtx: 1,
        stereo: 0,
      },
    },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: {},
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
      },
    },
  ],

  /**
   * WebRTC transport defaults
   */
  webRtcTransport: {
    listenIps: [
      {
        ip: "127.0.0.1", // "0.0.0.0", // 127.0.0.1
        announcedIp: null // "172.104.199.107", // public IP when behind NAT
      },
    ],
    
    listenIp: { ip: "127.0.0.1" },
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,

    maxIncomingBitrate: 5_000_000,
    initialAvailableOutgoingBitrate: 5_000_000,
  },
};
