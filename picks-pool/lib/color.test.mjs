// Self-check for the color helpers. Run: npm run check
import assert from 'node:assert';
import { clash, tint } from './color.js';

assert.equal(clash('#002a5c', '#002a5c'), true);   // NE at SEA: the same navy
assert.equal(clash('#002244', '#002a5c'), true);   // two navies
assert.equal(clash('#e31837', '#00338d'), false);  // KC at BUF
assert.equal(clash('#aa0000', '#003594'), false);  // SF at LAR
assert.equal(clash('#0b162a', '#204e32'), true);   // CHI at GB: two darks, and on a bar they are the same dark
assert.equal(clash('#0076b6', '#4f2683'), false);  // DET at MIN
assert.equal(clash('', '#1d4ed8'), true);          // no color means the accent, and the accent is blue
assert.equal(clash('', '#e31837'), false);
assert.equal(clash('nonsense', '#1d4ed8'), true);

assert.equal(tint('#002a5c'), '#8c9fb6');                 // navy, halfway to white: steel blue
assert.equal(tint('#000000', 1), '#ffffff');
assert.equal(tint('#ffffff', 0.5), '#ffffff');
assert.equal(tint('bad'), tint('#1d4ed8'));                  // no color: the accent's tint
assert.equal(clash('#002a5c', tint('#002a5c')), false);      // and the tint no longer clashes with the original

console.log('color self-check: all good');
