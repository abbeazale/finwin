/**
 * The room, seen from the desk: warm city light through a mullioned window.
 * Purely decorative — it replaces the technical spec panel that used to sit
 * beside the sign-in card, so the page reads like the landing page's "quiet
 * room" rather than a console.
 */
export default function NightWindow() {
  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[16px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-2.5 cove">
        <div
          className="relative aspect-[16/10] overflow-hidden rounded-[10px]"
          style={{
            background:
              "linear-gradient(180deg, #0c0b09 0%, #171109 48%, #2b1f13 82%, #3d2c19 100%)",
          }}
        >
          {/* Low moon */}
          <div
            className="absolute right-[15%] top-[14%] h-14 w-14 rounded-full"
            style={{
              background:
                "radial-gradient(circle, #f2dcb0 0%, #c9a46b 38%, transparent 72%)",
              opacity: 0.6,
            }}
          />

          {/* Sodium-light haze over the street */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(0deg, rgba(255,154,60,0.34) 0%, rgba(255,154,60,0.08) 45%, transparent 100%)",
            }}
          />

          <div className="skyline absolute inset-x-0 bottom-0 h-[62%]" />

          {/* Lit windows across the towers */}
          <div className="absolute inset-x-0 bottom-[6%] h-[44%]">
            {Array.from({ length: 34 }).map((_, i) => {
              const left = (i * 31) % 97;
              const bottom = (i * 23) % 82;
              const size = (i % 3) + 1;
              return (
                <span
                  key={i}
                  className="animate-window-flicker absolute rounded-[1px]"
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                    width: `${size}px`,
                    height: `${size + 1}px`,
                    background: i % 4 === 0 ? "var(--city)" : "var(--brass-hi)",
                    opacity: 0.68,
                    animationDelay: `${(i % 11) * 0.37}s`,
                  }}
                />
              );
            })}
          </div>

          <div className="blinds pointer-events-none absolute inset-0 opacity-60" />

          {/* Mullions */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--ink-0)] opacity-80" />
            <div className="absolute inset-x-0 top-[46%] h-px bg-[var(--ink-0)] opacity-80" />
          </div>

          {/* Glass reflection */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, rgba(232,225,210,0.05) 0%, transparent 38%)",
            }}
          />
        </div>
      </div>

      <figcaption className="mt-4 flex items-baseline justify-between gap-6 px-1">
        <span className="display text-[14px] italic leading-none text-bone-mute">
          The desk, facing the windows
        </span>
        <span className="display text-[14px] italic leading-none text-bone-faint">
          22:14
        </span>
      </figcaption>
    </figure>
  );
}
