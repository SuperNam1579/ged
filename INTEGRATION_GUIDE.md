# คู่มือปรับ GA Fitness Function (ระดับ 3 — ครบตามงานวิจัย)

สรุปสิ่งที่ต้องแก้ มี **4 จุด** ไล่จากง่ายไปยาก ทำตามลำดับได้เลย

---

## ✅ จุดที่ 1 — แก้ Type `FitnessBreakdown`

**ไฟล์:** `src/types/index.ts`

เพิ่มฟิลด์ `variety` เข้าไปใน interface

```ts
export interface FitnessBreakdown {
  coverage: number;          // 0–1
  weaknessFocus: number;     // 0–1
  timeFeasibility: number;   // 0–1
  prerequisiteOrder: number; // 0–1
  variety: number;           // 0–1   ★ เพิ่มบรรทัดนี้
  balance: number;           // 0–1
  total: number;             // weighted sum 0–1
}
```

---

## ✅ จุดที่ 2 — แทนที่ไฟล์ `fitness.ts` ทั้งไฟล์

**ไฟล์:** `src/lib/ga/fitness.ts`

แทนที่ด้วยไฟล์ `fitness.ts` ที่แนบมา การเปลี่ยนแปลงหลัก:

| ส่วน | เดิม | ใหม่ |
|---|---|---|
| **Weights** | Coverage .30 / Weakness .25 / Time .20 / Prereq .15 / Balance .10 | Coverage .25 / Weakness .20 / Time .15 / Prereq .15 / **Variety .15** / Balance .10 |
| **balanceScore** | CV ของเวลารวมต่อวิชา | variance ของ "ความยาก" รายวัน + penalty หนักติดหนัก |
| **varietyScore** | ❌ ไม่มี | ★ ใหม่ — KL-divergence + distinct-subjects/day + weekly-presence |

**สำคัญ:** `varietyScore` ใช้ `ctx.subjectCodes` และ `ctx.proficiencies` ที่ `FitnessContext` มีอยู่แล้ว ไม่ต้องเพิ่ม input

---

## ✅ จุดที่ 3 — เพิ่มไฟล์ `ordering.ts` (วิชาไหนมาก่อน/ต่อกับวิชาไหน)

**ไฟล์ใหม่:** `src/lib/ga/ordering.ts`

ใช้ไฟล์ `ordering.ts` ที่แนบมา มี logic จัดลำดับตาม 3 หลัก:
1. Prerequisite มาก่อน (topological sort)
2. วิชาอ่อนได้คิวก่อน (weakness-first — แบบ B)
3. สลับหนัก-เบา ไม่ให้ติดกัน

### เอาไปใช้ตอนสร้าง population เริ่มต้น

**ไฟล์:** `src/lib/ga/population.ts`

ตอนสร้าง "greedy individual" (ตัวแรกที่ไม่ random) ให้เรียกใช้:

```ts
import { recommendOrder } from "./ordering";

// ใน createGreedyIndividual() หรือชื่อที่คุณใช้:
const orderedSubtopics = recommendOrder({
  subtopics,
  proficiencies,
});
// แล้วใช้ orderedSubtopics นี้ในการ assign วัน/เวลา
// (จากเดิมที่อาจ sort ตาม weakness อย่างเดียว)
```

---

## ✅ จุดที่ 4 — Verify ว่าไม่มีที่อื่นอ้าง `FitnessBreakdown` แบบเก่า

ค้นหาในโปรเจกต์ว่ามีจุดไหน hardcode 5 ฟิลด์ของ fitness breakdown ไหม
(เช่นหน้า dashboard ที่โชว์ fitness chart)

```bash
grep -rn "fitnessBreakdown" src/
grep -rn "prerequisiteOrder" src/
```

ถ้าเจอหน้าที่ map fitness breakdown มาโชว์ ให้เพิ่ม `variety` เข้าไปด้วย
เช่นใน Recharts ที่โชว์ convergence อาจต้องเพิ่ม bar/line ของ variety

---

## 🧪 ทดสอบหลังแก้

```bash
# 1. type check ผ่านไหม
npx tsc --noEmit

# 2. รัน GA generate ดูว่า fitness breakdown มี variety โผล่มา
#    เข้า /api/ga/generate แล้วดู response.fitnessBreakdown

# 3. ดูตารางที่ได้ — เช็คว่า
#    - วิชาอ่อนยังได้เวลาเยอะสุด (weakness ยังนำ)
#    - แต่ละวันมี 2-3 วิชา ไม่กระจุกวิชาเดียว
#    - วิชาหนัก (Math/Sci) ไม่วางติดกันรัวๆ ในวันเดียว
```

---

## 📌 สรุปพฤติกรรมที่ควรเห็น (แบบ B)

- **Weakness ยังมาก่อนเสมอ** — target distribution ของ variety derive จาก proficiency
  วิชาอ่อนจึงได้ทั้งเวลาเยอะ (weakness) และ target ส่วนแบ่งสูง (variety ไม่ตีกัน)
- **Variety แค่ช่วยจัดเรียง** — ไม่ดึงเวลาออกจากวิชาอ่อน แต่ช่วยไม่ให้วันนึงมีวิชาเดียว
  และช่วยสลับหนัก-เบาให้ผู้เรียนไม่ล้า
- **Ordering ฉลาดขึ้น** — prereq มาก่อน, วิชาอ่อนได้คิวก่อน, สลับหนัก-เบา
