"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";

type AiResult<K extends string> = { success: true } & Record<K, string> | { success: false; error: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Caps what one call can send to the model (and spend). */
const MAX_INPUT_CHARS = 20_000;

// Interpolated into the system prompt, so only known names get through.
const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Chinese", "Hindi", "Arabic", "Russian", "Portuguese", "Italian", "Korean"];
const language = (value: string) => (LANGUAGES.includes(value) ? value : "English");

/**
 * These are Server Actions, callable by anyone who finds them. Without this
 * check, a stranger could spend the OpenAI key; with it, only signed-in users.
 */
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in to use AI features.");
}

/**
 * Asks the configured model: Claude when ANTHROPIC_API_KEY is set, else
 * OpenAI when OPENAI_API_KEY is. Returns null when neither is, so callers
 * can decide whether a local fallback is honest for that operation.
 */
async function chat(system: string, user: string, json = false): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return claude(system, user, json);
  return openai(system, user, json);
}

/** Claude via the Messages API. ANTHROPIC_MODEL overrides the default model. */
async function claude(system: string, user: string, json: boolean): Promise<string | null> {
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2048,
      system: json ? `${system}\nRespond with the JSON object only, no prose and no code fences.` : system,
      messages: [{ role: "user", content: user.slice(0, MAX_INPUT_CHARS) }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Claude request failed (${res.status} ${res.statusText})`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";
  if (!text) return null;
  if (!json) return text;
  // Tolerate a stray code fence or sentence around the object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

async function openai(system: string, user: string, json: boolean): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user.slice(0, MAX_INPUT_CHARS) },
      ],
      ...(json && { response_format: { type: "json_object" } }),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

export async function aiSummarizeAction(
  text: string,
  targetLanguage: string = "English"
): Promise<AiResult<"summary">> {
  try {
    await requireUser();
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const summary = await chat(
      `You are an executive note assistant. Summarize text concisely in ${language(targetLanguage)}. Output clean HTML without any emojis. Use <strong> for emphasis.`,
      text
    );
    if (summary) return { success: true, summary };

    // No API key: fall back to a purely extractive summary — the first few
    // sentences of the note verbatim. This does NOT translate, so the heading
    // must not claim a target language it never produced.
    const clean = stripTags(text);
    if (!clean) return { success: false, error: "No text provided" };

    const sentences = clean.split(/(?<=[.?!])\s+/).filter((s) => s.length > 10);
    const excerpt = sentences.slice(0, 3).join(" ") || `${clean.slice(0, 250)}…`;

    const summaryHtml = `
      <div class="my-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 text-zinc-300 shadow-lg">
        <div class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Key sentences</div>
        <p class="text-sm leading-relaxed text-zinc-200 font-normal">${escapeHtml(excerpt)}</p>
        <p class="mt-2 text-[10px] text-zinc-500">Extracted locally — set OPENAI_API_KEY for a real AI summary.</p>
      </div>
    `;

    return { success: true, summary: summaryHtml };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export type ExtractedTask = {
  title: string;
  dueDate?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Pre-ticked in the review dialog; guesses from plain bullets start unticked. */
  suggested: boolean;
};

const extractedSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish()
          .transform((v) => v ?? undefined),
        priority: z
          .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
          .nullish()
          .transform((v) => v ?? undefined),
      })
    )
    .max(30),
});

// Explicit to-do markers people type: "[ ] x", "- [ ] x", "☐ x", "TODO: x".
const MARKER = /^(?:[-*•]\s*)?(?:\[\s?\]|☐|todo:?|to do:|action:)\s*(.+)$/i;

/**
 * Pulls actionable tasks out of a note for the user to review before they're
 * created. With OPENAI_API_KEY the model reads the note (and resolves "by
 * Friday" against `today`); without one, only explicit to-do markers count,
 * plus bullet points offered unticked — guessing more would be dishonest.
 */
export async function aiExtractTasksAction(
  text: string,
  today?: string
): Promise<{ success: true; tasks: ExtractedTask[]; usedAi: boolean } | { success: false; error: string }> {
  try {
    await requireUser();
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const reply = await chat(
      `Extract the concrete action items from the user's note. Today is ${
        /^\d{4}-\d{2}-\d{2}$/.test(today ?? "") ? today : new Date().toISOString().slice(0, 10)
      }. Reply with JSON only: {"tasks":[{"title":string,"dueDate":"YYYY-MM-DD"|null,"priority":"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"|null}]}. ` +
        "Titles are short imperatives. Only include a dueDate the note states or clearly implies. Skip anything already marked done. Return an empty list if there are none.",
      stripTags(text.replace(/<\/(p|li|h\d|div)>/g, "\n")),
      true
    );

    if (reply) {
      let raw: unknown = null;
      try {
        raw = JSON.parse(reply);
      } catch {
        // Falls through to the friendly error below.
      }
      const parsed = extractedSchema.safeParse(raw);
      if (!parsed.success) return { success: false, error: "The AI reply couldn't be read. Try again." };
      return { success: true, usedAi: true, tasks: parsed.data.tasks.map((t) => ({ ...t, suggested: true })) };
    }

    // No API key: block-level text, one line per paragraph or list item.
    const blocks = [...text.matchAll(/<(p|li|h\d)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
      isListItem: m[1] === "li",
      line: stripTags(m[2]).replace(/&nbsp;/g, " ").trim(),
    }));
    const seen = new Set<string>();
    const tasks: ExtractedTask[] = [];
    for (const { isListItem, line } of blocks) {
      const marked = line.match(MARKER);
      const title = (marked ? marked[1] : line).trim().slice(0, 200);
      if (!title || seen.has(title.toLowerCase())) continue;
      if (marked) tasks.push({ title, suggested: true });
      else if (isListItem && title.length > 2) tasks.push({ title, suggested: false });
      else continue;
      seen.add(title.toLowerCase());
    }
    return { success: true, usedAi: false, tasks: tasks.slice(0, 30) };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function aiTranslateAction(
  text: string,
  targetLanguage: string
): Promise<AiResult<"translated">> {
  try {
    await requireUser();
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const translated = await chat(
      `Translate the following text accurately into ${language(targetLanguage)}. Preserve HTML markup if present.`,
      text
    );
    if (translated) return { success: true, translated };

    // There is no honest local fallback for translation — returning the
    // original text under a "Translation" heading would be silently wrong.
    return {
      success: false,
      error: "Translation needs an AI provider. Set OPENAI_API_KEY to enable it.",
    };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}
