// ==UserScript==
// @name         GitHub Favourites
// @namespace    https://github.com/ohmyitsdan/github-favourites
// @version      1.0.0
// @description  Adds a Favourites dropdown with your pinned and recent repos next to the repo name in GitHub's header.
// @license      MIT
// @homepageURL  https://github.com/ohmyitsdan/github-favourites
// @supportURL   https://github.com/ohmyitsdan/github-favourites/issues
// @downloadURL  https://raw.githubusercontent.com/ohmyitsdan/github-favourites/main/github-favourites.user.js
// @updateURL    https://raw.githubusercontent.com/ohmyitsdan/github-favourites/main/github-favourites.user.js
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Favourites start empty; pin repos from the dropdown or the userscript manager's menu.
  const DEFAULT_FAVOURITES = [];
  const MAX_RECENTS = 10;
  const ROOT_ID = 'gqr-root';

  // First path segments that are GitHub pages, not owners.
  const RESERVED = new Set([
    'settings', 'notifications', 'orgs', 'organizations', 'explore', 'topics', 'trending',
    'marketplace', 'sponsors', 'login', 'logout', 'signup', 'new', 'search', 'pulls',
    'issues', 'codespaces', 'features', 'about', 'pricing', 'enterprise', 'collections',
    'dashboard', 'apps', 'users', 'stars', 'watching', 'account', 'copilot', 'github-copilot',
  ]);

  // Primer octicons (16px).
  const ICONS = {
    triangleDown: 'm4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z',
    star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
    starFill: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z',
    repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  };

  const getFavourites = () => GM_getValue('favourites', DEFAULT_FAVOURITES);
  const setFavourites = (list) => GM_setValue('favourites', list);
  const getRecents = () => GM_getValue('recents', []);
  const setRecents = (list) => GM_setValue('recents', list);

  function currentRepo() {
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');
    if (meta && meta.content) return meta.content;
    const [owner, repo] = location.pathname.split('/').filter(Boolean);
    if (!owner || !repo || RESERVED.has(owner.toLowerCase())) return null;
    return `${owner}/${repo}`;
  }

  function trackRecent(nwo) {
    if (!nwo) return;
    const recents = getRecents().filter((r) => r.toLowerCase() !== nwo.toLowerCase());
    recents.unshift(nwo);
    setRecents(recents.slice(0, MAX_RECENTS));
  }

  function toggleFavourite(nwo) {
    const favs = getFavourites();
    const i = favs.findIndex((f) => f.toLowerCase() === nwo.toLowerCase());
    if (i >= 0) favs.splice(i, 1);
    else favs.push(nwo);
    setFavourites(favs);
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'octicon');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  function addStyles() {
    if (document.getElementById('gqr-styles')) return;
    const style = document.createElement('style');
    style.id = 'gqr-styles';
    style.textContent = `
      #${ROOT_ID} { position: relative; display: flex; align-items: center; align-self: center; flex-shrink: 0; margin-left: var(--base-size-4, 4px); }
      #${ROOT_ID} .octicon { fill: currentColor; vertical-align: text-bottom; flex-shrink: 0; }
      /* GitHub draws the "/" as ::after on every breadcrumb that isn't last, which the
         repo crumb stops being once we follow it. */
      li:has(+ #${ROOT_ID})::after { display: none !important; }
      li:has(+ #${ROOT_ID}) [class*="separator" i] { display: none !important; }
      /* Mirrors GitHub's header breadcrumb (contextCrumb / repoPickerCrumb). */
      #${ROOT_ID} .gqr-toggle {
        display: inline-flex; align-items: center; gap: var(--base-size-4, 4px);
        padding-block: var(--base-size-4, 4px); padding-inline: var(--base-size-6, 6px);
        line-height: var(--base-size-24, 24px); font-family: inherit;
        font-size: var(--text-body-size-medium, 14px); font-weight: var(--base-text-weight-semibold, 600);
        color: var(--fgColor-default, #f0f6fc); background: transparent; border: 0;
        border-radius: var(--borderRadius-medium, 6px); cursor: pointer; white-space: nowrap;
      }
      #${ROOT_ID} .gqr-toggle:hover, #${ROOT_ID} .gqr-toggle[aria-expanded="true"] { background: var(--control-transparent-bgColor-hover, #656c7633); }
      #${ROOT_ID} .gqr-toggle:active { background: var(--control-transparent-bgColor-active, #656c7640); }
      #${ROOT_ID} .gqr-toggle:focus-visible { outline: 2px solid var(--focus-outlineColor, #1f6feb); outline-offset: -2px; }
      #${ROOT_ID} .gqr-toggle .octicon { color: var(--fgColor-muted, #9198a1); }
      #${ROOT_ID} .gqr-toggle .gqr-arrow { color: var(--fgColor-default, #f0f6fc); }
      #${ROOT_ID} .gqr-menu {
        position: absolute; top: calc(100% + 4px); left: 0; z-index: 100; width: 320px; max-height: 70vh; overflow: auto;
        padding: 8px 0; background: var(--overlay-bgColor, var(--bgColor-default, #151b23));
        border-radius: var(--borderRadius-large, 12px);
        box-shadow: var(--shadow-floating-small, 0 0 0 1px #3d444d, 0 6px 12px -3px #01040966, 0 6px 18px 0 #01040966);
        animation: gqr-in 160ms cubic-bezier(.33, 1, .68, 1);
      }
      @keyframes gqr-in { from { opacity: 0; transform: translateY(-4px); } }
      #${ROOT_ID} .gqr-menu[hidden] { display: none; }
      #${ROOT_ID} .gqr-heading { padding: 6px 16px; font-size: 12px; font-weight: 600; line-height: 20px; color: var(--fgColor-muted, #9198a1); }
      #${ROOT_ID} .gqr-item {
        display: flex; align-items: center; gap: 8px; margin: 0 8px; padding: 6px 8px;
        border-radius: var(--borderRadius-medium, 6px); font-size: 14px; line-height: 20px; color: var(--fgColor-default, #f0f6fc);
      }
      #${ROOT_ID} .gqr-item:hover { background: var(--control-transparent-bgColor-hover, #656c7633); }
      #${ROOT_ID} .gqr-item > a { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; color: inherit; text-decoration: none; }
      #${ROOT_ID} .gqr-item .octicon { color: var(--fgColor-muted, #9198a1); }
      #${ROOT_ID} .gqr-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${ROOT_ID} .gqr-owner { color: var(--fgColor-muted, #9198a1); }
      #${ROOT_ID} .gqr-star {
        display: inline-flex; padding: 4px; margin: -4px 0; border: 0; border-radius: var(--borderRadius-medium, 6px);
        background: none; cursor: pointer;
      }
      #${ROOT_ID} .gqr-star:hover { background: var(--control-transparent-bgColor-hover, #656c7633); }
      #${ROOT_ID} .gqr-star.on .octicon { color: var(--fgColor-attention, #d29922); }
      #${ROOT_ID} .gqr-empty { padding: 6px 16px; font-size: 12px; color: var(--fgColor-muted, #9198a1); }
      #${ROOT_ID} .gqr-divider { margin: 8px 0; border-top: 1px solid var(--borderColor-muted, #3d444db3); }
      #${ROOT_ID} button.gqr-item { width: calc(100% - 16px); border: 0; background: none; cursor: pointer; text-align: left; font: inherit; font-size: 14px; }
      #${ROOT_ID} button.gqr-item:hover { background: var(--control-transparent-bgColor-hover, #656c7633); }
    `;
    document.head.appendChild(style);
  }

  function repoLink(nwo) {
    const [owner, repo] = nwo.split('/');
    const a = document.createElement('a');
    a.href = `/${nwo}`;
    a.title = nwo;
    const name = document.createElement('span');
    name.className = 'gqr-name';
    const ownerSpan = document.createElement('span');
    ownerSpan.className = 'gqr-owner';
    ownerSpan.textContent = `${owner} / `;
    name.append(ownerSpan, document.createTextNode(repo));
    a.append(icon('repo'), name);
    return a;
  }

  function renderMenu(menu) {
    menu.replaceChildren();
    const favs = getFavourites();
    const favSet = new Set(favs.map((f) => f.toLowerCase()));
    const here = currentRepo();

    const section = (title, list, emptyText) => {
      const h = document.createElement('div');
      h.className = 'gqr-heading';
      h.textContent = title;
      menu.appendChild(h);
      if (!list.length) {
        const e = document.createElement('div');
        e.className = 'gqr-empty';
        e.textContent = emptyText;
        menu.appendChild(e);
        return;
      }
      for (const nwo of list) {
        const row = document.createElement('div');
        row.className = 'gqr-item';
        const isFav = favSet.has(nwo.toLowerCase());
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'gqr-star' + (isFav ? ' on' : '');
        star.title = isFav ? 'Remove from favourites' : 'Add to favourites';
        star.setAttribute('aria-label', star.title);
        star.append(icon(isFav ? 'starFill' : 'star'));
        star.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavourite(nwo);
          renderMenu(menu);
        });
        row.append(repoLink(nwo), star);
        menu.appendChild(row);
      }
    };

    section('Favourites', favs, 'Star a repo below to pin it here');
    const recents = getRecents().filter((r) => !favSet.has(r.toLowerCase()));
    section('Recent', recents, 'No other recent repos yet');

    if (here) {
      const div = document.createElement('div');
      div.className = 'gqr-divider';
      const pinned = favSet.has(here.toLowerCase());
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gqr-item';
      const label = document.createElement('span');
      label.className = 'gqr-name';
      label.textContent = pinned ? `Unpin ${here}` : `Pin ${here}`;
      btn.append(icon(pinned ? 'starFill' : 'star'), label);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavourite(here);
        renderMenu(menu);
      });
      menu.append(div, btn);
    }
  }

  function findAnchor() {
    const header = document.querySelector('header.AppHeader, .AppHeader, header[role="banner"], header');
    if (!header) return null;
    const nwo = currentRepo();
    // Sit inside the breadcrumb list, after the repo crumb. Anywhere after the list
    // gets pushed right, as the breadcrumbs stretch to fill the header.
    if (nwo) {
      const link = [...header.querySelectorAll('a[href]')].find(
        (a) => a.getAttribute('href').replace(/\/$/, '').toLowerCase() === `/${nwo.toLowerCase()}`
      );
      if (link) return link.closest('li') || link.parentElement;
    }
    const crumbs = header.querySelectorAll('nav[aria-label="Breadcrumbs" i] li, .AppHeader-context-full li');
    if (crumbs.length) return crumbs[crumbs.length - 1];
    const logo = header.querySelector('a[aria-label*="Homepage" i], a.AppHeader-logo, .AppHeader-logo');
    return logo ? logo.closest('div') || logo : null;
  }

  function build() {
    const root = document.createElement('div');
    root.id = ROOT_ID;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'gqr-toggle';
    toggle.title = 'Favourite and recent repos';
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.textContent = 'Favourites';
    const arrow = icon('triangleDown');
    arrow.classList.add('gqr-arrow');
    toggle.append(icon('star'), label, arrow);

    const menu = document.createElement('div');
    menu.className = 'gqr-menu';
    menu.hidden = true;

    const close = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) {
        renderMenu(menu);
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        close();
      }
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

    root.append(toggle, menu);
    return root;
  }

  let lastPath = null;
  function ensure() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      trackRecent(currentRepo());
      // Re-place on navigation so we follow the header's repo crumb.
      document.getElementById(ROOT_ID)?.remove();
    }
    if (document.getElementById(ROOT_ID)) return;
    const anchor = findAnchor();
    if (!anchor) return;
    addStyles();
    anchor.insertAdjacentElement('afterend', build());
  }

  GM_registerMenuCommand('Edit favourites', () => {
    const input = prompt(
      'Favourite repos (owner/repo), comma-separated.',
      getFavourites().join(', ')
    );
    if (input === null) return;
    setFavourites(input.split(',').map((s) => s.trim()).filter((s) => /^[\w.-]+\/[\w.-]+$/.test(s)));
  });
  GM_registerMenuCommand('Clear recent repos', () => setRecents([]));

  // GitHub navigates with Turbo, so the header is swapped without a page load.
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensure();
    });
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('turbo:load', ensure);
  ensure();
})();
