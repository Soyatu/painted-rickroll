# Nocturne in Blue and Gold: the painted Rickroll

A moving oil painting with its own soundtrack, about a minute long (30 bars at 112 BPM, ≈64 s, looping).
It grew out of the 15-second "painted Rickroll" generation (kept in `reference/original-15s.html`).

It is a bait-and-switch, like the joke it is named after. It opens as a quiet Whistler nocturne with a
piano. Then a quiff rises out of the river like a moon, a record scratches, and he comes out of the water
on the downbeat and dances through four painted worlds:

| bars | world | what happens |
|---|---|---|
| 0–3 | river nocturne (after Whistler) | calm piano; eyes peek over the waterline; scratch; drum fill; he bursts out |
| 4–9 | brick railway arch (the original set) | a palette knife scrapes the river away; two-step, snaps, arm rolls, singing, a skater's spin |
| 10–13 | pop-art prints (after Warhol) | a whip-pan into a print; the grid doubles on every crash: 1, 4, 9, 16 prints; freeze and wink |
| 14–17 | theatre | curtains, follow-spot; his shadow flosses, does a cartwheel and tips a top hat he isn't wearing |
| 18–25 | starry night (after Van Gogh) | a whirlpool of brushstrokes, key change, the sky flows; the mic lasso stirs it; ta-da |
| 26–29 | gallery | the camera pulls back: a framed painting, a defaced wall label, a laughing visitor, and a return to the start |

Everything is painted by code: every mark is a textured brush stroke, lit as impasto. The music is an original
score synthesised live in WebAudio, with no samples and nothing from the song the joke is about. The lights,
stars and camera follow the actual drum hits in that score.

## Watch it

Open `index.html` in a recent Chrome, Safari or Firefox (it needs WebGL2). No server or network is needed.

- **Click** (or Space/Enter) on the title card to start, with sound.
- **M** mutes and unmutes. **Double-click** toggles fullscreen.
- `?autoplay` starts without the title card (silently). `?t=12.5` renders a single frame at that time.

## Build

The page is one self-contained file built from `src/`:

```
node tools/build.mjs      # concatenates src/*.js into src/template.html -> index.html, then syntax-checks
```

| file | contents |
|---|---|
| `00-core.js` | timing, maths |
| `10-gl.js` | WebGL2 stroke renderer, composite (lighting, impasto, pop-art prints, gallery frame, river line) |
| `20-strokes.js` | brush strokes, lettering |
| `30-rig.js`, `40-dance.js`, `50-sim.js` | skeleton, choreography (and the shadow's own routine), coat/cable physics |
| `60-figure.js` | painting the dancer (front, back, silhouette) |
| `65-camera.js`, `70-sets.js`, `71-sets2.js` | cameras; the nocturne, arch, pop ground, theatre and starry night sets |
| `75-scenes.js` | running order, camera keys, lights, moving scenery, transitions |
| `76-overlays.js` | title card, gallery wall |
| `80-audio.js` | the synth instruments, the score, the hit lists the picture syncs to |
| `90-main.js` | frame orchestration, clock, input |

Debug hooks (no visible UI unless called): `window.__rick.render(t)`, `.sheet([t...])` (a contact sheet),
`.zoom(t, x0, y0, x1, y1)`, `.audio(b0, b1)` (renders the score offline and reports loudness per bar).

## The prompt

The piece answers a single prompt, given in [PROMPT.md](PROMPT.md) along with the original 15-second prompt.

## How it was made

Written by Claude (Opus 5.5) in Claude Code and directed by Peter Gostev. It extends a 15-second
generation from the original prompt, which is kept in `reference/original-15s.html`.

## License

MIT, see [LICENSE](LICENSE).
