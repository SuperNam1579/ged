import Image from "next/image";

export default function HeroIllustration() {
  return (
    <Image
      src="/mascots/duo-hero.png"
      alt="Nick and Nam studying with AI-powered GED prep"
      width={1511}
      height={1041}
      priority
      className="w-full h-auto object-contain"
    />
  );
}
