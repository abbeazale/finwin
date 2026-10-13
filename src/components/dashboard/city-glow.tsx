const widths = [18, 11, 26, 9, 15, 22, 8, 17, 30, 12, 20, 10, 24, 14, 9, 19, 27, 11, 16, 21];
const heights = [22, 34, 18, 44, 28, 16, 38, 25, 14, 40, 30, 20, 35, 12, 46, 24, 19, 32, 27, 17];

// One silhouette path of flat-topped towers across a 400×60 strip.
const towers = (() => {
  let x = 0;
  let path = "M0,60";
  for (let i = 0; x < 400; i++) {
    const w = widths[i % widths.length];
    const h = heights[i % heights.length];
    path += ` L${x},${60 - h} L${Math.min(x + w, 400)},${60 - h}`;
    x += w;
  }
  return `${path} L400,60 Z`;
})();

/**
 * A low strip of city at night along the bottom of a panel — the view from
 * the sign-in page's window, carried into the desk. Purely decorative.
 */
export function CityGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(0deg, rgba(255,154,60,0.22) 0%, rgba(255,154,60,0.06) 60%, transparent 100%)",
        }}
      />
      <svg
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-14 w-full"
      >
        <path d={towers} fill="#0b0a08" fillOpacity="0.92" />
      </svg>
      <div className="absolute inset-x-0 bottom-1 h-9">
        {Array.from({ length: 24 }).map((_, i) => {
          const size = (i % 2) + 1;
          return (
            <span
              key={i}
              className="animate-window-flicker absolute rounded-[1px]"
              style={{
                left: `${(i * 37) % 97 + 1}%`,
                bottom: `${(i * 23) % 45}%`,
                width: `${size}px`,
                height: `${size + 1}px`,
                background: i % 4 === 0 ? "var(--city)" : "var(--brass-hi)",
                opacity: 0.55,
                animationDelay: `${(i % 9) * 0.41}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
