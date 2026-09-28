type Props = {
  variant?: "default" | "white";
  className?: string;
  title?: string;
};

export function Logo({ variant = "default", className, title = "Courtsie" }: Props) {
  const stroke = variant === "white" ? "#FFFFFF" : "#0E4756";
  const text = variant === "white" ? "#FFFFFF" : "#0E4756";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 292 96"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M68.1 30.8 A28 28 0 1 0 68.1 65.2"
        fill="none"
        stroke={stroke}
        strokeWidth="10.5"
        strokeLinecap="round"
      />
      <circle cx="71.2" cy="48" r="11" fill="#C9DC34" stroke="#1A1A14" strokeWidth="1.1" />
      <path
        d="M60.75 48 C 65.7 37 70.32 41.18 71.2 48 C 72.08 54.82 76.7 59 81.65 48"
        fill="none"
        stroke="#8A9A20"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M60.75 48 C 65.7 37 70.32 41.18 71.2 48 C 72.08 54.82 76.7 59 81.65 48"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <ellipse
        cx="66"
        cy="43"
        rx="4.8"
        ry="3.2"
        fill="#FFFFFF"
        opacity="0.22"
        transform="rotate(-28 66 43)"
      />
      <text
        x="98"
        y="62"
        fontFamily="Inter, sans-serif"
        fontWeight={700}
        fontSize={46}
        letterSpacing="-1.5"
        fill={text}
      >
        Courtsie
      </text>
    </svg>
  );
}
