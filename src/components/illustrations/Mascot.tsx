import Image from "next/image";

export type MascotName = "student" | "tutor" | "assessment" | "idea";

const sources: Record<MascotName, string> = {
  student: "/mascots/mascot-student.png",
  tutor: "/mascots/mascot-tutor.png",
  assessment: "/mascots/mascot-assessment.png",
  idea: "/mascots/mascot-idea.png",
};

const alts: Record<MascotName, string> = {
  student: "Friendly student mascot wearing headphones giving a thumbs up",
  tutor: "Tutor mascot in a blazer holding a GED book",
  assessment: "Tutor mascot holding an assessment clipboard",
  idea: "Student mascot holding a glowing lightbulb",
};

export default function Mascot({
  name,
  size = 200,
  className = "",
  priority = false,
}: {
  name: MascotName;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={sources[name]}
      alt={alts[name]}
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
