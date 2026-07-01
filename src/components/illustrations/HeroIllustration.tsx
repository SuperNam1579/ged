import Mascot from "./Mascot";

export default function HeroIllustration() {
  return (
    <div className="relative flex items-center justify-center w-full aspect-square max-w-[420px] mx-auto">
      <div className="absolute inset-6 rounded-full bg-[var(--primary-light)]" aria-hidden="true" />
      <div
        className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--primary)]/30"
        aria-hidden="true"
      />
      <span className="absolute top-6 right-10 w-4 h-4 rounded-full bg-[var(--gold)]" aria-hidden="true" />
      <span className="absolute bottom-10 left-8 w-3 h-3 rounded-full bg-[var(--accent)]" aria-hidden="true" />
      <span className="absolute top-1/2 left-4 w-2.5 h-2.5 rounded-full bg-[var(--primary)]" aria-hidden="true" />

      <Mascot name="student" size={340} priority className="relative z-10 drop-shadow-xl" />
    </div>
  );
}
