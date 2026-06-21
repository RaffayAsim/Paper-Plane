/* HeroScene: GSAP-animated floating orbs only — clean, no overlapping cards */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref      = useRef<HTMLDivElement>(null);
  const orb2Ref      = useRef<HTMLDivElement>(null);
  const orb3Ref      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Orb 1 — large primary glow, drifts slowly up-right
      gsap.to(orb1Ref.current, {
        x: 50, y: -40,
        duration: 9,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      // Orb 2 — medium violet, drifts down-left
      gsap.to(orb2Ref.current, {
        x: -60, y: 50,
        duration: 11,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 1.2,
      });

      // Orb 3 — smaller indigo, gentle drift
      gsap.to(orb3Ref.current, {
        x: 35, y: 45,
        duration: 13,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        delay: 2.5,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.03,
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px)," +
            "linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Orb 1 — large primary, top-right */}
      <div
        ref={orb1Ref}
        className="absolute"
        style={{
          top: "-15%",
          right: "-5%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      {/* Orb 2 — medium violet, bottom-left */}
      <div
        ref={orb2Ref}
        className="absolute"
        style={{
          bottom: "-5%",
          left: "-8%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(270 80% 65% / 0.15) 0%, transparent 70%)",
          filter: "blur(55px)",
        }}
      />

      {/* Orb 3 — small indigo, center-right area */}
      <div
        ref={orb3Ref}
        className="absolute"
        style={{
          top: "35%",
          right: "35%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)",
          filter: "blur(45px)",
        }}
      />
    </div>
  );
}
