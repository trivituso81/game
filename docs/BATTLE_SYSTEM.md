# Battle system

The rules as built in `engine/battle.js`. Every name and number is a placeholder until Tom answers intake round 2 (battle rules). Do not treat anything here as a design decision.

## Rules

| Topic | Rule as built |
|---|---|
| Party | Two members, GREY 1 and GREY 2. Start: 30 HP, 7 attack, 1 defence |
| Enemies | One per fight. MONSTER: 20 HP, 4 attack, 0 defence, 10 XP. BOSS: 36 HP, 6 attack, 1 defence, shield 2, 30 XP |
| Turn order | Each standing member picks a command in order, then the enemy acts. Then the next round |
| Randomness | None. The same choices give the same fight |
| ATTACK | Damage = attack minus enemy defence, at least 1 |
| SPECIAL | Double attack before defence. Once per member per fight |
| BAG | Uses one item: heals the standing member with the lowest HP for 12. The bag starts with 2 per chapter |
| GUARD | Halves the next enemy hit on that member this round |
| Shield | Each shield point absorbs one whole hit of any size, then is gone |
| Enemy action | Hits the first standing member. Damage = attack times the difficulty factor, minus defence, at least 1 |
| Difficulty | EASY x0.5, NORMAL x1, HARD x1.5 on enemy damage. Picked on the title |
| Win | Each standing member gains the enemy's XP. A level costs 12 times the current level and adds 5 max HP and 1 attack. A field monster is removed |
| Loss | The party is restored to full HP. A field monster stays. A fight inside a scene starts again |

## Switches for second-layer rules

`SECOND_LAYER` in `battle.js`. All off. They mark where the rules from round 2 will attach.

| Switch | State | What exists behind it |
|---|---|---|
| `weakness` | off | A special does 1.5 times damage to an enemy whose `weakTo` is `special` |
| `statusEffects` | off | Nothing yet |
| `combos` | off | Nothing yet |

## Flow in code

| Step | Function |
|---|---|
| Start | `startBattle(kind, opts)`: builds the enemy, resets per-fight state, picks boss or battle music, sets mode `battle` |
| Menu | `openMenu(i)`, `battleDir(d)` moves the cursor on the command cross, `battleConfirm()` picks |
| Command | `chooseCommand(cmd)` queues messages and the outcome, then `afterPartyAction()` |
| Enemy | `enemyTurn()`, then `afterEnemy()` |
| End | `winBattle()` or `loseBattle()` set the result. A press runs `endBattle()`, which returns to play and to the area's music |

Messages wait in `BATTLE.queue`. Each shows for 0.8 seconds or until a press. The step stored by `after()` runs when the queue is empty.

## Screen

`engine/battle-draw.js`. The fight fills the window and the D-pad and A overlay it. Parts: turn chips, the enemy with HP bar and shield pips, party cards with HP bars, the message box, the command cross (SPECIAL up, BAG left, GUARD right, ATTACK down), the result box. Taps work on the cross, on a message (skip) and on the result.

## Voice in fights

A fight message plays a file only if the Voice Library has one for speaker `battle` and that exact text. Fight messages are never read by speech synthesis.
