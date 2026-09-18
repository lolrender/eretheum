# ERETHEUM

ERETHEUM is a simple browser game site built around a big collection of games you can play straight from the browser.

The site is designed to stay clean and fast instead of being packed with ads and unnecessary stuff. Games are loaded into their own pages, while the main site handles things like browsing, favorites, recently played games, stats, themes, and game search.

## What's on the site

- A large library of browser games
- Search and category filters
- Favorites
- Recently played games
- Popular and new game sections
- Smart random game picker
- Local playtime and activity tracking
- Stats and achievements
- Local save backups for supported games
- Multiple dark themes
- A separate play page for each game
- A small animated starfield and custom UI

## How it works

ERETHEUM is a static website, so there isn't a server that needs to run the site.

Games live in the `games/` folder and each game has its own `index.html`. The game library is defined in `system/games.js`.

Most of the site's settings and player data are stored locally in the browser using `localStorage`. Nothing like accounts or online profiles is required.

## Game library

A lot of the games come from [3kh0-lite](https://github.com/3kh0/3kh0-lite). The repository includes a GitHub Action that can sync the selected games into ERETHEUM automatically.

The game list is intentionally curated rather than copying every game from the source library.

## Pages

- `index.html` — homepage
- `games.html` — game library
- `play.html` — game player
- `stats.html` — local stats and achievements
- `settings.html` — themes and site settings
- `system/` — shared site data and scripts
- `games/` — individual games

## Running it

ERETHEUM can be hosted on pretty much any static web host. GitHub Pages works too.

For local development, just serve the repository with a basic local web server rather than opening the HTML files directly.

---

Made for people who just want to open a site and play something.
