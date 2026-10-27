// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Tests for shared/keylayout.js: shortcuts by letter between different layouts.
// Run with: node shared/test/keylayout.js
'use strict';

const assert = require('assert');
const { KeyLayout } = require('../keylayout.js');

// What the helpers say (abridged): US, German (Y and Z swapped), French (AZERTY).
const US = { KeyA: 'a', KeyQ: 'q', KeyW: 'w', KeyY: 'y', KeyZ: 'z', KeyM: 'm', Semicolon: ';', Digit1: '1', KeyC: 'c' };
const DE = { KeyA: 'a', KeyQ: 'q', KeyW: 'w', KeyY: 'z', KeyZ: 'y', KeyM: 'm', Semicolon: 'ö', Digit1: '1', KeyC: 'c' };
const FR = { KeyA: 'q', KeyQ: 'a', KeyW: 'z', KeyZ: 'w', KeyY: 'y', KeyM: ',', Semicolon: 'm', Digit1: '&', KeyC: 'c' };
const RU = { KeyA: 'ф', KeyZ: 'я', KeyC: 'с' };

const layout = (map) => {
  const k = new KeyLayout(() => Promise.resolve({ layout: map }));
  k.set(map);
  return k;
};
const down = (k, code, ch) => k.code(true, code, ch);
const up = (k, code, ch) => k.code(false, code, ch);

(async () => {
  // Sending: the letter a key types here.
  {
    const de = layout(DE);
    assert.deepStrictEqual(de.tag({ t: 'k.kd', code: 'KeyY' }), { t: 'k.kd', code: 'KeyY', ch: 'z' });
    assert.deepStrictEqual(de.tag({ t: 'k.kd', code: 'Semicolon' }), { t: 'k.kd', code: 'Semicolon' }, 'ö: not a–z');
    assert.deepStrictEqual(de.tag({ t: 'k.kd', code: 'ShiftLeft' }), { t: 'k.kd', code: 'ShiftLeft' });
    const ru = layout(RU);
    assert.deepStrictEqual(ru.tag({ t: 'k.kd', code: 'KeyC' }), { t: 'k.kd', code: 'KeyC', tx: 'с' }, 'Cyrillic: no ch, its letter as tx');
    const k = new KeyLayout(() => Promise.reject(new Error('unknown command')));
    await k.refresh();
    assert.deepStrictEqual(k.tag({ t: 'k.kd', code: 'KeyZ' }), { t: 'k.kd', code: 'KeyZ' }, 'an older helper: no letters');
  }

  // A German Mac's Cmd+Z (the Y place, ch z) on a US PC: Ctrl + the Z place.
  {
    const us = layout(US);
    down(us, 'ControlLeft');
    assert.strictEqual(down(us, 'KeyY', 'z'), 'KeyZ', 'undo, not redo');
    assert.strictEqual(down(us, 'KeyY', 'z'), 'KeyZ', 'a repeat: the same key');
    up(us, 'ControlLeft'); // Ctrl up before the letter
    assert.strictEqual(up(us, 'KeyY', 'z'), 'KeyZ', 'its key-up goes to the key that went down');
    // Without Ctrl/Cmd: typing stays in place (the PC's layout types it).
    assert.strictEqual(down(us, 'KeyY', 'z'), 'KeyY');
    assert.strictEqual(up(us, 'KeyY', 'z'), 'KeyY');
  }

  // A US PC's Ctrl+A / Ctrl+Z / Ctrl+W on a French Mac (after the swap: Cmd).
  {
    const fr = layout(FR);
    down(fr, 'MetaLeft');
    assert.strictEqual(down(fr, 'KeyA', 'a'), 'KeyQ', 'select all: the key that types a on AZERTY');
    assert.strictEqual(up(fr, 'KeyA', 'a'), 'KeyQ');
    assert.strictEqual(down(fr, 'KeyZ', 'z'), 'KeyW');
    assert.strictEqual(up(fr, 'KeyZ', 'z'), 'KeyW');
    assert.strictEqual(down(fr, 'KeyM', 'm'), 'Semicolon', 'm is in the ; place');
    up(fr, 'KeyM', 'm');
    assert.strictEqual(down(fr, 'KeyC', 'c'), 'KeyC', 'the same place: unchanged');
    up(fr, 'KeyC', 'c');
    assert.strictEqual(down(fr, 'Digit1'), 'Digit1', 'no letter: unchanged');
    up(fr, 'Digit1');
    up(fr, 'MetaLeft');
  }

  // Same layout both sides: nothing moves. A layout without that letter (Russian): in place.
  {
    const de = layout(DE);
    down(de, 'ControlLeft');
    assert.strictEqual(down(de, 'KeyY', 'z'), 'KeyY');
    up(de, 'KeyY', 'z');
    const ru = layout(RU);
    down(ru, 'ControlLeft');
    assert.strictEqual(down(ru, 'KeyZ', 'z'), 'KeyZ', 'no key types z there: the place');
    up(ru, 'KeyZ', 'z');
    const old = layout(US);
    down(old, 'ControlLeft');
    assert.strictEqual(down(old, 'KeyY'), 'KeyY', 'from an older app (no ch): the place');
  }

  // Another alphabet: a Russian PC (ж in the Semicolon place, ф in the A place) on an English Mac.
  {
    const ru = layout({ ...RU, Semicolon: 'ж', Backquote: 'ё', Period: 'ю', Slash: '.' });
    assert.deepStrictEqual(ru.tag({ t: 'k.kd', code: 'KeyA' }), { t: 'k.kd', code: 'KeyA', tx: 'ф' });
    assert.deepStrictEqual(ru.tag({ t: 'k.ku', code: 'KeyA' }), { t: 'k.ku', code: 'KeyA' }, 'its key-up: nothing more');
    assert.deepStrictEqual(ru.tag({ t: 'k.kd', code: 'Slash' }), { t: 'k.kd', code: 'Slash' }, 'not a letter: the key');
    ru.tag({ t: 'k.kd', code: 'ShiftLeft' });
    assert.deepStrictEqual(ru.tag({ t: 'k.kd', code: 'KeyA' }), { t: 'k.kd', code: 'KeyA', tx: 'Ф' }, 'with Shift: capital');
    ru.tag({ t: 'k.ku', code: 'ShiftLeft' });
    ru.tag({ t: 'k.kd', code: 'ControlLeft' });
    assert.deepStrictEqual(ru.tag({ t: 'k.kd', code: 'KeyA' }), { t: 'k.kd', code: 'KeyA' }, 'Ctrl held: a shortcut, the key');
    ru.tag({ t: 'k.ku', code: 'ControlLeft' });

    const typed = [];
    const us = new KeyLayout(() => Promise.resolve({ layout: US, type: true }), (cmd, a) => typed.push([cmd, a.text]));
    await us.refresh();
    assert.strictEqual(down(us, 'KeyA', undefined), 'KeyA');
    up(us, 'KeyA');
    assert.strictEqual(us.code(true, 'KeyA', undefined, 'ф'), null, 'typed, no key');
    assert.strictEqual(us.code(true, 'KeyA', undefined, 'ф'), null, 'a repeat: typed again');
    assert.strictEqual(us.code(false, 'KeyA'), null, 'its key-up: nothing');
    assert.deepStrictEqual(typed, [['type', 'ф'], ['type', 'ф']]);
    assert.strictEqual(us.code(true, 'Semicolon', undefined, 'ж'), 'Semicolon', 'a key with no Latin letter here: the key');
    up(us, 'Semicolon');
    down(us, 'MetaLeft');
    assert.strictEqual(us.code(true, 'KeyA', undefined, 'ф'), 'KeyA', 'Cmd held: the key');
    up(us, 'KeyA');
    up(us, 'MetaLeft');

    const both = new KeyLayout(() => Promise.resolve({ layout: RU, type: true }), (cmd, a) => typed.push(a.text));
    await both.refresh();
    assert.strictEqual(both.code(true, 'KeyA', undefined, 'ф'), 'KeyA', 'Russian here too: its own layout types it');
    const old = new KeyLayout(() => Promise.resolve({ layout: US }), (cmd, a) => typed.push(a.text));
    await old.refresh();
    assert.strictEqual(old.code(true, 'KeyA', undefined, 'ф'), 'KeyA', 'a helper that can\'t type: the key');
    assert.strictEqual(typed.length, 2);
    us.reset();
  }

  // reset: nothing held.
  {
    const us = layout(US);
    down(us, 'ControlLeft');
    down(us, 'KeyY', 'z');
    us.reset();
    assert.strictEqual(down(us, 'KeyY', 'z'), 'KeyY', 'Ctrl forgotten');
  }

  console.log('keylayout: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
