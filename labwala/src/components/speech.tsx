"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Square, Volume2 } from "lucide-react";
import type { Lang } from "@/lib/i18n/dictionaries";
import { cx } from "./ui";

/**
 * Listen button.
 * 1. Natural Microsoft neural voice generated on the laptop (Urdu: Asad; Punjabi uses the
 *    Urdu voice, same script; English: Prabhat). Cached per text.
 * 2. Falls back to the device's own voices if the laptop voice is unavailable (offline).
 * The language always follows the language chosen at the top of the screen.
 */

const PREFS: Record<Lang, string[]> = { en: ["en-PK", "en-IN", "en-GB", "en"], ur: ["ur-PK", "ur-IN", "ur"], pa: ["pa-PK", "pa-Arab", "ur-PK", "ur-IN", "ur"] };
const audioCache = new Map<string, string>(); // lang|chunk -> object URL
// 0.1s of silence, used to unlock audio playback inside the tap
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function deviceVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const p of PREFS[lang]) {
    const v = voices.find((x) => x.lang.toLowerCase().replace("_", "-").startsWith(p.toLowerCase()));
    if (v) return v;
  }
  return null;
}

const sentences = (text: string) => text.match(/[^.!?۔؟\n]+[.!?۔؟]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

type Labels = { listen: string; pause: string; resume: string; stop: string; noVoice: string };
type State = "idle" | "loading" | "playing" | "paused" | "error";

export function SpeechPlayer({ text, lang, labels, compact, large, className }: { text: string; lang: Lang; labels: Labels; compact?: boolean; large?: boolean; className?: string }) {
  const [state, setState] = useState<State>("idle");
  const audio = useRef<HTMLAudioElement | null>(null);
  const usingDevice = useRef(false);
  const playSession = useRef(0);

  useEffect(
    () => () => {
      playSession.current += 1; // cancel any chunks still loading
      audio.current?.pause();
      if (usingDevice.current) window.speechSynthesis?.cancel();
    },
    [],
  );
  // Language or text changed: stop the old speech
  useEffect(() => {
    playSession.current += 1;
    audio.current?.pause();
    audio.current = null;
    if (usingDevice.current) window.speechSynthesis?.cancel();
    setState("idle"); // eslint-disable-line react-hooks/set-state-in-effect
  }, [lang, text]);

  function playDevice() {
    const voice = deviceVoice(lang);
    if (!voice) return setState("error");
    usingDevice.current = true;
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = sentences(text);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = lang === "en" ? 0.98 : 0.92;
      if (i === parts.length - 1) u.onend = () => setState((s) => (s === "playing" ? "idle" : s));
      synth.speak(u);
    });
    setState("playing");
  }

  /** Split into ~350-character chunks at sentence ends: the first chunk starts speaking quickly. */
  function chunks(): string[] {
    const out: string[] = [];
    let cur = "";
    for (const sen of sentences(text)) {
      if ((cur + " " + sen).length > 350 && cur) {
        out.push(cur);
        cur = sen;
      } else cur = cur ? `${cur} ${sen}` : sen;
    }
    if (cur) out.push(cur);
    return out.slice(0, 40);
  }

  async function fetchChunk(chunk: string): Promise<string> {
    const key = `${lang}|${chunk}`;
    const hit = audioCache.get(key);
    if (hit) return hit;
    const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: chunk, lang }) });
    if (!res.ok) throw new Error("tts");
    const url = URL.createObjectURL(await res.blob());
    audioCache.set(key, url);
    return url;
  }

  async function play() {
    usingDevice.current = false;
    setState("loading");
    // Unlock audio inside the tap itself (phones block play() that starts later).
    const a = new Audio(SILENT);
    audio.current = a;
    a.play().catch(() => {});
    const parts = chunks();
    const session = (playSession.current += 1);
    try {
      let next: Promise<string> = fetchChunk(parts[0]);
      for (let i = 0; i < parts.length; i++) {
        const url = await next;
        if (playSession.current !== session) return; // stopped or restarted
        if (i + 1 < parts.length) next = fetchChunk(parts[i + 1]); // prefetch while this one plays
        a.src = url;
        await a.play();
        setState("playing");
        await new Promise<void>((res, rej) => {
          a.onended = () => res();
          a.onerror = () => rej(new Error("audio"));
        });
        if (playSession.current !== session) return;
      }
      setState("idle");
    } catch {
      if (playSession.current === session) playDevice(); // offline or voice service unavailable
    }
  }

  function pause() {
    if (usingDevice.current) window.speechSynthesis.pause();
    else audio.current?.pause();
    setState("paused");
  }
  function resume() {
    if (usingDevice.current) window.speechSynthesis.resume();
    else audio.current?.play();
    setState("playing");
  }
  function stop() {
    playSession.current += 1;
    if (usingDevice.current) window.speechSynthesis.cancel();
    else if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
    setState("idle");
  }

  const btn = cx(
    "inline-flex items-center justify-center gap-2 rounded-full transition active:scale-[0.98] disabled:opacity-60",
    large
      ? "h-12 flex-1 bg-surface-2 px-5 text-[16px] font-medium text-ink"
      : cx("border border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink", compact ? "h-10 px-4 text-[14px]" : "h-11 px-4 text-[15px]"),
  );

  return (
    <div className={cx("flex items-center gap-2", !large && "inline-flex", className)}>
      {(state === "idle" || state === "error" || state === "loading") && (
        <button type="button" className={btn} onClick={play} disabled={state === "loading"} aria-busy={state === "loading"}>
          {state === "loading" ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Volume2 className="size-[18px]" aria-hidden />}
          {labels.listen}
        </button>
      )}
      {state === "playing" && (
        <button type="button" className={btn} onClick={pause}>
          <Pause className="size-[18px]" aria-hidden />
          {labels.pause}
        </button>
      )}
      {state === "paused" && (
        <button type="button" className={btn} onClick={resume}>
          <Play className="size-[18px]" aria-hidden />
          {labels.resume}
        </button>
      )}
      {(state === "playing" || state === "paused") && (
        <button type="button" className={cx(btn, large ? "w-12 flex-none px-0" : "w-11 px-0")} aria-label={labels.stop} title={labels.stop} onClick={stop}>
          <Square className="size-4" aria-hidden />
        </button>
      )}
      {state === "error" && labels.noVoice && <span className="text-[13px] text-ink-3">{labels.noVoice}</span>}
    </div>
  );
}
