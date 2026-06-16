/* Placeholder content for Monuments — generated across 4 categories & several years
   to demonstrate how the spatial blog scales. Categories: essay | photo | note | project */
(function () {
  const TITLES = {
    essay: [
      "On Keeping a Slow Notebook", "The Quiet Between Tabs", "Why I Stopped Finishing Books",
      "In Praise of the Unread Shelf", "The Art of Leaving Early", "Notes on Being Bored Well",
      "A Case for Smaller Rooms", "What the Morning Knows", "On Walking the Same Street Twice",
      "The Comfort of Unfinished Things", "Letters I Never Sent", "Against the Tyranny of Notifications",
    ],
    photo: [
      "Fog Over the North Pier", "Rooftops, 6 a.m.", "The Last Warm Window", "Tram Lines in the Rain",
      "A Field Outside Town", "Low Tide, Long Exposure", "Streetlights Before Dawn", "The Empty Lido",
      "Snow on the Allotments", "Harbour, Off Season", "Two Chairs, One Sun", "The Blue Hour, Again",
    ],
    note: [
      "Three Things About Light", "A Tiny Grammar of Walks", "How to Pack for One Night",
      "A Short List of Good Silences", "Names for Shades of Grey", "Coffee, Measured Twice",
      "Rules for Borrowed Books", "Things That Are Better Cold", "A Knot Worth Knowing",
      "Where the Good Benches Are", "On Folding a Map", "Five Ways to Start Again",
    ],
    project: [
      "Monuments: Building This Skyline", "Field Recorder, v2", "A Typeface for Tired Eyes",
      "The One-Button Camera", "Paper Radio", "A Calmer Inbox", "Tide Clock, Mark III",
      "The Slow Search Engine", "A Bookshelf That Forgets", "Pocket Observatory",
      "The Quiet Keyboard", "A Map That Waits",
    ],
  };

  const EXCERPTS = {
    essay: [
      "What changes when you let a thought sit for a week before writing it down.",
      "On the small, unaccounted-for pauses that hold a day together.",
      "Permission to put it down, from someone who needed it badly.",
      "The shelf of things I mean to read is doing more for me unread.",
      "Leaving before the end is its own kind of attention.",
      "Boredom, done properly, is a renewable resource.",
    ],
    photo: [
      "Twenty minutes of nothing, then the whole harbour disappeared.",
      "The city before it remembers to be busy.",
      "One lit window in a street of dark ones, and why it mattered.",
      "Everything reflected twice and nothing quite still.",
      "An ordinary field doing something quietly remarkable with the light.",
      "Held the shutter open and let the sea blur itself smooth.",
    ],
    note: [
      "A short list I keep adding to. Mostly for myself.",
      "Different walks for different problems. A working taxonomy.",
      "Everything that earns a place in a single small bag.",
      "Not all quiet is the same quiet. A field guide.",
      "More greys than the language has names for, so here are some.",
      "Small rules that make borrowed things easier to return.",
    ],
    project: [
      "Notes on making a blog you wander through instead of scroll.",
      "A pocket device for catching sound before it's gone.",
      "Drawing letters that don't shout at you after dark.",
      "One button, thirty seconds of memory, no menu at all.",
      "A radio you fold flat and post to a friend.",
      "Fewer numbers, more calm. An inbox that lets you be.",
    ],
  };

  const PARAS = {
    essay: [
      "I used to capture everything the instant it arrived — voice memos at red lights, half-sentences thumbed into a phone. The collection grew faster than my ability to read it.",
      "So I tried the opposite. A thought has to survive a week before it earns a page. Most don't. The ones that do arrive changed — quieter, rounder, a little embarrassed by their first draft.",
      "Slowness isn't nostalgia. It's a filter you can't buy. The week does the editing for free, and what's left is the part of you that was paying attention the whole time.",
      "There's a version of this that's just procrastination wearing a nice coat. The difference is whether you come back. Attention you return to is patience; attention you abandon is only delay.",
    ],
    photo: [
      "Shot early on a Tuesday when the forecast promised sun and delivered a wall of grey instead. The lights came on automatically, confused by the dark.",
      "There's a particular silence to weather like this — sound arrives late and softened, like the world is being read to you. I stood there until my hands went numb.",
      "I like the hour when the streetlights and the daylight overlap and neither one wins. It never lasts. That's most of why I go.",
    ],
    note: [
      "One: the best of it is almost always behind you when you're looking the wrong way.",
      "Two: the overcast version is not the lesser version, it's a giant softbox somebody else paid for.",
      "Three: if you wait for the perfect one, you'll miss the moment. If you wait for the moment, the perfect one usually shows up.",
      "I keep adding to this when something proves itself. Nothing goes on the list until I've been wrong about it at least once.",
    ],
    project: [
      "The brief I gave myself: keep it small. One honest object that does a single thing is worth more than a clever one that does ten things badly.",
      "Constraints make things honest. With one button there's no menu to design, no settings to regret. The thing says exactly what it does and nothing more.",
      "Still prototyping. Currently it's a very serious-looking lump of grey resin, which feels about right for this room.",
    ],
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const CATS = ["essay", "photo", "note", "project"];

  // deterministic pseudo-random so the skyline is stable across reloads
  let seed = 1337;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  const posts = [];
  let counter = 0;
  CATS.forEach((cat) => {
    TITLES[cat].forEach((title, i) => {
      counter++;
      const year = 2026 - Math.floor(i / 3);           // newest titles 2026, older spread back
      const m = MONTHS[(11 - i + 12) % 12];
      const read = 1 + Math.floor(rnd() * 9);
      const pcount = cat === "photo" ? 2 : 3;
      const body = [];
      for (let k = 0; k < pcount; k++) body.push(PARAS[cat][(i + k) % PARAS[cat].length]);
      posts.push({
        id: slug(title),
        n: String(counter).padStart(2, "0"),
        cat,
        title,
        date: `${m} ${year}`,
        year,
        read: `${read} min`,
        excerpt: EXCERPTS[cat][i % EXCERPTS[cat].length],
        body,
      });
    });
  });

  window.BLOG_DATA = {
    site: { name: "Monuments", tagline: "A quiet skyline of essays, photographs, notes & projects." },
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
    categories: CATS,
    posts,
  };
})();
