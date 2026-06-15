"use client";

import * as React from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ActionPillConfig {
  key: string;
  placeholder: string;
  type: "select" | "text";
  options?: string[];
}

export interface ActionConfig {
  id: string;
  label: string;
  sentence: string;
  pills: ActionPillConfig[];
}

type ExecState = "idle" | "collapsing" | "rippling" | "done";

export interface ActionComposerProps {
  actions: ActionConfig[];
  onExecute?: (
    action: ActionConfig,
    values: Record<string, string>,
  ) => void | Promise<void>;
  placeholder?: string;
  triggerCharacter?: string;
  pillColors?: Array<{ base: string; focus: string }>;
  rows?: number;
  className?: string;
  executeLabel?: string;
  cancelLabel?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_PILL_COLORS = [
  { base: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20", focus: "ring-cyan-400/40" },
  { base: "bg-violet-500/10 text-violet-300 border-violet-400/20", focus: "ring-violet-400/40" },
  { base: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20", focus: "ring-emerald-400/40" },
  { base: "bg-rose-500/10 text-rose-300 border-rose-400/20", focus: "ring-rose-400/40" },
  { base: "bg-orange-500/10 text-orange-300 border-orange-400/20", focus: "ring-orange-400/40" },
  { base: "bg-pink-500/10 text-pink-300 border-pink-400/20", focus: "ring-pink-400/40" },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL HOOKS & UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useDropdownPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
    });
  }, [open, triggerRef]);

  return pos;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORTED HEADLESS HOOK
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseActionComposerOptions {
  actions: ActionConfig[];
  triggerCharacter?: string;
  onExecute?: ActionComposerProps["onExecute"];
}

export function useActionComposer({
  actions,
  triggerCharacter = "/",
  onExecute,
}: UseActionComposerOptions) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const [value, setValue] = React.useState("");
  const [showMenu, setShowMenu] = React.useState(false);
  const [selectedMenuIndex, setSelectedMenuIndex] = React.useState(0);
  const [action, setAction] = React.useState<ActionConfig | null>(null);
  const [pillValues, setPillValues] = React.useState<Record<string, string>>({});
  const [execState, setExecState] = React.useState<ExecState>("idle");
  const [rippleOrigin, setRippleOrigin] = React.useState({ x: 0, y: 0 });
  const [cardSize, setCardSize] = React.useState({ w: 600, h: 200 });

  React.useEffect(() => {
    setShowMenu(value === triggerCharacter);
  }, [value, triggerCharacter]);

  const allFilled = React.useMemo(
    () =>
      action !== null &&
      action.pills.every((p) => {
        const v = pillValues[p.key];
        return v !== undefined && v !== null && String(v).trim() !== "";
      }),
    [action, pillValues],
  );

  const maxRadius = Math.max(
    Math.hypot(rippleOrigin.x, rippleOrigin.y),
    Math.hypot(cardSize.w - rippleOrigin.x, rippleOrigin.y),
    Math.hypot(rippleOrigin.x, cardSize.h - rippleOrigin.y),
    Math.hypot(cardSize.w - rippleOrigin.x, cardSize.h - rippleOrigin.y),
  );

  const selectAction = React.useCallback((a: ActionConfig) => {
    setShowMenu(false);
    setPillValues({});
    setTimeout(() => setAction(structuredClone(a)), 80);
  }, []);

  const setPillValue = React.useCallback((key: string, val: string) => {
    setPillValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const cancel = React.useCallback(() => {
    setAction(null);
    setValue("");
    setPillValues({});
    setExecState("idle");
    setTimeout(() => textareaRef.current?.focus(), 120);
  }, []);

  const execute = React.useCallback(async () => {
    if (!allFilled || !action || execState !== "idle") return;

    if (btnRef.current && cardRef.current) {
      const btnRect = btnRef.current.getBoundingClientRect();
      const cardRect = cardRef.current.getBoundingClientRect();
      setRippleOrigin({
        x: btnRect.left + btnRect.width / 2 - cardRect.left,
        y: btnRect.top + btnRect.height / 2 - cardRect.top,
      });
      setCardSize({ w: cardRect.width, h: cardRect.height });
    }

    setExecState("collapsing");
    await delay(300);
    setExecState("rippling");
    await delay(700);
    setExecState("done");

    await onExecute?.(action, { ...pillValues });

    await delay(300);
    cancel();
  }, [allFilled, action, execState, pillValues, onExecute, cancel]);

  const handleTextareaKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!showMenu) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMenuIndex((v) => Math.min(actions.length - 1, v + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMenuIndex((v) => Math.max(0, v - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectAction(actions[selectedMenuIndex]);
      }
      if (e.key === "Escape") setShowMenu(false);
    },
    [showMenu, actions, selectedMenuIndex, selectAction],
  );

  return {
    value, action, pillValues, showMenu, selectedMenuIndex, execState, allFilled, maxRadius, rippleOrigin,
    textareaRef, cardRef, btnRef,
    setValue, selectAction, setPillValue, cancel, execute, handleTextareaKeyDown,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface PillProps {
  pill: ActionPillConfig;
  value: string | undefined;
  onChange: (val: string) => void;
  colorBase: string;
  colorFocus: string;
  tabIndex: number;
}

function SelectPill({ pill, value, onChange, colorBase, colorFocus, tabIndex }: PillProps) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const pos = useDropdownPosition(btnRef, open);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = (opt: string) => {
    onChange(opt);
    setOpen(false);
    btnRef.current?.focus();
  };

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          role="listbox"
          aria-label={pill.placeholder}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[160px] rounded-2xl border border-white/10 bg-zinc-900/98 backdrop-blur-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          {pill.options?.map((opt, i) => (
            <motion.button
              key={opt}
              role="option"
              aria-selected={value === opt}
              data-option
              tabIndex={0}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.12 }}
              onClick={() => pick(opt)}
              onKeyDown={(e) => {
                const items = dropdownRef.current?.querySelectorAll("[data-option]");
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  (items?.[i + 1] as HTMLElement)?.focus();
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (i > 0) (items?.[i - 1] as HTMLElement)?.focus();
                  else btnRef.current?.focus();
                }
                if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(opt); }
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm outline-none border-b border-white/[0.04] last:border-none transition-colors duration-100 focus-visible:bg-white/[0.08]",
                value === opt ? "text-white bg-white/[0.07]" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              <span className="flex items-center justify-between">
                {opt}
                {value === opt && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="text-xs opacity-40"
                  >
                    ✓
                  </motion.span>
                )}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative inline-block">
      <motion.button
        ref={btnRef}
        tabIndex={tabIndex}
        layout
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            (dropdownRef.current?.querySelectorAll("[data-option]")[0] as HTMLElement)?.focus();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
          colorBase,
          colorFocus,
          !value ? "opacity-50" : "opacity-100",
        )}
      >
        {value ?? pill.placeholder}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className="opacity-40 text-[10px] ml-0.5"
        >
          ▾
        </motion.span>
      </motion.button>

      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

function TextPill({ pill, value, onChange, colorBase, colorFocus, tabIndex }: PillProps) {
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      onClick={() => setEditing(true)}
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium cursor-text transition-all duration-150",
        colorBase,
        !value ? "opacity-50" : "opacity-100",
        editing && `ring-2 ${colorFocus} opacity-100`,
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          tabIndex={tabIndex}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          placeholder={pill.placeholder}
          className="bg-transparent outline-none border-none placeholder:opacity-40 w-24 text-sm"
          style={{ color: "inherit" }}
        />
      ) : (
        <button
          tabIndex={tabIndex}
          onFocus={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
          }}
          className="outline-none bg-transparent border-none cursor-text"
          style={{ color: "inherit" }}
        >
          {value || pill.placeholder}
        </button>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORTED COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function ActionComposer({
  actions,
  onExecute,
  placeholder = "Type '/' for actions…",
  triggerCharacter = "/",
  pillColors = DEFAULT_PILL_COLORS,
  rows = 5,
  className,
  executeLabel = "Execute →",
  cancelLabel = "Cancel",
}: ActionComposerProps) {
  const {
    value, action, pillValues, showMenu, selectedMenuIndex, execState, allFilled, maxRadius, rippleOrigin,
    textareaRef, cardRef, btnRef,
    setValue, selectAction, setPillValue, cancel, execute, handleTextareaKeyDown,
  } = useActionComposer({ actions, triggerCharacter, onExecute });

  return (
    <LayoutGroup>
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className={cn("relative w-full max-w-2xl", className)}
      >
        <motion.div
          ref={cardRef}
          layout
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950/80 backdrop-blur-2xl shadow-[0_2px_40px_rgba(0,0,0,0.5)]"
        >
          {/* Ripple Overlay */}
          <AnimatePresence>
            {(execState === "rippling" || execState === "done") && (
              <motion.div
                key="ripple"
                initial={{ scale: 0, opacity: 1 }}
                animate={execState === "done" ? { scale: maxRadius / 40, opacity: 0 } : { scale: maxRadius / 40, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={execState === "done" ? { duration: 0.28, ease: "easeOut" } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  left: rippleOrigin.x - 40,
                  top: rippleOrigin.y - 40,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.07)",
                  zIndex: 40,
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>

          {/* Views */}
          <AnimatePresence mode="wait">
            {!action ? (
              <motion.div
                key="composer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: "blur(4px)", scale: 0.99 }}
                transition={{ duration: 0.18 }}
                className="relative"
              >
                <textarea
                  ref={textareaRef}
                  tabIndex={0}
                  rows={rows}
                  value={value}
                  placeholder={placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  className="w-full resize-none bg-transparent px-7 py-7 text-[15px] text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <div className="px-7 pb-5 text-xs text-zinc-600 tracking-wide">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-500 font-mono text-[11px]">
                    {triggerCharacter}
                  </kbd>{" "}
                  to trigger an action
                </div>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      role="menu"
                      aria-label="Actions"
                      initial={{ opacity: 0, scale: 0.97, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, y: -8 }}
                      transition={{ type: "spring", stiffness: 340, damping: 28 }}
                      className="absolute left-4 top-4 z-50 w-72 rounded-[20px] border border-white/10 bg-zinc-950/96 backdrop-blur-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
                    >
                      <div className="px-4 pt-3 pb-2 text-[11px] text-zinc-600 uppercase tracking-widest">Actions</div>
                      {actions.map((item, index) => (
                        <motion.button
                          key={item.id}
                          role="menuitem"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => selectAction(item)}
                          onMouseEnter={() => setSelectedMenuIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between px-4 py-3 text-left border-b border-white/[0.04] last:border-none transition-colors duration-100",
                            selectedMenuIndex === index ? "bg-white/[0.06] text-white" : "text-zinc-400 hover:text-white",
                          )}
                        >
                          <span className="text-sm">{item.label}</span>
                          {selectedMenuIndex === index && (
                            <motion.span layoutId="menu-indicator" className="text-xs text-zinc-600">↵</motion.span>
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="action"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <div className="px-7 pt-7 pb-1 text-[11px] text-zinc-600 uppercase tracking-widest">{action.label}</div>

                <div className="px-7 py-5 flex flex-wrap items-center gap-2.5 text-[15px] leading-relaxed">
                  <span className="text-zinc-400">{action.sentence}</span>
                  {action.pills.map((pill, i) => {
                    const color = pillColors[i % pillColors.length];
                    const props: PillProps = {
                      pill,
                      value: pillValues[pill.key],
                      onChange: (val) => setPillValue(pill.key, val),
                      colorBase: color.base,
                      colorFocus: color.focus,
                      tabIndex: 1 + i,
                    };
                    return pill.type === "select" ? (
                      <SelectPill key={pill.key} {...props} />
                    ) : (
                      <TextPill key={pill.key} {...props} />
                    );
                  })}
                </div>

                <div className="mx-7 h-px bg-white/[0.06]" />

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.16 }}
                  className="flex justify-between items-center px-7 py-5"
                >
                  <motion.button
                    onClick={cancel}
                    animate={{ opacity: execState !== "idle" ? 0 : 1 }}
                    transition={{ duration: 0.18 }}
                    style={{ pointerEvents: execState !== "idle" ? "none" : "auto" }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-500 outline-none hover:bg-white/5 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-white/20 transition-colors duration-150"
                  >
                    {cancelLabel}
                  </motion.button>

                  <motion.button
                    ref={btnRef}
                    tabIndex={1 + (action?.pills.length ?? 0)}
                    onClick={execute}
                    disabled={!allFilled || execState !== "idle"}
                    layout
                    animate={{
                      width: execState !== "idle" ? 44 : "auto",
                      borderRadius: execState !== "idle" ? 22 : 12,
                      opacity: execState === "rippling" || execState === "done" ? 0 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    className={cn(
                      "relative z-50 h-[38px] min-w-[44px] px-5 text-sm font-medium overflow-hidden flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white/30 transition-colors duration-150",
                      allFilled ? "bg-white text-black cursor-pointer" : "bg-white/10 text-white/25 cursor-not-allowed",
                    )}
                  >
                    <AnimatePresence mode="wait">
                      {execState === "idle" && (
                        <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.12 }}>
                          {executeLabel}
                        </motion.span>
                      )}
                      {execState === "collapsing" && (
                        <motion.span key="dot" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="w-1.5 h-1.5 rounded-full bg-black/60 block" />
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}