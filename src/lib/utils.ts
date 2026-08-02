import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Narrows an unknown caught value to a displayable message.
 * `catch` binds `unknown`, so this replaces the unsafe `catch (e: any)` +
 * `e.message` pattern without losing the message when one exists.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return fallback
}

/**
 * Safari exposes the Web Audio constructor under a vendor prefix that isn't in
 * the DOM lib types. Returns undefined everywhere else.
 */
export function getWebkitAudioContext(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

/**
 * Normalises a date to a `YYYY-MM-DD` key.
 *
 * Prisma `DateTime` columns arrive as real `Date` objects (Server Actions
 * preserve them through serialization), so the old `value.split("T")[0]`
 * threw "split is not a function". Accepts either form.
 */
export function toDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0]
}

/** `error.name` when present — e.g. "AbortError" on a timed-out fetch. */
export function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name?: unknown }
    return typeof name === "string" ? name : undefined
  }
  return undefined
}

/** Node's `error.code` (e.g. "ECONNREFUSED"), which is not on the Error type. */
export function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code?: unknown }
    return typeof code === "string" ? code : undefined
  }
  return undefined
}
