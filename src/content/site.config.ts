import type { SiteConfig } from "../types";

/* Which spatial layout to render the blog in:
   - "skyline": the original Monument-Valley flat districts (one row per category)
   - "cube":    a Cabin-in-the-Woods specimen cube — each category is a stacked
                layer of cells; orbit to turn it, click a cell to fly inside.
   - "islands": lone floating islands scattered through space; navigate mainly
                via the Index / search, click an island to fly in. */
export type LayoutKind = "skyline" | "cube" | "islands";
export const LAYOUT: LayoutKind = "islands";

/* ============================================================
   Site configuration — edit this to rebrand the blog.
   Categories define the districts of the 3D world. Each category
   `id` must match the `category:` frontmatter in content/*.md and
   the glyph CSS class in styles.css (.essay / .photo / ...).
   ============================================================ */
export const SITE: SiteConfig = {
  name: "Monuments",
  tagline: "A quiet skyline of essays, photographs, notes & projects.",

  about: {
    title: "About the skyline",
    lead: "Monuments is a quiet corner of the internet — a small skyline you wander instead of scroll.",
    body: [
      "I write essays when an idea won't leave me alone, keep notes when it's too small to be an essay, and take photographs when words get in the way. Now and then something becomes a project.",
      "Each piece is a monument standing in a pastel calm. The skyline is split into four districts — Essays, Photographs, Notes and Projects — and you can pull back to see them all, drop into one to wander, or open the Index to search the whole archive.",
      "There's no feed, no algorithm, no infinite anything. Just a handful of quiet structures, and the light resting on them.",
    ],
    contact: ["hello@monuments.example", "@monuments"],
  },

  categories: [
    {
      id: "essay",
      label: "Essay",
      districtName: "Essays",
      color: 0xd9714f,
      css: "#cf6a4a",
      beacon: "cone",
      palette: [0xe8927c, 0xd98e73, 0xe0a98b, 0xcf7e63, 0xe7b59c],
    },
    {
      id: "photo",
      label: "Photograph",
      districtName: "Photographs",
      color: 0x5e8fb0,
      css: "#5784a6",
      beacon: "icosahedron",
      palette: [0x89a7c4, 0x6fa8a0, 0x7f9fc0, 0x5e9aa8, 0x9ab6cf],
    },
    {
      id: "note",
      label: "Note",
      districtName: "Notes",
      color: 0xcf9a36,
      css: "#bf8e2f",
      beacon: "box",
      palette: [0xe9b44c, 0xe0c27e, 0xceaf6a, 0xd9a94f, 0xeac98a],
    },
    {
      id: "project",
      label: "Project",
      districtName: "Projects",
      color: 0x5e9e8a,
      css: "#4f9482",
      beacon: "octahedron",
      palette: [0x8fb7a6, 0x6fa8a0, 0x7faa8e, 0x5e9e8a, 0xa3c1b2],
    },
  ],
};
