# Voice pipeline

Voice is real audio, one file per line, loaded only when a scene or fight plays that line. Nothing is fetched before the title. All voices are generated through the ElevenLabs API on the Voice Library page.

## Files

| File | Holds |
|---|---|
| `audio/voice/<id>.mp3` | One line. `<id>` is the speaker slug plus a hash of the exact text |
| `data/voice-lines.json` | `{tag, lines:{id:{who,text,where,file,date}}}`. `where` is `scene` or `battle`. `tag` is the cache tag for every voice file |
| `data/voice-slots.json` | The slot plan: `{cap:30, budget, speakers:{who:{name,voiceId,kind}}}`. `kind` is `premade` or `custom` |

## Slot plan

The ElevenLabs account is shared with the first game and capped at 30 custom voices. Premade library voices do not count. `budget` is how many custom voices this game may use. It is 2 until the cast round, and Claude raises it in `data/voice-slots.json` after Tom decides the cast. The page shows the account's live count and refuses to save a plan over the budget. No voice is planned without a slot.

## Steps on `voices.html`

| Step | What happens |
|---|---|
| Setup | ElevenLabs key (`ffiv-el-key`) and model (`ffiv-el-model`, default `eleven_multilingual_v2`), kept on the phone. The GitHub token comes from the Art Library setup |
| LOAD MY VOICES | Reads the account's voices, fills the pickers, shows the custom-voice count against 30 |
| SAVE VOICE PLAN | Commits the speaker to voice plan |
| Pick a line | The page lists every `say` step in every scene. ADD FIGHT LINE adds a fixed fight message for speaker `battle` |
| GENERATE | Text to speech for that line. Tap a take to hear it. Takes live in memory and are lost on reload |
| APPROVE | Commits the mp3 and the list in one commit, and deletes a replaced file in the same commit |
| PURGE UNUSED | Removes files for lines no scene plays and files the list does not name, in one commit |

## In the game

- A scene line with a file plays the file. With no file it is read by the phone's speech synthesis, so a scene is never silent while lines are being made.
- A fight line plays only if it has a file.
- Changing a line's text changes its id. The old file is then unused: run PURGE UNUSED in the same sitting.

## Rules

- No voice line that nothing plays.
- A replaced file goes in the same commit as its replacement.
- Voice files are not kept by the service worker. They need a network the first time each is played.
