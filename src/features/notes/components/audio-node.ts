import { Node, mergeAttributes } from "@tiptap/react";

/**
 * Voice notes. StarterKit has no audio node, so an inserted <audio> was
 * dropped by the schema the moment it went in: recordings never reached the
 * saved note. Only data:audio and https sources are accepted, since a shared
 * note's content can come from someone else.
 */
const SAFE_SRC = /^(data:audio\/[\w.+-]+(;codecs=[\w.,-]+)?;base64,|https:\/\/)/i;

export const AudioNode = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "audio[src]",
        getAttrs: (el) => {
          const src = (el as HTMLElement).getAttribute("src") ?? "";
          return SAFE_SRC.test(src) ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "audio",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        preload: "metadata",
        class: "my-2 w-full max-w-md",
      }),
    ];
  },
});
