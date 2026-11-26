// Plays a few CPU-vs-CPU games for every fighter and fails on any crash or NaN.
const E = require('../src/engine'), AI = require('../src/ai'), { FIGHTERS } = require('../src/fighters');
let games = 0, bad = 0;
for (let i = 0; i < FIGHTERS.length; i++) for (let k = 0; k < 3; k++) {
  const j = (i * 7 + k * 13 + 1) % FIGHTERS.length;
  try {
    const g = E.newGame(FIGHTERS[i], FIGHTERS[j], i * 31 + k + 1);
    while (!g.over) E.resolve(g, AI.chooseActions(g));
    if (g.p.some(p => Number.isNaN(p.hp))) throw new Error('NaN HP');
    games++;
  } catch (e) { bad++; console.error(FIGHTERS[i].id, 'vs', FIGHTERS[j].id, e.message); }
}
console.log(`${games} games ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
