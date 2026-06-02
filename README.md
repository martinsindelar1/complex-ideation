# Noir Reference Board

A static one-page inspiration board for weekly moodboards, reels, static ads, and graphic ideas.

## Connect To GitHub

Put this folder in a GitHub repo. The page is already prepared for GitHub Pages and reads weekly content from:

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

Keep `content.js` as the direct-file fallback. When the site is hosted on GitHub Pages, `data/inspiration.json` is the source the page will load.

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

## Publish On GitHub Pages

1. Create a GitHub repo and upload these files.
2. In GitHub, go to `Settings` -> `Pages`.
3. Set the source to the `main` branch and root folder.
4. Open the Pages URL GitHub gives you.

## Open

Open `index.html` in a browser. No build step or server is required.
