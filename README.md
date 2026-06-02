# Noir Reference Board

A static one-page inspiration board for weekly moodboards, reels, static ads, and graphic ideas.

## Deploy With Vercel

This project is ready for Vercel as a static site.

1. Push this repo to GitHub.
2. In Vercel, choose `Add New` -> `Project`.
3. Import the GitHub repo.
4. Use these project settings:

- Framework Preset: `Other`
- Root Directory: repository root
- Build Command: leave empty
- Output Directory: leave empty or `.`

Vercel will publish `index.html` directly. The included `vercel.json` keeps `data/inspiration.json` fresh so weekly updates appear without fighting stale CDN cache.

For a team workflow, connect the repo under your Vercel team account. Each push to `main` publishes production, and pull requests get preview deployments automatically.

## Connect To GitHub

Put this folder in a GitHub repo. The page reads weekly content from:

```txt
data/inspiration.json
```

For a normal GitHub Pages setup, leave `github-config.js` like this:

```js
window.NOIR_BOARD_CONFIG = {
  contentUrl: "data/inspiration.json",
  mediaBaseUrl: ""
};
```

If you want the page to read from a separate public GitHub repo, use the raw GitHub URLs:

```js
window.NOIR_BOARD_CONFIG = {
  contentUrl: "https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/data/inspiration.json",
  mediaBaseUrl: "https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/"
};
```

Do not put a private GitHub token in this file. If the page loads data in the browser, the data source should be public.

## Update The Weekly List

Edit `data/inspiration.json`. Add, remove, or reorder items inside the `items` array.

```json
{
  "title": "New Visual Direction",
  "type": "moodboards",
  "week": "2026 W24",
  "medium": "image board",
  "cue": "Short creative note for the hover preview.",
  "media": "assets/your-weekly-image.jpg"
}
```

Keep `content.js` as the direct-file fallback. When the site is hosted on Vercel, `data/inspiration.json` is the source the page will load.

Use one of these `type` values to keep the filters clean:

- `moodboards`
- `inspiration reels`
- `static ads`
- `graphic`

## Add Project Media

Put permanent images or videos in `assets/`, then point an item `media` field to that file path.

Examples:

- `assets/week-24/lookbook-crop.jpg`
- `assets/week-24/reel-cut.mp4`
- `https://your-cdn.example.com/static-ad.webp`

The `+` button on the page also imports photos and videos into the browser's local archive. That is useful for weekly review, but it is saved only in that browser profile, not into the project folder.

## Open

Open `index.html` in a browser. No build step or server is required.
