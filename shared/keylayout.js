// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Shortcuts and alphabets across keyboard layouts (one-to-one and Multi-device). Keys go as their
// physical place (`code`), which types what that place types on the other computer's layout: a German
// Mac's Cmd+Z is the key in the Y place, Ctrl+Y (redo) on an English PC. So each key also says the
// letter it types on our layout (`ch`, k.kd / k.ku: from the helper's keyLayout, what each key types
// alone), and while Ctrl or Cmd is held, the other side presses its own key for that letter instead
// (the Z place on the English PC: undo). Without Ctrl or Cmd keys stay where they are (typing follows
// the layout of the computer typed on), as do letters the other layout has no key for and keys from
// an older app (no `ch`).
// Other alphabets: a key that types a letter of another alphabet here (ж on a Russian PC) also says
// it (`tx`, k.kd; not Latin letters like ö or é), and where that key types a Latin letter (an English Mac) it is typed as it is (the
// helper's type) instead of the key: a Russian PC types Russian on an English Mac. Where the other
// side's layout is Russian too, the key goes as it is (its own layout types it). Not with Ctrl, Cmd or
// Alt held (shortcuts), and not where the helper can't type (an older one, Wayland).
'use strict';

const LETTER = /^[a-z]$/;
const LETTER_OF = /^\p{L}$/u;
const LATIN = /\p{Script=Latin}/u;
// A letter of another alphabet (Cyrillic, Greek, Arabic, Hebrew…): Latin ones (ö, é) aren't typed as
// they are, the other side's own layout types its keys as it does for the rest.
const ALPHA = { test: (c) => LETTER_OF.test(c) && !LATIN.test(c) };
const SHORTCUT = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight']);
const SENDER_MODS = /^(Control|Meta|Alt)(Left|Right)$/; // held: no tx (a shortcut, or AltGr's own characters)
const SWITCH_KEY = /^(Shift|Control|Meta|Alt)(Left|Right)$|^(Fn|Space|CapsLock)$/; // up: the layout may have changed
const REFRESH_MS = 400;

// The helper's keyLayout reply → {code: char}, single characters only.
function clean(layout) {
  const out = {};
  if (!layout || typeof layout !== 'object') return out;
  for (const [code, ch] of Object.entries(layout)) {
    if (typeof code === 'string' && code.length <= 32 && typeof ch === 'string' && [...ch].length === 1) out[code] = ch;
  }
  return out;
}

class KeyLayout {
  // request(cmd, args) -> Promise of the helper's reply; send(cmd, args): to the helper, no reply.
  constructor(request, send = () => {}) {
    this.request = request;
    this.send = send;
    this.map = {}; // code -> what it types alone
    this.byChar = new Map(); // a–z -> our code for it
    this.canType = false; // the helper types text (its keyLayout says type: true)
    this.mods = new Set(); // Ctrl / Cmd held (receiving)
    this.held = new Map(); // code pressed -> code injected for it (its key-up goes to the same one); null: typed
    this.shift = new Set(); // Shift held (sending)
    this.outMods = new Set(); // Ctrl / Cmd / Alt held (sending)
    this.timer = null;
  }

  // Ask the helper again (the layout may have changed): on every crossing, either way.
  refresh() {
    return Promise.resolve()
      .then(() => this.request('keyLayout', {}))
      .then((r) => {
        this.set(r && r.layout);
        this.canType = !!(r && r.type === true);
      })
      .catch(() => {}); // an older helper: no letters, keys as they are
  }

  set(layout) {
    this.map = clean(layout);
    this.byChar = new Map();
    for (const [code, ch] of Object.entries(this.map)) {
      if (!LETTER.test(ch)) continue;
      // Two keys for one letter (rare): the one in that letter's own place.
      if (!this.byChar.has(ch) || code === `Key${ch.toUpperCase()}`) this.byChar.set(ch, code);
    }
  }

  // Sending: the key event with the letter it types here, if it types one.
  tag(ev) {
    if (!ev || typeof ev.code !== 'string' || (ev.t !== 'k.kd' && ev.t !== 'k.ku')) return ev;
    const down = ev.t === 'k.kd';
    if (/^Shift/.test(ev.code)) down ? this.shift.add(ev.code) : this.shift.delete(ev.code);
    if (SENDER_MODS.test(ev.code)) down ? this.outMods.add(ev.code) : this.outMods.delete(ev.code);
    const ch = this.map[ev.code];
    if (!ch) return ev;
    if (LETTER.test(ch)) return { ...ev, ch };
    if (down && ALPHA.test(ch) && !this.outMods.size) return { ...ev, tx: this.shift.size ? ch.toUpperCase() : ch };
    return ev;
  }

  // Receiving (after the Ctrl/Cmd swap): the code to press here for this key event, or null when
  // there's nothing to press (its letter was typed as it is).
  code(down, code, ch, tx) {
    if (SHORTCUT.has(code)) {
      if (down) this.mods.add(code);
      else this.mods.delete(code);
    }
    if (!down && SWITCH_KEY.test(code)) this._refreshSoon(); // Alt+Shift, 🌐, Win+Space… switch it here
    if (SHORTCUT.has(code)) return code;
    if (!down) {
      if (!this.held.has(code)) return code;
      const was = this.held.get(code);
      this.held.delete(code);
      return was;
    }
    if (this.held.has(code)) { // held down: the repeats go to the same key (or are typed again)
      const was = this.held.get(code);
      if (was === null) this._type(tx);
      return was;
    }
    if (!this.mods.size && this._typeable(tx) && LETTER.test(this.map[code] || '')) {
      this.held.set(code, null);
      this._type(tx);
      return null;
    }
    let to = code;
    if (this.mods.size && typeof ch === 'string' && LETTER.test(ch)) {
      const here = this.byChar.get(ch);
      if (here) to = here;
    }
    if (to !== code) this.held.set(code, to);
    return to;
  }

  _typeable(tx) {
    return this.canType && typeof tx === 'string' && ALPHA.test(tx);
  }

  _type(tx) {
    if (this._typeable(tx)) this.send('type', { text: tx });
  }

  _refreshSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), REFRESH_MS);
    if (this.timer.unref) this.timer.unref();
  }

  // Driven no more (or the helper released everything): nothing held.
  reset() {
    this.mods.clear();
    this.held.clear();
    this.shift.clear();
    this.outMods.clear();
    clearTimeout(this.timer);
    this.timer = null;
  }
}

module.exports = { KeyLayout, clean };
