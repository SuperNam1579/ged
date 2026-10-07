import type { Chromosome, GASubtopicGene, SubtopicData, ProficiencyMap, AvailabilitySlotInput } from "@/types";
import { recommendOrder } from "./ordering";
import { random as nextRandom } from "./random";

export function slotMinutesForDate(slots: AvailabilitySlotInput[], date: string): number {
  const dow = new Date(date).getDay(); //แปลงเลขวัน 0 = อาทิตย์ ... 6 = เสาร์
  return slots
    .filter((s) => s.dayOfWeek === dow) //เก็บช่วงว่างว่าตรงกับวันไหนของสัปดาห์
    .reduce((sum, s) => { //แปลงช่วงเป็นเวลานาที เช่น 1800 - 2000 = 120 นาที (2 ชม)
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return sum + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);
} //ใช้แค่สำหรับไฟล์นี้สำหรับการจัดเวลา

export function buildAvailableDates( //สร้างวันที่ผู้ใช้ว่างก่อน
  slots: AvailabilitySlotInput[], //รับข้อมูลวันว่างของผู้ใช้งาน
  startDate: Date, //วันที่เริ่ม
  endDate: Date //วันสุดท้าย
): string[] {
  const availableDays = new Set(slots.map((s) => s.dayOfWeek)); //ดึงวันว่าว่างวันไหนแล้วจัดเรียง
  const dates: string[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0); //ปรับเวลาให้เปรียบเทียบเฉพาะวัน
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0); //ปรับเวลาให้เปรียบเทียบเฉพาะวัน
  const current = new Date(start); //ให้มันค่อยๆทำไปทีละวัน
  while (current < end) {
    if (availableDays.has(current.getDay())) { //เช็ควันว่าตรงกับวันที่ผู้เรียนว่างไหม
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`); //ถ้าตรงก็เอาไปกลับไว้ใน dates เผื่อเอาไปใช้ในการคำนวณต่อ
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function createIndividual(
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap, //ระดับความเข้าใจของผู้เรียน
  availableDates: string[], //วันที่ว่าง
  slots: AvailabilitySlotInput[], //เวลาว่าง กี่นาที
  random: boolean = false
): Chromosome {
  if (availableDates.length === 0) return []; //ตรวจสอบว่ามีวันว่างจริงไหม ถ้าไม่มีก็คืนว่าว่าง

  const sorted = random //**ไปดูมา**
    ? [...subtopics].sort(() => nextRandom() - 0.5) //ใช้ -0.5(50%)เพื่อให้ได้ค่าลบ และบวกที่เท่าๆกัน
    : recommendOrder({ subtopics, proficiencies }); 

  const chromosome: Chromosome = []; //สร้าง chromosome เอาไว้ใช้กับ gene
  const dateLoad = new Map<string, number>(availableDates.map((d) => [d, 0]));  
  //สร้างว่าเรียนวิชาไหนไปกี่นาทีแล้ว

  for (const subtopic of sorted) { //วนเช็คหัวข้อ ex. math phy eng 
    const targetMins = subtopic.estimatedMinutes; //ดูเวลาเรียนจากตาราง database

    let bestDate = availableDates[0]; //ตั้งค่าให้เลือกวันแรกของวันที่ว่าง
    let bestLoad = Infinity;  

    for (const date of availableDates) { //เช็คว่าวันนี้เรียนครบตามที่เขากำหนดต่อวันไปหรือยัง 
                                          // เช่น กำหนด 2 ชม ก็วนเช็คว่าจัดครบ 2 ชมหรือยัง
      const load = dateLoad.get(date) ?? 0; //เช็คว่าระบบใช้ไปกี่ ชม แล้ว แล้วบันทึกลงใน dateload
      const capacity = slotMinutesForDate(slots, date); //แปลงเวลาว่าง เช่น 1800-2000 ก็เท่ากับวันนั้นมีเวลา 2 ชม
      const remaining = capacity - load; 
      if (remaining >= targetMins && load < bestLoad) { //เวลาที่ใช้ต้องไม่น้อยกว่าเวลาที่เหลือ และ วันที่ใช้เวลาน้อยที่สุด
        bestLoad = load;
        bestDate = date; //อัพเดตวันที่ดีที่สุด
      }
    }

    if (bestLoad === Infinity) { 
      bestDate = availableDates.reduce((best, d) => //เลือกวันที่ใช้เวลาน้อยที่สุด เพื่อยัดวิชาเรียน ยอมให้เกินแล้วไปหัก fitness ทีหลัง
        (dateLoad.get(d) ?? 0) < (dateLoad.get(best) ?? 0) ? d : best
      );
    }

    const gene: GASubtopicGene = { //สร้าง gene
      subtopicId: subtopic.id, //วิชา
      durationMins: targetMins, //เวลาเรียน
      scheduledDate: bestDate, //วันที่ 
      order: chromosome.length, //ลำดับ gene
    };

    chromosome.push(gene); //จากนั่นเอามาเก็บไว้ใน chromosome
    dateLoad.set(bestDate, (dateLoad.get(bestDate) ?? 0) + targetMins); //ถ้ามีการอัพเดตเวลาก็จะเพิ่มเวลาเข้ามา
  }

  return chromosome; 
}

export function initPopulation( //ดึงข้อมูลแต่ละอย่างมาเข้าขั้นตอนการผลิตประชากร
  populationSize: number,
  subtopics: SubtopicData[],
  proficiencies: ProficiencyMap,
  availableDates: string[],
  slots: AvailabilitySlotInput[]
): Chromosome[] {
  const population: Chromosome[] = [];

  population.push(
    createIndividual(subtopics, proficiencies, availableDates, slots, false) //ดึง 1 ที่ดีตัวเป็นตัวหลัก
  );

  for (let i = 1; i < populationSize; i++) {
    population.push(
      createIndividual(subtopics, proficiencies, availableDates, slots, true) //จากนั้นทำต่อจนครบ Size
    );
  }

  return population;
}
