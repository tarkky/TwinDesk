// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Overview (Mac, PC and Linux): the connected device itself, shown once something is connected;
// the device's tile at the top of the sidebar opens it too. Before that, Connection is the start.
//   A phone: its picture, battery and link; Show screen, Ring, Disconnect; what plays there; its
//   quick settings (Wi-Fi, Bluetooth, data, hotspot, torch, Do not disturb, rotation, battery
//   saver), its volume and ringer; the latest notifications (a one-time code gets Copy); its most
//   used apps.
//   A computer: both computers and the link; Ring, Lock, Sleep, its Bluetooth and Do not disturb;
//   its recent notifications while Notifications is on.
//   Both: ReZume's offer, then every feature's two switches (UI.featureCards, from the platform's
//   Connection page script).
// What the other side doesn't report (an older TwinDesk) is left out, not shown as off.
'use strict';

(function () {
  const PHONE_QS = [
    // id, label, icon (20×20 strokes)
    ['wifi', 'Wi-Fi', 'M2.5 7.5a11 11 0 0 1 15 0 M5 10.3a7.3 7.3 0 0 1 10 0 M7.6 13a3.5 3.5 0 0 1 4.8 0 M10 15.8v.1'],
    ['bluetooth', 'Bluetooth', 'M6 6.5l8 7-4 3.5V3l4 3.5-8 7'],
    ['data', 'Mobile data', 'M6.5 16V5 M4 7.5l2.5-2.5L9 7.5 M13.5 4v11 M11 12.5l2.5 2.5 2.5-2.5'],
    ['hotspot', 'Hotspot', 'M10 10.5v.1 M7.3 13a3.8 3.8 0 0 1 0-5.2 M12.7 7.8a3.8 3.8 0 0 1 0 5.2 M4.8 15.4a7.3 7.3 0 0 1 0-10.2 M15.2 5.2a7.3 7.3 0 0 1 0 10.2'],
    ['torch', 'Torch', 'M7 2.5h6v4l-1.5 2.5V17.5h-3V9L7 6.5z'],
    ['dnd', 'Do not disturb', 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M6 10h8'],
    ['rotate', 'Auto-rotate', 'M3.5 10a6.5 6.5 0 0 1 11.3-4.4L16.5 7 M16.5 3v4h-4 M16.5 10a6.5 6.5 0 0 1-11.3 4.4L3.5 13 M3.5 17v-4h4'],
    ['saver', 'Battery saver', 'M3.5 6.5h11v7h-11z M14.5 8.5h2v3h-2 M9 8v4 M7 10h4'],
  ];
  const RINGER = [{ value: 'ring', label: 'Ring' }, { value: 'vibrate', label: 'Vibrate' }, { value: 'silent', label: 'Silent' }];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const glyph = (d) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
    return svg;
  };
  const otpOf = (t) => (window.Otp ? window.Otp.otpOf(t) : '');
  // The PC and Linux say the session in s.link, the Mac in s.client.
  const linked = (s) => !!(s && ((s.link && s.link.state === 'connected') || s.client || (s.phone && s.phone.connected)));
  const viaOf = (s) => (UI.via ? UI.via(s) : s.client && s.client.transport === 'ble' ? 'Bluetooth' : 'Wi-Fi');

  UI.tab({
    id: 'overview',
    order: 0,
    title: 'Overview',
    heading: 'Overview',
    icon: 'overview',
    color: 'linear-gradient(#8e8e93, #636366)',
    desc: '',
    hidden: (s) => !linked(s), // Connection until something is connected
    build(body, page) {
      const { el, api } = UI;
      page.classList.add('device-page');
      const h1 = page.querySelector('h1 span');
      const desc = page.querySelector('.page-head p');
      const doIt = (c) => (api.deviceDo ? api.deviceDo(c) : Promise.resolve());

      // ---- hero ----
      const pic = el('div', { class: 'device phone big' });
      const name = el('div', { class: 'hero-name' });
      const sub = el('div', { class: 'hero-status' });
      const batt = el('div', { class: 'dv-batt' }, [el('div', { class: 'dv-batt-fill' })]);
      const battText = el('span', { class: 'dv-batt-text' });
      const battRow = el('div', { class: 'dv-batt-row' }, [batt, battText]);
      const showBtn = UI.button('Show screen', () => api.phoneScreen(true), 'primary');
      let ringing = false;
      const ringBtn = UI.button('Ring', () => { ringing = !ringing; doIt({ do: ringing ? 'ring' : 'ringStop' }); paint(); });
      const lockBtn = UI.button('Lock', () => doIt({ do: 'lock' }));
      const sleepBtn = UI.button('Sleep', () => doIt({ do: 'sleep' }));
      let wifiOn = false;
      const wifiBtn = UI.button('Use Wi-Fi Direct', () => api.netWifi(!wifiOn));
      const hotspotBtn = UI.button('Use hotspot', () => { api.netWifi('hotspot'); UI.go('connection'); });
      const discBtn = UI.button('Disconnect', () => (UI.isPhone(UI.state) && api.disconnectPhone ? api.disconnectPhone() : api.disconnect()));
      // Each button with its icon (20×20 strokes, the colour of its text).
      const ICO = {
        show: 'M6.5 2.5h7a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z M9 15h2',
        ring: 'M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5h-12z M8.5 16.5a1.5 1.5 0 0 0 3 0',
        lock: 'M5 9h10v8H5z M7 9V6.5a3 3 0 0 1 6 0V9 M10 12v2',
        sleep: 'M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z',
        wifi: 'M2.5 7.5a11 11 0 0 1 15 0 M5 10.3a7.3 7.3 0 0 1 10 0 M7.6 13a3.5 3.5 0 0 1 4.8 0 M10 15.8v.1',
        hotspot: 'M10 10.5v.1 M7.3 13a3.8 3.8 0 0 1 0-5.2 M12.7 7.8a3.8 3.8 0 0 1 0 5.2 M4.8 15.4a7.3 7.3 0 0 1 0-10.2 M15.2 5.2a7.3 7.3 0 0 1 0 10.2',
        disconnect: 'M8.5 11.5l-1 1a3 3 0 0 1-4.2-4.2l2.2-2.2 M11.5 8.5l1-1a3 3 0 0 1 4.2 4.2l-2.2 2.2 M3 3l14 14',
      };
      const iconed = (b, k) => { b.prepend(glyph(ICO[k])); b.classList.add('ico'); return b; };
      iconed(showBtn, 'show'); iconed(ringBtn, 'ring'); iconed(lockBtn, 'lock'); iconed(sleepBtn, 'sleep');
      iconed(wifiBtn, 'wifi'); iconed(hotspotBtn, 'hotspot'); iconed(discBtn, 'disconnect');
      const ringNote = el('div', { class: 'hint dv-ring-note', text: '' });
      const facts = el('dl', { class: 'dv-facts' });
      const hero = el('div', { class: 'card dv-hero' }, [
        pic,
        el('div', { class: 'dv-hero-main' }, [
          name, sub, battRow,
          el('div', { class: 'dv-actions' }, [showBtn, ringBtn, lockBtn, sleepBtn, wifiBtn, hotspotBtn, discBtn]),
          ringNote,
        ]),
        facts,
      ]);
      const notConnected = UI.note('info', '');

      // ---- now playing (shared/ui-nowplaying.js) ----
      const media = UI.nowPlaying ? UI.nowPlaying() : null;
      const mediaCard = el('div', { class: 'card dv-media' }, media ? [media.el] : []);

      // ---- quick settings ----
      const tiles = {};
      const grid = el('div', { class: 'dv-qs' });
      for (const [id, label, icon] of PHONE_QS) {
        const state = el('span', { class: 'dv-qs-state' });
        const b = el('button', { class: 'dv-qs-tile', attrs: { 'aria-pressed': 'false' } }, [glyph(icon), el('span', { class: 'dv-qs-label' }, [el('span', { text: label }), state])]);
        b.onclick = () => {
          const qs = (UI.state && UI.state.phone && UI.state.phone.qs) || {};
          doIt({ do: 'qs', id, on: !qs[id] });
        };
        tiles[id] = { b, state, label };
        grid.append(b);
      }
      // Even rows: every tile in one row when each gets 110 px, else half of them per row.
      const cols = () => {
        const n = [...grid.children].filter((b) => !b.hidden).length || 1;
        const w = grid.clientWidth - 28;
        grid.style.setProperty('--cols', String(w >= n * 110 ? n : Math.ceil(n / 2)));
      };
      new ResizeObserver(cols).observe(grid);
      const vol = UI.slider({ min: 0, max: 100, step: 1, format: (v) => v + '%' }, (v) => doIt({ do: 'volume', stream: 'media', level: v / 100 }));
      const ringer = UI.segmented(RINGER, (v) => doIt({ do: 'ringer', mode: v }));
      const soundRow = UI.row('Media volume', '', [vol, ringer]);
      const qsCard = UI.card('Quick actions', [grid, soundRow], { actions: [UI.button('Customize', () => UI.go('general'), 'small link')] });

      // ---- computer controls ----
      const pcBt = UI.switch((v) => doIt({ do: 'bluetooth', on: v }), { label: 'Bluetooth' });
      const pcDnd = UI.switch((v) => doIt({ do: 'dnd', on: v }), { label: 'Do not disturb' });
      const pcBtRow = UI.row('Bluetooth', '', [pcBt]);
      const pcDndRow = UI.row('Do not disturb', '', [pcDnd]);
      const pcVol = UI.slider({ min: 0, max: 100, step: 1, format: (v) => v + '%' }, (v) => doIt({ do: 'volume', level: v / 100 }));
      const pcVolRow = UI.row('Volume', '', [pcVol]);
      const pcCard = UI.card('Controls', [pcBtRow, pcDndRow, pcVolRow]);

      // ---- latest notifications, most used apps ----
      const notifList = el('div');
      const notifCard = UI.card('Latest notifications', [notifList], { actions: [UI.button('See all', () => UI.go('notifications'), 'small link')] });
      const appsGrid = el('div', { class: 'app-grid dv-apps' });
      const appsCard = UI.card('Most used', [appsGrid], { actions: [UI.button('All apps', () => UI.go('papps'), 'small link')] });
      const lower = el('div', { class: 'dv-two' }, [notifCard, appsCard]);

      const rezume = UI.rezumeCard ? UI.rezumeCard() : null;
      const features = UI.featureCards ? UI.featureCards() : null;
      const featTitle = el('div', { class: 'card-title', text: 'Features' });

      body.append(notConnected, hero, mediaCard, qsCard, pcCard, lower, ...(rezume ? [rezume.el] : []), ...(features ? [featTitle, features.el] : []));

      let notifKey = '';
      let appsKey = '';
      // A button's words, its icon kept.
      const label = (b, t) => { const n = [...b.childNodes].find((x) => x.nodeType === 3); if (n) n.nodeValue = t; else b.append(t); };
      function paint() {
        label(ringBtn, ringing ? 'Stop ringing' : 'Ring');
        ringBtn.classList.toggle('danger', ringing);
        ringNote.textContent = ringing ? 'Rings at full volume, even on silent, until you stop it here or there.' : '';
        ringNote.hidden = !ringing;
      }

      return (s) => {
        const phone = UI.isPhone(s);
        const ph = s.phone || {};
        const c = ph.connected;
        const on = linked(s);
        notConnected.set(on ? '' : 'Nothing is connected. Connect a phone or computer on the Connection page.');
        for (const x of [hero, mediaCard, qsCard, pcCard, lower]) x.hidden = !on;
        if (features) { features.el.hidden = featTitle.hidden = !on; }
        if (!on) return;
        const p = UI.peer(s);
        const info = ph.info || {};
        const ctl = (phone ? ph.ctl : s.peerCtl) || null; // what the other side can do (deviceDo), null: an older TwinDesk

        // hero
        const devName = phone && c ? c.name : (s.peer && s.peer.name) || (s.client && s.client.name) || p.name;
        h1.textContent = devName;
        name.textContent = devName;
        pic.className = 'device big ' + (phone ? 'phone' : UI.osClass(p.os));
        if (phone && UI.phoneWall) pic.style.setProperty('--phone-wall', UI.phoneWall);
        else if (phone && info.colors && info.colors.length) pic.style.setProperty('--phone-wall', `linear-gradient(160deg, ${info.colors.join(', ')}${info.colors.length === 1 ? `, ${info.colors[0]}` : ''})`);
        else pic.style.removeProperty('--phone-wall');
        const rtt = phone ? c && c.rttMs : s.link ? s.link.rtt : s.client && s.client.rttMs;
        const via = phone && c && c.usb ? 'USB' : viaOf(s);
        desc.textContent = phone ? [info.maker && info.model ? `${info.maker} ${info.model}` : info.model, info.release && `Android ${info.release}`].filter(Boolean).join(' · ')
          : { mac: 'Mac', win: 'Windows PC', linux: 'Linux computer' }[p.os] || '';
        sub.textContent = ['Connected', via, rtt != null ? rtt + ' ms' : ''].filter(Boolean).join(' · ');
        const level = phone ? info.battery : s.peerInfo && s.peerInfo.battery;
        battRow.hidden = level == null;
        if (level != null) {
          batt.firstChild.style.width = Math.max(2, Math.min(100, level)) + '%';
          batt.classList.toggle('low', level <= 20);
          battText.textContent = level + '%' + ((phone ? info.charging : s.peerInfo && s.peerInfo.charging) ? ' · Charging' : '');
        }
        const ready = !!(ph.bridge && ph.bridge.state === 'ready');
        showBtn.hidden = !phone;
        showBtn.disabled = !ready;
        showBtn.title = ready ? '' : 'Needs wireless debugging (Connection)';
        const can = (k) => !!(ctl && ctl.can && ctl.can[k]);
        ringBtn.hidden = !can('ring');
        if (ctl && typeof ctl.ringing === 'boolean' && ctl.ringing !== ringing) ringing = ctl.ringing;
        paint();
        lockBtn.hidden = !can('lock');
        sleepBtn.hidden = phone || !can('sleep');
        const n = s.net || {};
        wifiOn = (n.why || []).includes('user') || !!n.linked;
        label(wifiBtn, wifiOn ? 'Back to Bluetooth' : 'Use Wi-Fi Direct');
        const ble = n.transport === 'ble' || !!(s.client && s.client.transport === 'ble'); // the Mac says it on s.client
        wifiBtn.hidden = !(wifiOn || ble);
        hotspotBtn.hidden = !phone || wifiOn || n.state === 'hotspot' || !ble;

        const fact = (k, v) => (v ? [el('dt', { text: k }), el('dd', { text: v })] : []);
        const br = ph.bridge || {};
        const pi = (ctl && ctl.info) || {};
        const control = br.input === 'phone' ? 'Accessibility'
          : br.state === 'ready' ? 'ADB · ready' : br.state === 'connecting' ? 'ADB · connecting' : br.state === 'needsPair' ? 'ADB · not paired' : br.state === 'waitingWifi' ? 'ADB · off' : 'Not set up';
        facts.replaceChildren(...(phone ? [
          ...fact('Storage', pi.storageTotal ? `${pi.storageUsed} of ${pi.storageTotal} GB` : info.storage ? `${info.storage.used} of ${info.storage.total} GB` : ''),
          ...fact('Network', [pi.wifi, pi.cell].filter(Boolean).join(' · ')),
          ...fact('Control', control),
          ...fact('Signal', pi.signal),
          ...fact('Link', via),
        ] : [
          ...fact('System', s.peer && s.peer.osVersion),
          ...fact('Address', (s.paired && s.paired.address) || (s.client && s.client.address)),
          ...fact('Link', via),
        ]));
        facts.hidden = !facts.childElementCount;

        // media
        if (media) media.update(s);
        mediaCard.hidden = !media || media.el.hidden;

        // quick settings: only what the phone reports
        const qs = phone && ph.qs;
        qsCard.hidden = !qs;
        if (qs) {
          for (const [id] of PHONE_QS) {
            const t = tiles[id];
            const has = id in qs;
            t.b.hidden = !has;
            if (!has) continue;
            t.b.classList.toggle('on', !!qs[id]);
            t.b.setAttribute('aria-pressed', String(!!qs[id]));
            const detail = qs.detail && qs.detail[id];
            t.state.textContent = qs[id] ? detail || 'On' : 'Off';
            t.b.title = qs.panel && qs.panel[id] ? 'Opens the setting on the phone' : '';
          }
          cols();
          soundRow.hidden = qs.volume == null;
          if (qs.volume != null) vol.set(Math.round(qs.volume * 100));
          ringer.el.hidden = !qs.ringer;
          if (qs.ringer) ringer.set(qs.ringer);
        }

        // computer controls
        pcCard.hidden = phone || !(can('bluetooth') || can('dnd') || can('volume'));
        if (!pcCard.hidden) {
          pcBtRow.hidden = !can('bluetooth');
          pcBt.set(!!ctl.bluetooth);
          pcDndRow.hidden = !can('dnd');
          pcDnd.set(!!ctl.dnd);
          pcVolRow.hidden = !can('volume');
          if (ctl.volume != null) pcVol.set(Math.round(ctl.volume * 100));
        }

        // latest notifications: a phone's, or a computer's while they're shown here
        const nf = s.notifs || {};
        const history = (nf.history || []).slice(0, 4);
        notifCard.hidden = !history.length || (!phone && !nf.receive);
        const nk = JSON.stringify([history.map((h) => [h.id, h.at]), Object.keys(nf.historyIcons || {}).length]);
        if (nk !== notifKey) {
          notifKey = nk;
          notifList.replaceChildren(...history.map((item) => {
            const text = [item.subtitle, item.body].filter(Boolean).join(' · ');
            const code = otpOf([item.title, item.body].join(' '));
            const copy = code ? UI.button('Copy ' + code, () => api.copyText(code), 'small') : null;
            const r = UI.row([item.appName || item.app, item.title].filter(Boolean).join(' · '), (text || 'Notification') + ' · ' + UI.ago(item.at), [copy]);
            const icon = (nf.historyIcons || {})[item.app];
            if (icon) {
              r.querySelector('.text').prepend(el('img', { class: 'dv-nicon', src: icon, alt: '' }));
              r.classList.add('with-ico');
            }
            return r;
          }));
        }

        // most used apps: the phone's own order (Usage access), else what was opened from here
        const apps = (UI.phoneAssets && UI.phoneAssets.apps) || [];
        const top = (phone && (ph.top || [])).map((id) => apps.find((a) => a.id === id)).filter(Boolean).slice(0, 8);
        appsCard.hidden = !top.length;
        const ak = JSON.stringify([top.map((a) => a.id), ready]);
        if (ak !== appsKey) {
          appsKey = ak;
          appsGrid.replaceChildren(...top.map((a) => {
            const b = el('button', { class: 'app-tile', title: 'Open ' + a.name, disabled: !ready }, [UI.appIcon(a.icon), el('span', { text: a.name })]);
            b.onclick = () => api.phoneOpenApp({ id: a.id, name: a.name });
            return b;
          }));
        }
        lower.classList.toggle('one', notifCard.hidden || appsCard.hidden);
        lower.hidden = notifCard.hidden && appsCard.hidden;

        // General › Overview: what's left out
        const ov = (s.ui && s.ui.overview) || {};
        if (ov.media === false) mediaCard.hidden = true;
        if (ov.qs === false) qsCard.hidden = true;
        if (ov.notifs === false) notifCard.hidden = true;
        if (ov.apps === false) appsCard.hidden = true;
        lower.classList.toggle('one', notifCard.hidden || appsCard.hidden);
        lower.hidden = notifCard.hidden && appsCard.hidden;
        if (features) { features.el.hidden = featTitle.hidden = ov.features === false; features.update(s); }
        if (rezume) rezume.update(s, true);
      };
    },
  });
})();
