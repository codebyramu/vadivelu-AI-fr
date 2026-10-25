import React, { useEffect, useRef, useState } from 'react';

interface InteractiveCursorProps {
  isDarkTheme: boolean;
  enabled?: boolean;
}

export const InteractiveCursor: React.FC<InteractiveCursorProps> = ({
  isDarkTheme,
  enabled = true,
}) => {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Mouse coords and interpolated ring coords
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    // Only enable on desktop pointer devices
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch || !enabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);

      // Instant dot positioning
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check if hovering interactive target
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest('button, a, input, textarea, [data-cursor="pointer"], [data-cursor-text]');
        if (interactive) {
          setIsHovering(true);
          const customText = interactive.getAttribute('data-cursor-text');
          setHoverText(customText || null);
        } else {
          setIsHovering(false);
          setHoverText(null);
        }
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      setIsHovering(false);
      setHoverText(null);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Smooth physics loop for outer ring
    const render = () => {
      // Lerp ring towards mouse position
      const ease = 0.18;
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * ease;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * ease;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [enabled, isVisible]);

  if (!enabled || !isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none transition-opacity duration-300">
      {/* Center sharp dot */}
      <div
        ref={dotRef}
        className={`fixed top-0 left-0 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full pointer-events-none transition-transform duration-75 ease-out ${
          isDarkTheme ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.5)]'
        } ${isHovering ? 'scale-0' : 'scale-100'}`}
      />

      {/* Floating physical ring */}
      <div
        ref={ringRef}
        className={`fixed top-0 left-0 -ml-[16px] -mt-[16px] pointer-events-none rounded-full flex items-center justify-center transition-all duration-200 ease-out ${
          isHovering
            ? hoverText
              ? 'w-16 h-16 -ml-[32px] -mt-[32px] border backdrop-blur-[1px]'
              : 'w-11 h-11 -ml-[22px] -mt-[22px] border backdrop-blur-[1px]'
            : 'w-8 h-8 border'
        } ${
          isDarkTheme
            ? isHovering
              ? 'border-white/70 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)] text-white'
              : 'border-white/40 bg-transparent text-white'
            : isHovering
              ? 'border-black/70 bg-black/10 shadow-[0_0_20px_rgba(0,0,0,0.1)] text-black'
              : 'border-black/40 bg-transparent text-black'
        }`}
      >
        {hoverText && (
          <span className="text-[9px] font-semibold tracking-wider uppercase px-1 text-center truncate max-w-[54px] animate-in fade-in zoom-in-90 duration-150">
            {hoverText}
          </span>
        )}
      </div>
    </div>
  );
};
