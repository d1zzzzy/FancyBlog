/* Generate filler Markdown posts to stress-test the layouts (esp. the cube).
   Usage:  node scripts/gen-sample-content.mjs [perCategory=24]
   Writes gen-*.md files under each content category and leaves curated
   posts untouched. Remove them later with a glob delete of those files.
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PER = Math.max(1, Number(process.argv[2] || 24));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATS = {
  essay: {
    dir: "essays",
    adj: ["Slow", "Quiet", "Small", "Unfinished", "Borrowed", "Late", "Honest", "Patient", "Ordinary", "Distant", "Gentle", "Stubborn"],
    noun: ["Notebooks", "Mornings", "Rooms", "Walks", "Silences", "Habits", "Letters", "Windows", "Maps", "Shelves", "Hours", "Beginnings"],
    excerpts: [
      "What changes when you let a thought sit for a week before writing it down.",
      "On the small, unaccounted-for pauses that hold a day together.",
      "Permission to put it down, from someone who needed it badly.",
      "Leaving before the end is its own kind of attention.",
    ],
    paras: [
      "I used to capture everything the instant it arrived — voice memos at red lights, half-sentences thumbed into a phone. The collection grew faster than my ability to read it.",
      "So I tried the opposite. A thought has to survive a week before it earns a page. Most don't. The ones that do arrive changed — quieter, rounder, a little embarrassed by their first draft.",
      "Slowness isn't nostalgia. It's a filter you can't buy. The week does the editing for free, and what's left is the part of you that was paying attention the whole time.",
    ],
  },
  photo: {
    dir: "photos",
    adj: ["Foggy", "Empty", "Low", "Last", "Blue", "Grey", "Distant", "Quiet", "Cold", "Bright", "Still", "Soft"],
    noun: ["Piers", "Rooftops", "Windows", "Tramlines", "Fields", "Tides", "Streetlights", "Harbours", "Allotments", "Hours", "Chairs", "Shores"],
    excerpts: [
      "Twenty minutes of nothing, then the whole harbour disappeared.",
      "The city before it remembers to be busy.",
      "One lit window in a street of dark ones, and why it mattered.",
      "Held the shutter open and let the sea blur itself smooth.",
    ],
    paras: [
      "Shot early on a Tuesday when the forecast promised sun and delivered a wall of grey instead. The lights came on automatically, confused by the dark.",
      "There's a particular silence to weather like this — sound arrives late and softened, like the world is being read to you. I stood there until my hands went numb.",
      "I like the hour when the streetlights and the daylight overlap and neither one wins. It never lasts. That's most of why I go.",
    ],
  },
  note: {
    dir: "notes",
    adj: ["Three", "Tiny", "Short", "Good", "Borrowed", "Cold", "Folded", "Five", "Plain", "Spare", "Quiet", "Small"],
    noun: ["Lights", "Walks", "Lists", "Silences", "Greys", "Coffees", "Books", "Knots", "Benches", "Maps", "Rules", "Starts"],
    excerpts: [
      "A short list I keep adding to. Mostly for myself.",
      "Different walks for different problems. A working taxonomy.",
      "Everything that earns a place in a single small bag.",
      "Not all quiet is the same quiet. A field guide.",
    ],
    paras: [
      "One: the best of it is almost always behind you when you're looking the wrong way.",
      "Two: the overcast version is not the lesser version, it's a giant softbox somebody else paid for.",
      "Three: if you wait for the perfect one, you'll miss the moment. If you wait for the moment, the perfect one usually shows up.",
    ],
  },
  project: {
    dir: "projects",
    adj: ["Pocket", "Paper", "Quiet", "One-Button", "Slow", "Calm", "Folding", "Small", "Honest", "Tide", "Field", "Forgetful"],
    noun: ["Recorder", "Radio", "Typeface", "Camera", "Inbox", "Clock", "Engine", "Bookshelf", "Observatory", "Keyboard", "Map", "Compass"],
    excerpts: [
      "A pocket device for catching sound before it's gone.",
      "Drawing letters that don't shout at you after dark.",
      "One button, thirty seconds of memory, no menu at all.",
      "Fewer numbers, more calm. An inbox that lets you be.",
    ],
    paras: [
      "The brief I gave myself: keep it small. One honest object that does a single thing is worth more than a clever one that does ten things badly.",
      "Constraints make things honest. With one button there's no menu to design, no settings to regret. The thing says exactly what it does and nothing more.",
      "Still prototyping. Currently it's a very serious-looking lump of grey resin, which feels about right for this room.",
    ],
  },
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let total = 0;
for (const [cat, cfg] of Object.entries(CATS)) {
  mkdirSync(resolve(ROOT, "content", cfg.dir), { recursive: true });
  const seen = new Set();
  for (let n = 0; n < PER; n++) {
    const adj = cfg.adj[n % cfg.adj.length];
    const noun = cfg.noun[(n * 5 + 3) % cfg.noun.length];
    let title = `${adj} ${noun}`;
    while (seen.has(title)) title += "."; // keep titles unique
    seen.add(title);

    const year = 2026 - Math.floor(n / 6); // 6 per year, newest first
    const month = MONTHS[(11 - n + n * 7) % 12];
    const read = 1 + ((n * 3) % 9);
    const excerpt = cfg.excerpts[n % cfg.excerpts.length];
    const body = cfg.paras.map((_, k) => cfg.paras[(n + k) % cfg.paras.length]).join("\n\n");

    const id = `gen-${cat}-${String(n + 1).padStart(2, "0")}-${slug(`${adj}-${noun}`)}`;
    const md = `---\ntitle: ${title}\ncategory: ${cat}\ndate: ${month} ${year}\nread: ${read} min\nexcerpt: ${excerpt}\n---\n\n${body}\n`;
    writeFileSync(resolve(ROOT, "content", cfg.dir, `${id}.md`), md);
    total++;
  }
}
console.log(`Generated ${total} filler posts (${PER} per category).`);
