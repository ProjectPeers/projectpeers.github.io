# PEERS team website

A one-page static site for the PEERS capstone team (Kennesaw State University, IT7993, Fall 2026): plain HTML, CSS
and a little JavaScript. There is no build step, no backend and nothing is loaded from outside, so it also works offline.

Open `index.html` in a browser, or serve the folder (for example `npx serve .`).

| File | What it is |
|---|---|
| `index.html` | The page: hero, About, Our project, Pipeline, Timeline, Showcase, Team, Repository |
| `css/style.css` | Styles, responsive down to phone width |
| `js/main.js` | Phone menu and current-section highlight (the page works without it) |
| `css/pipeline-scene.css`, `js/pipeline-scene.js` | The animated conveyor-belt walkthrough in the Pipeline section (a recreation of the team's Flash video in plain SVG, with Play, Pause and Replay). Without JavaScript it stays hidden and the step cards show the same content |
| `js/vendor/gsap.min.js` | GSAP 3.15.1 (free Standard license), the page's one animation engine: the conveyor-belt timeline, the hero network and the report mock all run on it. A local copy, nothing from a CDN |
| `js/hero-peers.js`, `js/about-report.js`, `css/about-report.css` | The hero's peer-review animation and the About section's report mock |
| `share.jpg` | The picture shown when the site's link is shared (1200 x 630) |
| `audio/pipeline-walkthrough.m4a` | The Flash video's sound track, played with the walkthrough (only after Play, with a Sound on/off button) |
| `favicon.svg` | Tab icon |
