type Props = {
  variant?: "default" | "white";
  className?: string;
  title?: string;
};

// Orange = --coral in styles.css. The default variant uses currentColor, so the
// mark follows the text colour (dark on light theme, light on dark theme).
const ORANGE = "#E4571C";

export function Logo({ variant = "default", className, title = "Courtsie" }: Props) {
  const stroke = variant === "white" ? "#FFFFFF" : "currentColor";
  const text = variant === "white" ? "#FFFFFF" : "currentColor";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 292 96"
      className={variant === "white" ? className : `text-foreground ${className ?? ""}`}
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
      <circle cx="71.2" cy="48" r="11" fill={ORANGE} />
      <path
        d="M60.75 48 C 65.7 37 70.32 41.18 71.2 48 C 72.08 54.82 76.7 59 81.65 48"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        x="98"
        y="62"
        fontFamily="'Geologica Variable', sans-serif"
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
