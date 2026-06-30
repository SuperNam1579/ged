import type { SubtopicData, ProficiencyMap } from "@/types";
import { WEAKNESS_THRESHOLD, isHeavy } from "./constants";

// ============================================================================
// ORDERING HELPER — จัดลำดับว่า "วิชาไหนควรมาก่อน/ต่อกับวิชาไหน"
// ----------------------------------------------------------------------------
//  ใช้ตอนสร้าง chromosome เริ่มต้น (greedy individual) และตอน repair
//  เพื่อให้ลำดับการเรียนมีประสิทธิภาพ ตามหลัก 3 ข้อ:
//
//   1) Prerequisite ต้องมาก่อน           (topological order)
//   2) วิชาอ่อนได้คิวก่อน                  (weakness-first — แบบ B)
//   3) สลับหนัก-เบา ไม่ให้ติดกัน           (Balance research)
//
//  ผลลัพธ์ = ลำดับ subtopic ที่ "แนะนำ" ให้เรียงตามนี้
// ============================================================================

interface OrderingContext {
  subtopics: SubtopicData[];
  proficiencies: ProficiencyMap;
}

// ── Topological sort เคารพ prerequisite (Kahn's algorithm) ──────────────────
// คืน subtopic ตามลำดับที่ prerequisite มาก่อนเสมอ; ตัด cycle ทิ้งอย่างปลอดภัย
function topologicalOrder(subtopics: SubtopicData[]): SubtopicData[] {
  const byId = new Map(subtopics.map((s) => [s.id, s]));
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // prereq -> [dependents]

  for (const s of subtopics) {
    indegree.set(s.id, 0);
    adj.set(s.id, []);
  }
  for (const s of subtopics) {
    for (const pre of s.prerequisiteIds) {
      if (!byId.has(pre)) continue; // prereq ไม่อยู่ในชุด → ข้าม
      adj.get(pre)!.push(s.id);
      indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
    }
  }

  // เริ่มจากตัวที่ไม่มี prerequisite
  const queue: string[] = [];
  for (const [id, deg] of indegree) if (deg === 0) queue.push(id);

  const ordered: SubtopicData[] = [];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const s = byId.get(id);
    if (s) ordered.push(s);
    for (const dep of adj.get(id) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 1) - 1);
      if (indegree.get(dep) === 0) queue.push(dep);
    }
  }

  // ถ้ามี cycle เหลือ (ไม่ควรเกิด) เติมตัวที่เหลือเข้าไปกันตก
  if (ordered.length < subtopics.length) {
    const seen = new Set(ordered.map((s) => s.id));
    for (const s of subtopics) if (!seen.has(s.id)) ordered.push(s);
  }
  return ordered;
}

// ── จัดลำดับแนะนำขั้นสุดท้าย ────────────────────────────────────────────────
//  1) เริ่มจาก topological order (prereq ก่อน — ห้ามสลับข้าม)
//  2) ภายในกลุ่มที่ "พร้อมเรียน" แล้ว ให้คะแนน priority:
//       - วิชาอ่อน priority สูง (weakness-first)
//  3) เดินเลือกทีละตัว โดยพยายามไม่ให้ "หนักติดหนัก" (สลับหนัก-เบา)
export function recommendOrder(ctx: OrderingContext): SubtopicData[] {
  const { subtopics, proficiencies } = ctx;
  if (subtopics.length === 0) return [];

  const topo = topologicalOrder(subtopics);

  // map ตำแหน่ง topo ไว้กันสลับข้าม prerequisite
  const topoIndex = new Map(topo.map((s, i) => [s.id, i]));
  const byId = new Map(subtopics.map((s) => [s.id, s]));

  // เซ็ตของ subtopic ที่ prerequisite ครบแล้ว (พร้อมเรียน)
  const scheduled = new Set<string>();
  const result: SubtopicData[] = [];

  function prereqsMet(s: SubtopicData): boolean {
    return s.prerequisiteIds.every(
      (pre) => !byId.has(pre) || scheduled.has(pre)
    );
  }

  // weakness ของ subtopic (0..1) ยิ่งมาก = ยิ่งอ่อน = ควรมาก่อน
  function weakness(s: SubtopicData): number {
    const prof = proficiencies[s.id] ?? 0;
    return Math.max(0, WEAKNESS_THRESHOLD - prof) / WEAKNESS_THRESHOLD;
  }

  let lastWasHeavy: boolean | null = null;

  while (result.length < topo.length) {
    // ผู้สมัครที่พร้อมเรียน (prereq ครบ และยังไม่ถูกจัด)
    const ready = topo.filter(
      (s) => !scheduled.has(s.id) && prereqsMet(s)
    );
    if (ready.length === 0) {
      // เผื่อกรณีพิเศษ: หยิบตัวแรกที่ยังไม่จัดตาม topo
      const next = topo.find((s) => !scheduled.has(s.id));
      if (!next) break;
      result.push(next);
      scheduled.add(next.id);
      lastWasHeavy = isHeavy(next);
      continue;
    }

    // ให้คะแนนผู้สมัคร: weakness นำ + โบนัสถ้าสลับหนัก-เบาได้
    let best = ready[0];
    let bestScore = -Infinity;
    for (const s of ready) {
      let score = weakness(s) * 2; // weakness-first (แบบ B) ถ่วงหนักสุด
      // โบนัสสลับหนัก-เบา (Balance) — ถ้าต่างจากตัวก่อนหน้า
      if (lastWasHeavy !== null && isHeavy(s) !== lastWasHeavy) score += 0.5;
      // tie-break: topo มาก่อนได้เปรียบเล็กน้อย (เสถียร)
      score -= (topoIndex.get(s.id) ?? 0) * 1e-4;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }

    result.push(best);
    scheduled.add(best.id);
    lastWasHeavy = isHeavy(best);
  }

  return result;
}
