"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  EASE_OUT,
  SPRING_LAYOUT,
} from "@/components/ui/preview-rail-utils/ease";
import { useDismiss } from "@/components/ui/preview-rail-utils/use-dismiss";
import { useHoverGesture } from "@/components/ui/preview-rail-utils/use-hover-gesture";
import { useTapGesture } from "@/components/ui/preview-rail-utils/use-tap-gesture";
import { cn } from "@/lib/utils";

export interface PreviewRailItem {
  id: string;
  label: string;
  ariaLabel?: string;
  description?: ReactNode;
  icon?: ReactNode;
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
}

export interface PreviewRailProps {
  items: PreviewRailItem[];
  label?: string;
  orientation?: "vertical" | "horizontal";
  activeId?: string;
  defaultActiveId?: string;
  onActiveChange?: (id: string) => void;
  onItemSelect?: (item: PreviewRailItem) => void;
  renderPreview?: (item: PreviewRailItem) => ReactNode;
  showPreview?: boolean;
  previewSide?: "before" | "after";
  highlightActive?: boolean;
  itemSize?: number;
  children?: ReactNode;
  className?: string;
  railClassName?: string;
  previewContainerClassName?: string;
  previewClassName?: string;
}

function DefaultPreview({ item }: { item: PreviewRailItem }) {
  return (
    <div
      data-slot="preview-rail-card"
      className="rounded-2xl border border-white/[0.1] bg-[#0b1a2e]/95 p-4 shadow-2xl shadow-cyan-950/60 backdrop-blur-md select-none"
    >
      <div className="flex items-center gap-3 mb-2">
        {item.icon && (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-[#38c6e0] flex items-center justify-center shrink-0 border border-cyan-400/30">
            {item.icon}
          </div>
        )}
        <div>
          <p
            data-slot="preview-rail-title"
            className="font-bold text-white text-sm font-sans leading-tight"
          >
            {item.label}
          </p>
          <span className="text-[10px] text-[#38c6e0] font-mono block mt-0.5">
            Clique para navegar
          </span>
        </div>
      </div>
      {item.description ? (
        <div
          data-slot="preview-rail-description"
          className="text-xs leading-relaxed text-[#c3d0de] font-sans pt-1.5 border-t border-white/[0.04]"
        >
          {item.description}
        </div>
      ) : null}
    </div>
  );
}

export function PreviewRail({
  items,
  label = "Section navigation",
  orientation = "vertical",
  activeId,
  defaultActiveId,
  onActiveChange,
  onItemSelect,
  renderPreview,
  showPreview = true,
  previewSide = "after",
  highlightActive = false,
  itemSize = 24,
  children,
  className,
  railClassName,
  previewContainerClassName,
  previewClassName,
}: PreviewRailProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [internalActiveId, setInternalActiveId] = useState(
    defaultActiveId ?? items[0]?.id ?? "",
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // A finger cannot hover, so a tap lights the tick instead. Kept apart from
  // the hovered one: they end in different ways, and a stray mouse move must
  // not clear a tick the keyboard or a tap chose.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<{
    top: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // A click carries no pointerType, so the pointerdown before it is what says
  // whether the activation was a tap. Keyboard activation has none at all.
  const tap = useTapGesture<boolean>();
  const hover = useHoverGesture();

  const clearPinned = useCallback(() => setPinnedId(null), []);

  // Limpa estados de hover, pin e coordenadas ao scrollar ou redimensionar para evitar tooltip órfão
  useEffect(() => {
    const handleDismiss = () => {
      setHoveredId(null);
      setPinnedId(null);
      setFocusedId(null);
      setHoveredRect(null);
    };
    window.addEventListener("scroll", handleDismiss, { passive: true, capture: true });
    window.addEventListener("resize", handleDismiss, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleDismiss, { capture: true });
      window.removeEventListener("resize", handleDismiss);
    };
  }, []);

  // The next tap outside the rail stands in for the pointer leaving it. The
  // card is a preview, so that tap passes through to whatever it landed on.
  useDismiss(pinnedId !== null, clearPinned, rootRef);

  const requestedActiveId = activeId ?? internalActiveId;
  const selectedId = items.some((item) => item.id === requestedActiveId)
    ? requestedActiveId
    : (items[0]?.id ?? "");
  const displayedId = hoveredId ?? pinnedId ?? focusedId ?? "";
  const displayedItem = items.find((item) => item.id === displayedId);
  const highlightedId = displayedId || (highlightActive ? selectedId : "");
  const displayedIndex = items.findIndex((item) => item.id === highlightedId);
  const rowTemplate = items.length
    ? `repeat(${items.length}, ${itemSize}px)`
    : undefined;
  const isHorizontal = orientation === "horizontal";

  const selectItem = (id: string) => {
    if (activeId === undefined) setInternalActiveId(id);
    onActiveChange?.(id);
  };

  return (
    <motion.div
      layoutRoot
      ref={rootRef}
      onBlur={(event) => {
        // Both tick sources leave with the focus: a tap does not always land
        // focus, but when it does, tabbing away must not strand the card.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusedId(null);
          setPinnedId(null);
        }
      }}
      className={cn(
        "isolate relative flex w-full overflow-visible",
        isHorizontal
          ? "min-h-64 flex-col items-center justify-center"
          : "min-h-80",
        className,
      )}
    >
      <nav
        aria-label={label}
        onPointerLeave={() => {
          setHoveredId(null);
          setFocusedId(null);
          setHoveredRect(null);
        }}
        style={
          isHorizontal
            ? { gridTemplateColumns: rowTemplate }
            : { gridTemplateRows: rowTemplate }
        }
        className={cn(
          "relative z-10 grid shrink-0",
          isHorizontal
            ? "h-12 w-fit max-w-full self-center justify-center"
            : "w-12 content-center",
          railClassName,
        )}
      >
        {items.map((item, index) => {
          const selected = item.id === selectedId;
          const highlighted = item.id === highlightedId;
          const distance =
            displayedIndex < 0
              ? Number.POSITIVE_INFINITY
              : Math.abs(index - displayedIndex);
          const scale = highlighted
            ? 1
            : distance === 1
              ? 0.68
              : distance === 2
                ? 0.44
                : 0.25;

          const itemContent = (
            <div className="flex items-center gap-2.5 w-full h-full px-1.5 justify-start">
              {/* Linha de marcação animada original (tick magnético com escala responsiva) */}
              <motion.span
                data-slot="preview-rail-tick"
                aria-hidden="true"
                animate={isHorizontal ? { scaleY: scale } : { scaleX: scale }}
                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                className={cn(
                  "block rounded-full shrink-0 transition-colors",
                  isHorizontal
                    ? "h-10 w-0.5 origin-bottom"
                    : "h-0.5 w-6 origin-left",
                  highlighted
                    ? "bg-[#38c6e0] shadow-[0_0_8px_#38c6e0]"
                    : selected
                    ? "bg-white/70"
                    : "bg-white/25",
                )}
              />

              {/* Ícone SVG temático do tópico */}
              {item.icon ? (
                <div
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                    highlighted
                      ? "bg-cyan-500/25 text-[#38c6e0] border border-cyan-400/50 shadow-md shadow-cyan-500/30 scale-110"
                      : selected
                      ? "bg-white/[0.1] text-white border border-white/20"
                      : "text-[#93a4b8] hover:text-[#e5edf6] hover:bg-white/[0.06]",
                  )}
                >
                  {item.icon}
                </div>
              ) : null}
            </div>
          );

          const sharedClassName = cn(
            "relative flex items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors rounded-xl",
            isHorizontal
              ? "h-12 w-10 items-end justify-center"
              : "w-20 h-8 items-center justify-start",
          );
          const sharedStyle = isHorizontal
            ? { width: itemSize }
            : { height: itemSize };
          const updateRect = (currentTarget: HTMLElement) => {
            const rect = currentTarget.getBoundingClientRect();
            setHoveredRect({
              top: rect.top,
              left: rect.left,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            });
          };
          const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
            updateRect(event.currentTarget);
            if (hover.enter(event)) setHoveredId(item.id);
          };
          const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
            if (!hoveredRect || hoveredId !== item.id) {
              updateRect(event.currentTarget);
              setHoveredId(item.id);
            }
          };
          const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
            tap.start(event, pinnedId === item.id);
            setFocusedId(null);
          };
          // A gesture the platform takes away sends no click, and a key press
          // starts an activation that never had a pointer behind it: either
          // one leaves a record the next click would read as a tap of its own.
          const dropGesture = () => tap.drop();
          const handleFocus = (currentTarget: HTMLElement) => {
            if (currentTarget.matches(":focus-visible")) {
              setFocusedId(item.id);
              updateRect(currentTarget);
            }
          };
          const handleSelect = (event: MouseEvent<HTMLElement>) => {
            const gesture = tap.take();
            const tapped = gesture !== null && gesture.pointerType !== "mouse";

            if (tapped) {
              if (item.href && !gesture.state) {
                event.preventDefault();
                setPinnedId(item.id);
                return;
              }
              setPinnedId(item.id);
            } else {
              setPinnedId(null);
              setFocusedId(null);
              setHoveredId(null);
              setHoveredRect(null);
            }

            selectItem(item.id);
            onItemSelect?.(item);
          };

          return item.href ? (
            <a
              key={item.id}
              data-slot="preview-rail-item"
              href={item.href}
              target={item.target}
              rel={
                item.rel ??
                (item.target === "_blank" ? "noreferrer noopener" : undefined)
              }
              aria-label={item.ariaLabel ?? item.label}
              aria-current={selected ? "page" : undefined}
              onPointerEnter={handlePointerEnter}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              onPointerCancel={dropGesture}
              onKeyDown={dropGesture}
              onFocus={(event) => handleFocus(event.currentTarget)}
              onClick={handleSelect}
              style={sharedStyle}
              className={sharedClassName}
            >
              {itemContent}
            </a>
          ) : (
            <button
              key={item.id}
              data-slot="preview-rail-item"
              type="button"
              aria-label={item.ariaLabel ?? item.label}
              aria-current={selected ? "location" : undefined}
              onPointerEnter={handlePointerEnter}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              onPointerCancel={dropGesture}
              onKeyDown={dropGesture}
              onFocus={(event) => handleFocus(event.currentTarget)}
              onClick={handleSelect}
              style={sharedStyle}
              className={sharedClassName}
            >
              {itemContent}
            </button>
          );
        })}
      </nav>

      {showPreview && mounted && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {displayedItem && hoveredRect ? (
                <motion.div
                  key="preview-rail-tooltip"
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : isHorizontal
                        ? { opacity: 0, y: 6, scale: 0.95 }
                        : { opacity: 0, x: -8, scale: 0.95 }
                  }
                  animate={
                    reduce
                      ? { opacity: 1 }
                      : isHorizontal
                        ? { opacity: 1, y: 0, scale: 1 }
                        : { opacity: 1, x: 0, scale: 1 }
                  }
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : isHorizontal
                        ? { opacity: 0, y: 4, scale: 0.95 }
                        : { opacity: 0, x: -6, scale: 0.95 }
                  }
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  className="fixed z-[9999] pointer-events-none select-none flex items-center"
                  style={
                    isHorizontal
                      ? {
                          top: `${hoveredRect.top - 10}px`,
                          left: `${hoveredRect.left + hoveredRect.width / 2}px`,
                          transform: "translate(-50%, -100%)",
                          transition: "left 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
                        }
                      : {
                          top: `${hoveredRect.top + hoveredRect.height / 2}px`,
                          left: `${hoveredRect.right + 12}px`,
                          transform: "translateY(-50%)",
                          transition: "top 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
                        }
                  }
                >
                  {renderPreview ? (
                    renderPreview(displayedItem)
                  ) : (
                    <div className="flex items-center">
                      {/* Seta indicadora apontando diretamente para o ícone (modo vertical) */}
                      {!isHorizontal && (
                        <div
                          aria-hidden="true"
                          className="w-2.5 h-2.5 bg-[#0b1a2e] border-l border-b border-cyan-400/40 rotate-45 -mr-1.5 z-10 shrink-0 shadow-sm"
                        />
                      )}

                      {/* Card do Tooltip com Título da Seção */}
                      <div className="py-2 px-3.5 rounded-xl bg-[#0b1a2e]/95 backdrop-blur-md border border-cyan-400/30 shadow-2xl shadow-cyan-950/80 flex flex-col gap-0.5 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs sm:text-sm font-sans tracking-wide leading-tight whitespace-nowrap">
                            {displayedItem.label}
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-[#38c6e0] font-semibold border border-cyan-400/30 shrink-0">
                            Navegar
                          </span>
                        </div>
                        {displayedItem.description ? (
                          <span className="text-[11px] text-[#93a4b8] font-sans leading-tight line-clamp-2">
                            {displayedItem.description}
                          </span>
                        ) : null}
                      </div>

                      {/* Seta indicadora apontando para baixo (modo horizontal) */}
                      {isHorizontal && (
                        <div
                          aria-hidden="true"
                          className="w-2.5 h-2.5 bg-[#0b1a2e] border-r border-b border-cyan-400/40 rotate-45 -mt-1.5 mx-auto z-10 shrink-0 shadow-sm"
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

      {children ? (
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      ) : null}
    </motion.div>
  );
}

export default PreviewRail;
