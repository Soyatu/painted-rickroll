# Nocturne in Blue and Gold: a from-scratch recreation

A second, independent build of the painted Rickroll in this repository: a moving oil painting with its own
synthesised soundtrack, 30 bars at 112 BPM (about 64 s, looping), drawn entirely in code with WebGL2 and WebAudio.

It was written from the brief in the top-level `README.md` and the 15-second generation in
`reference/original-15s.html`, **without opening the original `index.html` or its `src/`**. The stroke renderer and
the impasto lighting follow the approach of that 15-second reference. Everything else, including the four new
worlds, the transitions, the choreography, the physics and the entire score, was written fresh for this version.

## Watch it

Open `recreation/index.html` in a recent Chrome, Edge, Safari or Firefox (it needs WebGL2). It is one
self-contained file and needs no server or network.

- **Click** (or Space/Enter) on the title card to start, with sound.
- **M** mutes and unmutes. **Double-click** toggles fullscreen.
- `?autoplay` starts without the title card (silently, until you click). `?t=12.5` renders a single frame at that time.
- `?w=1920&h=1080` forces the render size (handy for captures).

## Running order

| bars | world | what happens |
|---|---|---|
| 0–3 | river nocturne (after Whistler) | a timber pier and bridge deck, a far bank of lamps, gold sparks falling on every piano note; the quiff rises out of the water like a moon, the eyes peek left and right, a record scratch stops the piano, bubbles, a tom fill |
| 4–9 | brick railway arch | he bursts out of the river on the downbeat; a palette knife scrapes the river away in three passes to reveal the arch; two-step, finger snaps, arm rolls, singing into the mic, a skater's spin |
| 10–13 | pop-art prints | a whip pan lands on a single silkscreen print; each crash doubles the grid (1, 4, 9, 16) and tightens the framing, down to a wall of portraits; freeze, and a wink |
| 14–17 | theatre | red curtains sweep in over the prints and part again; a follow-spot clunks on; his shadow flosses, cartwheels across the backdrop and back, and tips a top hat he isn't wearing (he checks his head) |
| 18–25 | starry night (after Van Gogh) | the stage winds into a whirlpool that becomes the sky; key change; the sky flows along its own streamlines; the mic lasso stirs it into a curl; ta-da |
| 26–29 | gallery | the camera pulls back: a framed painting, a defaced wall label, a visitor in fits of laughter; it glides to the next painting, the nocturne, and pushes in until it fills the frame, which is the first frame of the loop |

## The picture

Every mark is a brush stroke: a Catmull-Rom ribbon whose fragment shader paints bristle tracks, ragged edges,
dry-brush break-up, a palette-knife variant and soft glazes, and writes a paint-height field alongside the colour.
A per-scene pass lights that height as impasto on a canvas weave, under that world's lights and shadow masks.
A final pass does the transitions (the knife, the whip pan, the silkscreen grid, the whirlpool, the framed
paintings in the gallery) and the grade.

The dancer is a posed skeleton (two-bone IK for arms and legs) painted as tubes whose strokes wrap the side facing
the camera, so he holds together from any angle, including the back view in the spin. His coat skirt, belt ends and
microphone cable are a deterministic 120 Hz Verlet simulation, and his quiff and mic ride on springs. His shadows
are silhouettes projected from each light. In the theatre the shadow has its own choreography.

## The score

An original score, synthesised live in WebAudio with no samples, and nothing taken from the song the joke is
named after. It opens with a piano nocturne in F. A record scratch (a synthesised needle dragged over the chord that
was playing) stops it. Then comes 80s synth-pop in D minor (drum machine, octave bass, brass stabs, a vowel-like
"singing" lead), a walking-bass theatre shuffle, and a key change up to E minor for the starry night. That section
has sixteenth-note arpeggios through a ping-pong delay, a brass ta-da and a timpani hit. The piano returns for the
gallery, and a formant-synthesised visitor laughs.

The picture reads the same event list the audio plays. The stage lights pulse on the kicks and snares, the camera
bumps on the kick, the stars flare on the hi-hats and crashes, the prints double on the crashes, the fireworks go
up on the piano melody notes, and the singer's mouth follows the lead line.

## Build

```
node recreation/build.mjs      # concatenates src/*.js into src/template.html -> index.html, then syntax-checks
```

| file | contents |
|---|---|
| `00-core.js` | timing, maths, vectors, colour, noise |
| `10-gl.js` | WebGL2: the stroke shader, the scene (impasto and lighting) pass, the final pass |
| `20-strokes.js` | ribbons, screen and world strokes, dabs, the single-stroke brush alphabet |
| `30-rig.js`, `40-dance.js`, `50-sim.js` | skeleton and IK, choreography (and the shadow's routine), coat/belt/cable physics |
| `60-figure.js` | painting the dancer, and his silhouette |
| `65-camera.js` | cameras, projection, shadow projection |
| `70-sets.js`, `71-noct.js` | the arch; the river nocturne |
| `72-pop.js`, `73-theatre.js`, `74-starry.js`, `76-gallery.js` | the prints, the theatre, the starry night, the gallery and its visitor |
| `75-scenes.js` | scene rendering, cameras and lights per world, the running order and transitions |
| `80-audio.js` | the score, the synth voices, live scheduling, offline rendering |
| `90-main.js` | frame orchestration, the clock, the title card, input, debug hooks |

Debug hooks (no visible UI unless called): `window.__rick.render(t)`, `.sheet([t...], name)` (a contact sheet),
`.zoom(t, x0, y0, x1, y1, name)`, `.audio(b0, b1, name)` (renders the score offline, reports loudness per bar,
optionally saves a WAV), `.frames(fps, from, to)` (numbered frames for making a video file).

`python recreation/tools/serve.py [port] [frames-dir]` serves the page on localhost and saves whatever those hooks
post back, which is how the contact sheets and the video export were made.

## License

MIT, as for the rest of the repository (see [LICENSE](../LICENSE)).
