import type { Post } from "../types";

/* ============================================================
   Tiny hash router so articles are shareable / bookmarkable and the
   browser back/forward buttons work. URL shape: #/<category>/<id>.
   The engine stays the source of truth — the router only translates
   between the URL and focus.
   ============================================================ */

export interface RouterOptions {
  posts: Post[];
  siteName: string;
  /** open a post (focus + reader) */
  onPost: (post: Post) => void;
  /** no post in the URL — return home */
  onHome: () => void;
}

export interface Router {
  /** read the current URL and start listening for back/forward */
  start(): void;
  /** reflect the focused post (or null) in the URL + document title */
  setPost(post: Post | null): void;
}

export function createRouter(o: RouterOptions): Router {
  const byId = new Map(o.posts.map((p) => [p.id, p]));
  const homeTitle = `${o.siteName} — a blog you wander through`;
  let suppress = false; // ignore the hashchange our own setPost triggers

  function currentPost(): Post | null {
    const raw = location.hash.replace(/^#\/?/, "");
    if (!raw) return null;
    const id = decodeURIComponent(raw.split("/").pop() || "");
    return byId.get(id) ?? null;
  }

  function apply(): void {
    const post = currentPost();
    if (post) o.onPost(post);
    else o.onHome();
  }

  return {
    start() {
      window.addEventListener("hashchange", () => {
        if (suppress) {
          suppress = false;
          return;
        }
        apply();
      });
      apply();
    },

    setPost(post: Post | null) {
      if (post) {
        document.title = `${post.title} — ${o.siteName}`;
        const target = `#/${post.cat}/${post.id}`;
        if (location.hash !== target) {
          suppress = true;
          location.hash = target;
        }
      } else {
        document.title = homeTitle;
        if (location.hash) {
          // drop the hash without a hashchange event (no suppress needed)
          history.replaceState(null, "", location.pathname + location.search);
        }
      }
    },
  };
}
