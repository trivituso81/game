# Music pipeline

One looping track plays at a time, loaded when its place is entered. A place with no track is silent.

## Files

| File | Holds |
|---|---|
| `audio/music/<id>.mp3` | One track |
| `data/music.json` | `{tag, tracks:{id:{title,file,prompt,len,date}}, use:{...}}`. `tag` is the cache tag for every music file |

`use` maps a place to a track id. Places: `title`, `battle`, `boss`, and `area:<id>` for each area. A boss fight uses `boss` if it has a track, otherwise `battle`.

## Steps on `music.html`

| Step | What happens |
|---|---|
| Setup | Same ElevenLabs key and GitHub token as the other pages |
| GENERATE | ElevenLabs music, instrumental, 10 to 120 seconds. A credit estimate shows first |
| UPLOAD MY OWN MP3 | The free alternative |
| Tap a take | Plays it |
| APPROVE | Commits the track and the list in one commit |
| SAVE WHERE TRACKS PLAY | Commits the place to track assignments |
| PLAY | Plays the file the game plays |
| DELETE | Removes the file, its entry and its assignments in one commit |

## In the game

`musicFor(use)` is called at boot (`title`), on entering an area, at the start of a fight and at its end. If the browser blocks sound before the first tap, the wanted track starts on the first tap or key. Music files are not kept by the service worker.
