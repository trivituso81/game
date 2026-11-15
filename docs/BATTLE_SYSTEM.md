# Battle system

The rules as built in `engine/battle.js` (Build 1g.1). Every name and number is a placeholder until Tom answers intake round 2 (battle rules). Do not treat anything here as a design decision.

## Rules

| Topic | Rule as built |
|---|---|
| Party | Four members, HERO 1 to HERO 4 (`PARTY_DEF`), each with its own tint and SPECIAL. Start: 30 HP, 7 attack, 1 defence |
| Enemies | A fight kind is a list of foes (`ENEMY_TYPES`): `monster` is MONSTER A; `pair` is MONSTER A and MONSTER B; `boss` is BOSS. MONSTER A: 20 HP, 4 attack, 10 XP. MONSTER B: 16 HP, 5 attack, 8 XP. BOSS: 60 HP, 7 attack, 1 defence, shield 2, 40 XP |
| Turn order | Each standing hero picks a command in order, then each standing foe acts in order. Then the next round |
| Randomness | None. The same choices give the same fight |
| ATTACK | One monster. Damage = attack plus any RALLY bonus, minus defence, at least 1. With two monsters standing, a target is picked |
| DEFEND | Halves every hit on that hero until their next turn |
| SPECIAL | One per hero, once per fight. HERO 1 BIG HIT: double damage on one monster. HERO 2 SWEEP: a normal hit on every monster. HERO 3 HEAL: one hero recovers 16. HERO 4 RALLY: every standing hero gains 2 attack for the rest of the fight |
| ITEM | One from the bag heals the picked hero for 12. The bag starts with 2 per chapter |
| Shield | Each shield point absorbs one whole hit of any size, then is gone |
| Foe action | Each foe hits one standing hero. Targets rotate: foe i on turn t hits standing hero number (t minus 1 plus i), counted round the standing heroes. Damage = attack times the difficulty factor, minus defence, at least 1, halved if the hero defended |
| Difficulty | EASY x0.5, NORMAL x1, HARD x1.5 on foe damage. Picked on the title |
| Win | Each standing hero gains the total XP of the foes. A level costs 12 times the current level and adds 5 max HP and 1 attack. A fallen hero gets up with 1 HP. A field monster is removed |
| Loss | The party is restored to full HP. A field monster stays. A fight inside a scene starts again |

## Switches for second-layer rules

`SECOND_LAYER` in `battle.js`. All off. They mark where the rules from round 2 will attach.

| Switch | State | What exists behind it |
|---|---|---|
| `weakness` | off | A special does 1.5 times damage to a foe whose `weakTo` is `special` |
| `statusEffects` | off | Nothing yet |
| `combos` | off | Nothing yet |

## Flow in code

| Step | Function |
|---|---|
| Start | `startBattle(kind, opts)`: builds the foes, resets per-fight state, picks boss or battle music, sets mode `battle` |
| Menu | `openMenu(i)`. `battleDir(d)` moves the cursor in the 2 by 2 grid (`COMMAND_GRID`). `battleConfirm()` picks |
| Command | `chooseCommand(cmd)`. A command that needs a target and has a choice sets phase `target`. `targetMove`, `confirmTarget(unit)`, `battleBack()` |
| Run | `runCommand(cmd, target)` queues messages, then `afterPartyAction()` |
| Foes | `foeAct(i)` for each foe in turn, then `afterFoes()` |
| End | `winBattle()` or `loseBattle()` set the result. A press runs `endBattle()`, which returns to play and to the area's music |

Messages wait in `BATTLE.queue`. Each shows for 0.8 seconds or until a press. A message can carry an `apply` step that runs when it shows: it moves the shown HP bar, flashes the figure and starts the floating number, so the screen changes with the words. A skipped message still applies. The step stored by `after()` runs when the queue is empty.

Back out of target picking: BACK on screen, Escape, Backspace or X on a keyboard, button B (1) on a gamepad.

## Screen

`engine/battle-draw.js`, `battleLayout()`. Classic side view: monsters on the left, heroes on the right, each hero a little further right than the one above. The battlefield fills the window. Drawn over it: the message bar at the top, the command menu at the bottom left, party status at the bottom right (portrait: status above a full-width menu). Every panel stays inside the safe area (`game.safe`, read from `env(safe-area-inset-*)`). Sizes scale with the shorter side of the window (`u`), so the screen re-lays out on every resize: fold, unfold, rotate.

| Phase | What a tap does |
|---|---|
| menu | A command cell picks it |
| target | The monster or hero (or a hero's status row) is the target. BACK returns to the menu |
| busy | Skips the message |
| over | Leaves the fight |

In a fight the D-pad and A are hidden (`html.in-battle`), because every choice is a tap. Keys and gamepad still work.

Target size for the screen is Tom's iPhone Duo: unfolded about 890 by 626 points in landscape, folded about 678 by 466. `tools/smoke.py` checks these, a 4:3 window and a tall phone in both orientations.

## Voice in fights

A fight message plays a file only if the Voice Library has one for speaker `battle` and that exact text. Fight messages are never read by speech synthesis.
