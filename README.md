# Thistlewick: First Year

A browser 3D action-adventure in the spirit of early-2000s wizard-school games. You're a first-year at a crooked old castle. You learn seven spells, survive seven trials, sit the Final Examinations, and try to win the House Cup.

## Play

Play it in the browser at https://thistlewick.sebastian-murgul.com (built from `main` by GitHub Actions).

Or run it locally:

```bash
npm install
npm run dev        # then open http://localhost:5173
```

Or build it once and serve the build:

```bash
npm run build && npm run preview
```

Play with a mouse and keyboard, a gamepad, or on a phone or tablet held sideways (on-screen controls turn on by themselves). Chrome, Firefox and Safari are all supported.

## Controls

| | Keyboard and mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD or arrow keys | Left stick | Left thumb (a stick appears) |
| Look | Mouse | Right stick | Drag with the right thumb |
| Jump (hold for higher) | Space | A | ⤒ |
| Cast at a glowing rune (hold to charge) | Left click | X or RT | ✦ |
| Talk / open | E | Y or B | ✋ (shows when something's near) |
| Card album | C | Back | ▤ |
| Pause, timetable, errands | Esc | Start | ❚❚ |
| Screenshot | P | | |

You can change the keys in Options.

## Tips

- **Finding your way:** the gold arrow under your house name always points to your next goal. Esc shows your timetable and the errands you've taken on.
- **Charging:** holding the cast button charges a spell. Many puzzles, and some foes, need a charged cast.
- **Students with a ! over their heads** have an errand for you, and they pay in sweets and cards.
- **Snoop's Map** from Crumbleton's Cupboard shows which rooms still hide a card or a secret.
- **Hexlings** (bad fairies) fly high; back off to aim at them. **Sootlings** throw bombs: kick a fizzing bomb back at them with Thwackwort.

Everything in it is original: the characters, the world, the models, the textures and the music, all made in code.
