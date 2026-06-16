---
title: "Monuments: Building This Skyline"
category: project
date: Jun 2026
read: 7 min
excerpt: Notes on making a blog you wander through instead of scroll.
image: /sample-skyline.svg
---

The brief I gave myself: keep it small. One honest object that does a single thing is worth more than a clever one that does ten things badly.

## Placing the monuments

Each post becomes a monument; each category becomes a district. Districts march back along the **Z axis**, posts spread along **X**:

```ts
categories.forEach((cat, d) => {
  const dz = -d * DZ;                 // districts recede into depth
  posts
    .filter((p) => p.cat === cat.id)
    .forEach((post) => {
      const root = new THREE.Group();
      root.position.set(post.local * DX, 0, dz);
      scene.add(root);
    });
});
```

Constraints make things honest. With one archetype per position there's no menu to design, no settings to regret.

![A low-poly monument rising from its pastel plinth](/sample-skyline.svg "Each monument is one article, lit by a single moving sun")

> There's no feed, no algorithm, no infinite anything — just a handful of quiet structures, and the light resting on them.

Still prototyping. Currently it's a very serious-looking lump of grey resin, which feels about right for this room.
