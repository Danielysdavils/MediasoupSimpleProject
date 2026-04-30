import * as mediasoup from "mediasoup";
import { logger } from "../infra/logger.js";
import { mediaSoupConfig } from "../config/mediaSoup.js";

type MsWorker = any; // por enquanto sem typings do mediasoup

export class WorkerPool {
  private workers: MsWorker[] = [];

  static async create(numWorkers: number) {
    const pool = new WorkerPool();

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(mediaSoupConfig.workerSettings as any);

      worker.on("died", () => {
        logger.error("mediasoup worker died", { pid: worker.pid });
        process.exit(1);
      });

      pool.workers.push(worker);
      logger.info("mediasoup worker created", { pid: worker.pid });
    }

    return pool;
  }

  /**
   * Pick the least loaded worker by cumulative CPU time (ru_utime + ru_stime).
   * Note: this is cumulative since worker start, not instantaneous.
   */
  async getLeastLoadedWorker(): Promise<MsWorker> {
    if (this.workers.length === 0) throw new Error("No mediasoup workers available");
    if (this.workers.length === 1) return this.workers[0];

    try {
      const loads = await Promise.all(
        this.workers.map(async (w) => {
          const stats = await w.getResourceUsage();
          const cpuUsage = (stats.ru_utime ?? stats.ru_time ?? 0) + (stats.ru_stime ?? 0);
          return { worker: w, cpuUsage };
        })
      );

      let least = loads[0];
      if (!least) throw new Error("Failed to determine least loaded worker");

      for (let i = 1; i < loads.length; i++) {
        const item = loads[i];
        if (item && item.cpuUsage < least.cpuUsage) {
          least = item;
        }
      }

      return least.worker;
      
    } catch (err) {
      // fallback seguro se falhar leitura
      logger.warn("failed to compute worker load, falling back to first worker", { err });
      return this.workers[0];
    }
  }

  // opcional: expor p/ debug
  getAllWorkers(): MsWorker[] {
    return this.workers;
  }
}
