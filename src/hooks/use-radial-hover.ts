import { useRef } from "react";

interface UseRadialHoverOptions {
  durationMs?: number;
  easing?: string;
  sizeMultiplier?: number;
}

export function useRadialHover<T extends HTMLElement = HTMLButtonElement>(
  options: UseRadialHoverOptions = {}
) {
  const {
    durationMs = 800,
    easing = "cubic-bezier(0.16, 1, 0.3, 1)",
    sizeMultiplier = 2.2,
  } = options;

  const containerRef = useRef<T>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = (e: React.MouseEvent<T>) => {
    if (!containerRef.current || !rippleRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.ceil(Math.hypot(rect.width, rect.height) * sizeMultiplier);

    const circle = rippleRef.current;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.transition = "none";
    circle.style.transform = "translate(-50%, -50%) scale(0)";
    void circle.offsetWidth; // trigger reflow
    circle.style.transition = `transform ${durationMs}ms ${easing}`;
    circle.style.transform = "translate(-50%, -50%) scale(1)";
  };

  const handleMouseLeave = (e: React.MouseEvent<T>) => {
    if (!containerRef.current || !rippleRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const circle = rippleRef.current;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    circle.style.transition = `transform ${durationMs}ms ${easing}`;
    circle.style.transform = "translate(-50%, -50%) scale(0)";
  };

  const handleFocus = () => {
    if (!rippleRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const size = Math.ceil(Math.hypot(rect.width, rect.height) * sizeMultiplier);
    const circle = rippleRef.current;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${rect.width / 2}px`;
    circle.style.top = `${rect.height / 2}px`;
    circle.style.transition = `transform ${durationMs}ms ${easing}`;
    circle.style.transform = "translate(-50%, -50%) scale(1)";
  };

  const handleBlur = () => {
    if (!rippleRef.current) return;
    rippleRef.current.style.transition = `transform ${durationMs}ms ${easing}`;
    rippleRef.current.style.transform = "translate(-50%, -50%) scale(0)";
  };

  return {
    containerRef,
    rippleRef,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}
