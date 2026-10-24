import type { MetadataRoute } from "next";

/**
 * Makes DailyOS installable to a phone home screen or a desktop dock.
 *
 * `UserSettings.pwaInstalled` has existed in the schema since the start with
 * nothing to set it — this is the missing half. A daily-use tool is worth
 * having one tap away rather than behind a browser tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DailyOS — Personal Productivity OS",
    short_name: "DailyOS",
    description:
      "Notes, tasks, habits, goals, calendar and study tracking in one workspace.",
    // Signed-in users land on Notes; a signed-out one is redirected to login.
    start_url: "/today",
    display: "standalone",
    // Matches the app shell rather than pure black, so the splash screen does
    // not flash a different colour than the page it opens.
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      // The SVG scales to every size a launcher asks for.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      // `maskable` lets Android crop to its own shape without clipping the
      // glyph, since the mark sits on a full-bleed tile.
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "maskable" },
    ],
  };
}
