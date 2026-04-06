const Logo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: { icon: 28, text: "text-lg" },
    md: { icon: 36, text: "text-xl" },
    lg: { icon: 48, text: "text-3xl" },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Accessibility person */}
        <circle cx="24" cy="10" r="4" fill="hsl(var(--primary))" />
        <path d="M24 16c-3 0-5.5 1-7 2l1.5 3c1.2-.8 3.2-1.5 5.5-1.5s4.3.7 5.5 1.5l1.5-3c-1.5-1-4-2-7-2z" fill="hsl(var(--primary))" />
        <path d="M21 22v10h2.5v-4h1v4H27V22h-1.5v4h-3v-4H21z" fill="hsl(var(--primary))" />
        {/* Audio waves */}
        <path d="M34 18c1.5 1.5 2.5 3.5 2.5 6s-1 4.5-2.5 6" stroke="hsl(var(--secondary))" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M38 14c2.5 2.8 4 6.2 4 10s-1.5 7.2-4 10" stroke="hsl(var(--secondary))" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
      </svg>
      <span className={`${s.text} font-bold text-primary`}>Accessibility</span>
    </div>
  );
};

export default Logo;
