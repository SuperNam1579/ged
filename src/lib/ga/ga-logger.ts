// ============================================================================
// ga-logger.ts — ตัว log สำหรับ GA ที่แสดง gene ทุกตัวใน chromosome ทุกตัว
// ----------------------------------------------------------------------------
// วางไฟล์นี้ไว้โฟลเดอร์เดียวกับ engine.ts แล้ว import ไปใช้
// รองรับ 3 ระดับ: SUMMARY | BEST_ONLY | FULL + เขียนได้ทั้ง console และไฟล์
// ============================================================================

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { Individual, Chromosome, FitnessBreakdown } from "@/types";

export type LogLevel = "SUMMARY" | "BEST_ONLY" | "FULL";

export interface GALoggerConfig {
  level: LogLevel;
  logToConsole: boolean;
  logToFile: boolean;
  outDir?: string;
  everyNGenerations?: number;
}

interface GeneRecord {
  order: number;
  subtopicId: string;
  scheduledDate: string;
  durationMins: number;
}
interface ChromosomeRecord {
  chromosomeIndex: number;
  fitness: number;
  breakdown: FitnessBreakdown;
  isBest: boolean;
  isElite: boolean;
  geneCount: number;
  genes: GeneRecord[];
}
interface GenerationRecord {
  generation: number;
  populationSize: number;
  best: number;
  avg: number;
  worst: number;
  chromosomes: ChromosomeRecord[];
}

export class GALogger {
  private cfg: Required<GALoggerConfig>;
  private records: GenerationRecord[] = [];
  private runId: string;

  constructor(config: GALoggerConfig) {
    this.cfg = { outDir: "./ga-logs", everyNGenerations: 1, ...config };
    this.runId = new Date().toISOString().replace(/[:.]/g, "-");
  }

  private toChromosomeRecord(
    ind: Individual, index: number, isBest: boolean, isElite: boolean
  ): ChromosomeRecord {
    const sortedGenes = [...ind.chromosome].sort(
      (a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.order - b.order
    );
    return {
      chromosomeIndex: index,
      fitness: Number(ind.fitness.toFixed(4)),
      breakdown: ind.fitnessBreakdown,
      isBest, isElite,
      geneCount: ind.chromosome.length,
      genes: sortedGenes.map((g) => ({
        order: g.order,
        subtopicId: g.subtopicId,
        scheduledDate: g.scheduledDate,
        durationMins: g.durationMins,
      })),
    };
  }

  logGeneration(generation: number, population: Individual[], eliteCount: number): void {
    const fitnesses = population.map((i) => i.fitness);
    const best = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const bestIdx = fitnesses.indexOf(best);

    const eliteIdx = new Set(
      population.map((ind, i) => ({ i, f: ind.fitness }))
        .sort((a, b) => b.f - a.f).slice(0, eliteCount).map((x) => x.i)
    );

    let chromosomes: ChromosomeRecord[] = [];
    if (this.cfg.level === "FULL") {
      if (generation % this.cfg.everyNGenerations === 0) {
        chromosomes = population.map((ind, i) =>
          this.toChromosomeRecord(ind, i, i === bestIdx, eliteIdx.has(i)));
      }
    } else if (this.cfg.level === "BEST_ONLY") {
      chromosomes = [this.toChromosomeRecord(
        population[bestIdx], bestIdx, true, eliteIdx.has(bestIdx))];
    }

    const rec: GenerationRecord = {
      generation, populationSize: population.length,
      best: Number(best.toFixed(4)), avg: Number(avg.toFixed(4)), worst: Number(worst.toFixed(4)),
      chromosomes,
    };
    this.records.push(rec);
    if (this.cfg.logToConsole) this.printGeneration(rec);
  }

  private printGeneration(rec: GenerationRecord): void {
    console.log(`\n─── Gen ${rec.generation} | best=${rec.best} avg=${rec.avg} worst=${rec.worst} ───`);
    for (const c of rec.chromosomes) {
      const tag = c.isBest ? " ★BEST" : c.isElite ? " ◆elite" : "";
      console.log(`  chromosome#${c.chromosomeIndex} fitness=${c.fitness}${tag} (${c.geneCount} genes)`);
      for (const g of c.genes) {
        console.log(`    [${String(g.order).padStart(2)}] ${g.scheduledDate} ${String(g.durationMins).padStart(3)}min ${g.subtopicId}`);
      }
    }
  }

  finalize(bestChromosome: Chromosome): void {
    if (!this.cfg.logToFile) return;
    try { mkdirSync(this.cfg.outDir, { recursive: true }); } catch {}
    const jsonPath = join(this.cfg.outDir, `ga-run-${this.runId}.json`);
    writeFileSync(jsonPath, JSON.stringify({
      runId: this.runId, level: this.cfg.level,
      totalGenerations: this.records.length,
      finalBestChromosome: bestChromosome,
      generations: this.records,
    }, null, 2), "utf-8");

    const txtPath = join(this.cfg.outDir, `ga-run-${this.runId}.txt`);
    writeFileSync(txtPath, this.buildTextReport(bestChromosome), "utf-8");
    console.log(`\n✅ GA log saved:\n   ${jsonPath}\n   ${txtPath}`);
  }

  private buildTextReport(bestChromosome: Chromosome): string {
    const lines: string[] = [];
    lines.push(`GA RUN LOG — ${this.runId} (level: ${this.cfg.level})`);
    lines.push("=".repeat(70));
    for (const rec of this.records) {
      lines.push(`\nGen ${rec.generation}  best=${rec.best}  avg=${rec.avg}  worst=${rec.worst}`);
      for (const c of rec.chromosomes) {
        const tag = c.isBest ? " ★BEST" : c.isElite ? " ◆elite" : "";
        lines.push(`  chromosome#${c.chromosomeIndex} fitness=${c.fitness}${tag} (${c.geneCount} genes)`);
        for (const g of c.genes) {
          lines.push(`    [${String(g.order).padStart(2)}] ${g.scheduledDate} ${String(g.durationMins).padStart(3)}min ${g.subtopicId}`);
        }
      }
    }
    lines.push("\n" + "=".repeat(70));
    lines.push("★ FINAL CHROMOSOME ที่ถูกนำไปใช้จริง (บันทึกลง DB):");
    const sorted = [...bestChromosome].sort(
      (a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.order - b.order);
    for (const g of sorted) {
      lines.push(`  [${String(g.order).padStart(2)}] ${g.scheduledDate} ${String(g.durationMins).padStart(3)}min ${g.subtopicId}`);
    }
    return lines.join("\n");
  }
}