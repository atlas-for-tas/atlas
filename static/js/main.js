(function () {
  'use strict';

  var SITE = window.SITE;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- helpers

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  // `file` is relative to static/results without extension, e.g. 'ours/crackers_animated'.
  function video(file, opts) {
    opts = opts || {};
    var v = el('video', {
      controls: '', muted: '', loop: '', playsinline: '',
      preload: opts.preload || 'metadata',
    });
    v.muted = true; // the attribute alone is not enough for autoplay in some browsers
    v.appendChild(el('source', { src: 'static/results/' + file + '.mp4', type: 'video/mp4' }));
    return v;
  }

  function videoIdLabel(id, cls) {
    return el('h3', { class: cls, html: '<strong>Video ID:</strong> ' + id });
  }

  // ---------------------------------------------------- synchronized playback

  // A group is a set of videos that play, pause, and seek together and start
  // automatically when scrolled into view.
  var groups = [];
  var DRIFT = 0.25; // seconds

  function makeGroup(videos, all) {
    var g = { videos: videos, visible: false, userPaused: false };
    all = all || videos;
    g.show = function () { g.videos.forEach(safePlay); };
    g.hide = function () { all.forEach(function (v) { v.pause(); }); };
    groups.push(g);

    all.forEach(function (v) {
      v._group = g;
      // An element waiting off-screen as a buffer is not part of the group until it is swapped in.
      function current() { return g.videos.indexOf(v) >= 0; }

      v.addEventListener('play', function () {
        if (!current()) return;
        g.userPaused = false;
        g.videos.forEach(function (o) { if (o !== v && o.paused) safePlay(o); });
      });
      v.addEventListener('pause', function () {
        if (!current()) return;
        // Pauses triggered while visible come from the viewer, not from scrolling away.
        if (g.visible) g.userPaused = true;
        g.videos.forEach(function (o) { if (o !== v && !o.paused) o.pause(); });
      });
      v.addEventListener('seeked', function () {
        if (!current()) return;
        g.videos.forEach(function (o) {
          if (o !== v && Math.abs(o.currentTime - v.currentTime) > DRIFT) o.currentTime = v.currentTime;
        });
      });
      v.addEventListener('ratechange', function () {
        if (!current()) return;
        g.videos.forEach(function (o) { if (o.playbackRate !== v.playbackRate) o.playbackRate = v.playbackRate; });
      });
      // Keep followers locked to the first video.
      v.addEventListener('timeupdate', function () {
        var leader = g.videos[0];
        if (v !== leader || g.videos.length < 2 || leader.paused || leader.seeking) return;
        g.videos.forEach(function (o) {
          if (o !== leader && !o.seeking && o.readyState >= 2 &&
              Math.abs(o.currentTime - leader.currentTime) > DRIFT) {
            o.currentTime = leader.currentTime;
          }
        });
      });
    });
    return g;
  }

  // Videos that take turns: each plays to the end, then the next one starts,
  // looping back to the first. Waiting videos are dimmed; playing one makes it current.
  // `onChange(i)` (optional) is called whenever the current video changes. With `stopAtEnd`, a video
  // that finishes stays on its last frame instead of handing over to the next one, and is not
  // replayed on scrolling back; selecting a video (`g.select`) plays it again.
  function makeSequence(videos, onChange, stopAtEnd) {
    var g = { videos: videos, visible: false, userPaused: false, current: 0 };
    groups.push(g);

    function setCurrent(i) {
      g.current = i;
      videos.forEach(function (o, j) { o.classList.toggle('is-waiting', j !== i); });
      if (onChange) onChange(i);
    }
    g.show = function () { safePlay(videos[g.current]); };
    g.hide = function () { videos.forEach(function (v) { v.pause(); }); };
    // Jump to video i from its start, e.g. when its tab is clicked.
    g.select = function (i) {
      if (i !== g.current) videos[g.current].pause();
      // A clip already at its start needs no seek, and it is the seek that drops its frame.
      if (videos[i].currentTime > 0.05) videos[i].currentTime = 0;
      setCurrent(i);
      g.userPaused = false;
      safePlay(videos[i]);
    };

    videos.forEach(function (v, i) {
      v._group = g;
      v.loop = false;
      v.removeAttribute('loop');
      v.addEventListener('play', function () {
        g.userPaused = false;
        if (i === g.current) return;
        var previous = videos[g.current];
        setCurrent(i);
        previous.pause();
      });
      v.addEventListener('pause', function () {
        // Ignore the pause that fires at the end of playback, and pauses of a video that is no longer current.
        if (g.visible && i === g.current && !v.ended) g.userPaused = true;
      });
      v.addEventListener('ended', function () {
        if (stopAtEnd) {
          g.userPaused = true;
          return;
        }
        var next = videos[(i + 1) % videos.length];
        next.currentTime = 0;
        setCurrent((i + 1) % videos.length);
        if (g.visible) safePlay(next);
      });
    });
    setCurrent(0);
    return g;
  }

  function safePlay(v) {
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked: viewer can press play */ });
  }

  function observeGroups() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var g = entry.target._group;
        var wasVisible = g.visible;
        g.visible = entry.isIntersecting;
        if (g.visible && !wasVisible) {
          if (!reduceMotion && !g.userPaused) g.show();
        } else if (!g.visible && wasVisible) {
          g.hide();
        }
      });
    }, { threshold: 0.35 });
    // Observing the first video is enough: a group's videos sit side by side. A group whose
    // videos are shown one at a time sets `target` to their container instead.
    groups.forEach(function (g) {
      var target = g.target || g.videos[0];
      target._group = g;
      io.observe(target);
    });
  }

  // ------------------------------------------------------------------- tabs

  var stickyBars = [];

  // A pinned bar gets a shadow so it stays distinct from the videos scrolling under it.
  function trackStickyBars() {
    function update() {
      stickyBars.forEach(function (b) {
        b.bar.classList.toggle('is-stuck', b.container.getBoundingClientRect().top < 0);
      });
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // `extra` (optional) is shown under the tab buttons and sticks with them.
  function tabs(container, name, renderPanel, extra) {
    var list = el('div', { class: 'tab-list', role: 'tablist', 'aria-label': name + ' categories' });
    var buttons = [];
    var panels = [];

    SITE.categories.forEach(function (cat, i) {
      var tabId = name + '-tab-' + cat.key;
      var panelId = name + '-panel-' + cat.key;
      var btn = el('button', {
        type: 'button', role: 'tab', id: tabId, 'aria-controls': panelId,
        'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
        text: cat.label,
      });
      var panel = el('div', { class: 'tab-panel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId });
      if (i !== 0) panel.hidden = true;
      renderPanel(panel, SITE.examples.filter(function (ex) { return ex.category === cat.key; }));
      buttons.push(btn);
      panels.push(panel);
      list.appendChild(btn);
    });

    function select(i, focus) {
      buttons.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
        panels[j].hidden = j !== i;
      });
      if (focus) buttons[i].focus();
      // If the viewer has scrolled into the section, start the new category from its top.
      if (container.getBoundingClientRect().top < 0) container.scrollIntoView({ behavior: 'instant' });
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var n = buttons.length;
        if (e.key === 'ArrowRight') select((i + 1) % n, true);
        else if (e.key === 'ArrowLeft') select((i + n - 1) % n, true);
        else if (e.key === 'Home') select(0, true);
        else if (e.key === 'End') select(n - 1, true);
        else return;
        e.preventDefault();
      });
    });

    var bar = el('div', { class: 'tab-bar' }, [list, extra]);
    container.appendChild(bar);
    stickyBars.push({ bar: bar, container: container });
    panels.forEach(function (p) { container.appendChild(p); });
  }

  // --------------------------------------------------------------- sections

  function renderHero() {
    var hero = document.getElementById('hero');
    hero.appendChild(el('h1', { class: 'title is-1 publication-title', text: SITE.title }));

    if (SITE.anonymous) return;

    // Authors and affiliations use the Nerfies/TubeletGraph markup: inline `author-block`s with the
    // comma inside each block, separated by a space as in their hand-written HTML.
    function blockLine(items) {
      var line = el('div', { class: 'is-size-4 publication-authors' });
      items.forEach(function (children, i) {
        if (i) line.appendChild(document.createTextNode(' '));
        if (i < items.length - 1) children = children.concat(document.createTextNode(','));
        line.appendChild(el('span', { class: 'author-block' }, children));
      });
      return line;
    }
    if (SITE.authors.length) {
      hero.appendChild(blockLine(SITE.authors.map(function (a) {
        var name = a.url ? el('a', { href: a.url, text: a.name }) : document.createTextNode(a.name);
        var sup = (a.affiliations || []).length ? el('sup', { text: a.affiliations.join(',') }) : null;
        return [name, sup];
      })));
    }
    if (SITE.affiliations.length) {
      // A single shared affiliation needs no numbering.
      var numbered = SITE.affiliations.length > 1;
      hero.appendChild(blockLine(SITE.affiliations.map(function (aff, i) {
        return [numbered ? el('sup', { text: String(i + 1) }) : null, document.createTextNode(aff)];
      })));
    }
    if (SITE.links.length) {
      // Same markup as Nerfies-style project pages (e.g. TubeletGraph): Bulma rounded dark
      // buttons with an icon, separated by a space as in their hand-written HTML.
      var blocks = [];
      SITE.links.forEach(function (l, i) {
        var inner = [
          l.icon ? el('span', { class: 'icon' }, [el('i', { class: l.icon, 'aria-hidden': 'true' })]) : null,
          el('span', { text: l.label }),
        ];
        var button = l.url
          ? el('a', { class: 'external-link button is-normal is-rounded is-dark', href: l.url }, inner)
          : el('span', { class: 'button is-normal is-rounded is-dark is-unlinked', 'aria-disabled': 'true' }, inner);
        if (i) blocks.push(document.createTextNode(' '));
        blocks.push(el('span', { class: 'link-block' }, [button]));
      });
      hero.appendChild(el('div', { class: 'column has-text-centered' }, [
        el('div', { class: 'publication-links' }, blocks),
      ]));
    }
    if (SITE.abstract) {
      document.getElementById('abstract-text').innerHTML = SITE.abstract;
      document.getElementById('abstract').hidden = false;
    }
    if (SITE.bibtex) {
      document.getElementById('bibtex-text').textContent = SITE.bibtex.trim();
      document.getElementById('bibtex').hidden = false;
    }
  }

  function renderTeaser() {
    var box = document.getElementById('teaser-content');
    var v = video(SITE.teaser.video, { preload: 'auto' });
    v.className = 'teaser-video';
    box.appendChild(v);
    box.appendChild(el('p', { class: 'teaser-copy', html: SITE.teaser.text }));
    makeGroup([v]);
  }

  function renderMethod() {
    if (!SITE.method) return;
    document.getElementById('method-intro').appendChild(el('p', { html: SITE.method.intro }));
    var box = document.getElementById('method-steps');
    box.appendChild(videoIdLabel(SITE.method.id, 'comparison-id'));
    SITE.method.steps.forEach(function (step) {
      // A step shows one video, or several (`videos`) that play one after another: one above the
      // other, or one at a time behind tabs (`layout: 'tabs'`, with a tab label per video in `labels`).
      // The cases behind tabs are swapped on a click, so they are buffered up front: a clip
      // that only starts loading on the switch shows a blank frame first.
      var videos = (step.videos || [step.video]).map(function (file) {
        return video(file, step.layout === 'tabs' ? { preload: 'auto' } : null);
      });
      var media;
      if (videos.length === 1) {
        media = videos[0];
        makeGroup(videos);
      } else if (step.layout === 'tabs') {
        var buttons = step.labels.map(function (label) {
          return el('button', { type: 'button', role: 'tab', text: label });
        });
        var player = el('div', { class: 'method-carousel' }, videos);
        // Each case plays to its own end and stops there; the tabs are how you move on.
        var g = makeSequence(videos, function (i) {
          buttons.forEach(function (b, j) {
            b.setAttribute('aria-selected', j === i ? 'true' : 'false');
            b.tabIndex = j === i ? 0 : -1;
          });
        }, true);
        g.target = player;
        // Same interaction as the Qualitative Results tabs: click, or arrow / Home / End keys.
        buttons.forEach(function (b, i) {
          b.addEventListener('click', function () { g.select(i); });
          b.addEventListener('keydown', function (e) {
            var n = buttons.length;
            var j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n
              : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
            if (j < 0) return;
            e.preventDefault();
            g.select(j);
            buttons[j].focus();
          });
        });
        media = el('div', {}, [
          el('div', { class: 'tab-list method-case-tabs', role: 'tablist' }, buttons),
          player,
        ]);
      } else {
        media = el('div', { class: 'method-stack' }, videos);
        makeSequence(videos);
      }
      box.appendChild(el('figure', { class: 'method-step' }, [
        el('h3', { class: 'method-step-title', text: step.title }),
        media,
        el('figcaption', { class: 'method-caption', html: step.text }),
      ]));
    });
    document.getElementById('method').hidden = false;
  }

  // One example on stage with a thumbnail strip to pick another. Showing every example at full
  // size runs a tab to several screens, and these videos are too detailed to shrink into a grid.
  // `opts.videos` are swapped together by `opts.srcFor(index, example)`.
  function stagePicker(panel, examples, opts) {
    var videos = opts.videos;

    function thumb(ex) { return 'static/results/thumbs/' + ex.id + '.jpg'; }
    if (opts.poster) videos[0].poster = thumb(examples[0]);

    var shots = examples.map(function (ex, i) {
      return el('button', {
        type: 'button', role: 'tab',
        'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
      }, [
        el('img', { src: thumb(ex), alt: '', loading: 'lazy' }),
        el('span', { text: ex.id }),
      ]);
    });

    // Each slot keeps a spare element off-screen. The next example loads into the spare and only
    // takes over once it can play, so the one on screen never blanks or stalls mid-switch.
    var fronts = videos.slice();
    var backs = videos.map(function (v) {
      var spare = v.cloneNode(true);
      spare.muted = true;
      spare.hidden = true;
      v.parentNode.insertBefore(spare, v.nextSibling);
      return spare;
    });
    var group = makeGroup(fronts, fronts.concat(backs));
    var pending = 0;

    function select(i, focus) {
      var ex = examples[i];
      shots.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        b.tabIndex = j === i ? 0 : -1;
      });
      if (focus) shots[i].focus();
      shots[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });

      var turn = ++pending;
      var waiting = backs.length;
      backs.forEach(function (spare, k) {
        spare.querySelector('source').src = opts.srcFor(k, ex);
        spare.load();
        spare.addEventListener('canplay', function () {
          // A later click supersedes this one.
          if (turn !== pending || --waiting > 0) return;
          for (var j = 0; j < fronts.length; j++) {
            var shown = fronts[j], spare2 = backs[j];
            shown.pause();
            shown.hidden = true;
            spare2.hidden = false;
            spare2.currentTime = 0;
            fronts[j] = spare2;
            backs[j] = shown;
          }
          group.videos = fronts;
          group.userPaused = false;
          if (!reduceMotion) fronts.forEach(safePlay);
        }, { once: true });
      });
    }

    shots.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var n = shots.length;
        var j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n
          : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if (j < 0) return;
        e.preventDefault();
        select(j, true);
      });
    });

    // The strip is one row; categories with more examples than fit scroll with the arrows.
    var strip = el('div', { class: 'filmstrip', role: 'tablist', 'aria-label': 'examples' }, shots);
    var prev = el('button', { type: 'button', class: 'strip-arrow', 'aria-label': 'Previous examples', html: '&#8249;' });
    var next = el('button', { type: 'button', class: 'strip-arrow', 'aria-label': 'Next examples', html: '&#8250;' });
    var wrap = el('div', { class: 'filmstrip-wrap' }, [prev, strip, next]);

    function page(dir) { strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' }); }
    prev.addEventListener('click', function () { page(-1); });
    next.addEventListener('click', function () { page(1); });

    function updateArrows() {
      var room = strip.scrollWidth - strip.clientWidth;
      wrap.classList.toggle('has-arrows', room > 1);
      prev.disabled = strip.scrollLeft <= 1;
      next.disabled = strip.scrollLeft >= room - 1;
    }
    strip.addEventListener('scroll', updateArrows, { passive: true });
    // A hidden panel has no width, so the arrows are settled once its tab is opened.
    if (window.ResizeObserver) new ResizeObserver(updateArrows).observe(strip);
    else window.addEventListener('resize', updateArrows);
    updateArrows();

    panel.appendChild(wrap);
    var stage = el('div', { class: 'stage' }, [opts.media]);
    panel.appendChild(stage);
    // Observe the stage, not a video: the element on screen is swapped out as examples change.
    group.target = stage;
  }

  function renderResults() {
    tabs(document.querySelector('[data-tabs="results"]'), 'results', function (panel, examples) {
      var v = video('ours/' + examples[0].id + '_animated', { preload: 'auto' });
      v.className = 'stage-video';
      stagePicker(panel, examples, {
        media: el('div', {}, [v]), videos: [v], poster: true,
        srcFor: function (k, ex) { return 'static/results/ours/' + ex.id + '_animated.mp4'; },
      });
    });
  }

  function renderComparisons() {
    tabs(document.querySelector('[data-tabs="comparisons"]'), 'comparisons', function (panel, examples) {
      // The input clip is the same for every method, so showing it once leaves each result
      // twice as wide as it was when all three carried their own copy of it.
      var input = video('cmp/input/' + examples[0].id, { preload: 'auto' });
      var videos = [input];
      var cells = SITE.methods.map(function (m) {
        var v = video('cmp/' + m.key + '/' + examples[0].id, { preload: 'auto' });
        videos.push(v);
        return el('div', { class: 'comparison-cell' }, [el('p', { class: 'cell-method', text: m.label }), v]);
      });
      stagePicker(panel, examples, {
        media: el('div', {}, [
          el('div', { class: 'cmp-input' }, [el('p', { class: 'cell-method', text: 'Input video' }), input]),
          el('div', { class: 'comparison-grid' }, cells),
        ]),
        videos: videos,
        srcFor: function (k, ex) {
          return k === 0 ? 'static/results/cmp/input/' + ex.id + '.mp4'
            : 'static/results/cmp/' + SITE.methods[k - 1].key + '/' + ex.id + '.mp4';
        },
      });
    });
  }

  function renderFailures() {
    var list = document.getElementById('failure-list');

    SITE.failures.forEach(function (f) {
      var videos = f.videos.map(function (fv) { return video(fv.file); });
      makeGroup(videos);
      if (f.intro) {
        list.appendChild(el('div', { class: 'content section-intro failure-intro' },
          [el('p', { html: f.intro })]));
      }
      list.appendChild(el('article', { class: 'failure-case' }, [
        videoIdLabel(f.id, 'comparison-id'),
        el('p', { class: 'failure-copy', html: f.text }),
        el('div', {
          class: 'failure-grid' + (f.equalPanels ? ' is-equal' : '') + (f.compact ? ' is-compact' : ''),
        }, f.videos.map(function (fv, j) {
          return el('div', { class: fv.full ? 'failure-panel is-full' : 'failure-panel' },
            [el('p', { class: 'method-title', text: fv.label }), videos[j]]);
        })),
      ]));
    });
  }

  renderHero();
  renderTeaser();
  renderMethod();
  renderResults();
  renderComparisons();
  renderFailures();
  observeGroups();
  trackStickyBars();
})();
