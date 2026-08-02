"use server";

type AiResult<K extends string> = { success: true } & Record<K, string> | { success: false; error: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/**
 * Calls the OpenAI chat API. Returns null when no key is configured so callers
 * can decide whether a local fallback is honest for that operation.
 */
async function chat(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
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
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const summary = await chat(
      `You are an executive note assistant. Summarize text concisely in ${targetLanguage}. Output clean HTML without any emojis. Use <strong> for emphasis.`,
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

export async function aiExtractTasksAction(text: string): Promise<AiResult<"tasks">> {
  try {
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const clean = text.replace(/<[^>]*>/g, "\n").trim();
    const lines = clean
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 5);
    const actionLines = lines.slice(0, 5);

    if (actionLines.length === 0) {
      return { success: false, error: "Couldn't find any action items in this note." };
    }

    const itemsHtml = actionLines
      .map(
        (line) =>
          `<li class="flex items-center gap-2 py-1"><input type="checkbox" class="rounded border-zinc-700 bg-zinc-900 accent-indigo-500" /> <span>${escapeHtml(line)}</span></li>`
      )
      .join("");

    const tasksHtml = `
      <div class="my-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/90 text-zinc-300 shadow-lg">
        <div class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-800 pb-1">Extracted Action Items</div>
        <ul class="space-y-1 text-xs text-zinc-300 list-none pl-0 font-normal">${itemsHtml}</ul>
      </div>
    `;

    return { success: true, tasks: tasksHtml };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function aiTranslateAction(
  text: string,
  targetLanguage: string
): Promise<AiResult<"translated">> {
  try {
    if (!text || !text.trim()) return { success: false, error: "No text provided" };

    const translated = await chat(
      `Translate the following text accurately into ${targetLanguage}. Preserve HTML markup if present.`,
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
