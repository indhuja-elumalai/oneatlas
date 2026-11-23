"use client";
// Tiny client store for the compare tray. localStorage is a per-browser
// convenience only; the shareable source of truth is the /compare?m=... URL.
import { useSyncExternalStore } from "react";

const KEY = "oneatlas:compare";
const EVENT = "oneatlas:compare-change";
export const MAX_COMPARE = 4;
const EMPTY: string[] = [];
let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.value;
    const value = raw ? (JSON.parse(raw) as string[]) : EMPTY;
    cache = { raw, value };
    return value;
  } catch {
    return EMPTY;
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useCompareList() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleCompare(slug: string) {
  const list = read();
  if (list.includes(slug)) write(list.filter((s) => s !== slug));
  else if (list.length < MAX_COMPARE) write([...list, slug]);
}

export function clearCompare() {
  write([]);
}
