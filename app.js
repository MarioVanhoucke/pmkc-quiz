/* PMKC Quiz — single-page app, no server needed. Progress is stored in this browser (localStorage). */
(function () {
  'use strict';
  var D = window.PMKC_DATA;
  var app = document.getElementById('app');
  var STORE_KEY = 'pmkc-quiz-v1';
  var inFrame = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();

  // ---------- storage ----------
  var memory = null;
  function load() {
    if (memory) return memory;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { s = null; }
    memory = s && typeof s === 'object' ? s : {};
    memory.read = memory.read || {};
    memory.attempts = memory.attempts || {};
    memory.progress = memory.progress || {};
    return memory;
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(memory)); } catch (e) { /* storage unavailable: keep in memory */ } }

  // ---------- indexes ----------
  var ART = {}, PART = {};
  D.parts.forEach(function (p) {
    PART[p.id] = p;
    p.quizzes = p.articles.filter(function (a) { return !a.noquiz; });
    p.qcount = p.quizzes.reduce(function (n, a) { return n + a.questions.length; }, 0);
    p.articles.forEach(function (a) { a.part = p.id; ART[a.id] = a; });
  });
  var TOTAL_Q = D.parts.reduce(function (n, p) { return n + p.qcount; }, 0);
  var TOTAL_QUIZ = D.parts.reduce(function (n, p) { return n + p.quizzes.length; }, 0);

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function fmtDate(t) { try { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function stats(aid) {
    var at = load().attempts[aid] || [];
    if (!at.length) return null;
    var best = at.reduce(function (b, x) { return x.score / x.total > b.score / b.total ? x : b; }, at[0]);
    return { best: best, last: at[at.length - 1], count: at.length };
  }
  function isRead(aid) { return !!load().read[aid]; }
  function setRead(aid, v) { load().read[aid] = !!v; save(); }
  function partStats(pid) {
    var p = PART[pid], done = 0, bestSum = 0, correct = 0, answered = 0;
    p.quizzes.forEach(function (a) {
      var s = stats(a.id);
      if (s) { done++; bestSum += s.best.score / s.best.total; correct += s.best.score; answered += s.best.total; }
    });
    return { done: done, total: p.quizzes.length, avgBest: done ? bestSum / done : 0, correct: correct, answered: answered, complete: done === p.quizzes.length };
  }
  function partName(pid) { return PART[pid].title; }
  var ICON_EXT = '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h5v5M14 2 7 9M12 9.5V14H2V4h4.5"/></svg>';
  var ICON_FIG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="7.5" cy="12" r="2"/><circle cx="16.5" cy="8" r="2"/><circle cx="16.5" cy="16" r="2"/><path d="M9.4 11.2 14.6 8.8M9.4 12.8l5.2 2.4"/></svg>';

  function articleLink(a, label) {
    return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" data-read="' + a.id + '">' + esc(label || 'Read the article') + ' ' + ICON_EXT + '</a>';
  }

  // ---------- router ----------
  function route() {
    var h = (location.hash || '#home').slice(1);
    window.scrollTo(0, 0);
    setNav(h);
    var m;
    if (h === 'home' || h === '') return renderHome();
    if (h === 'bs' || h === 'ra' || h === 'pc') return renderPart(h.toUpperCase());
    if (h === 'dashboard') return renderDashboard();
    if ((m = /^quiz-((BS|RA|PC)\d+)$/.exec(h)) && ART[m[1]] && !ART[m[1]].noquiz) return renderQuiz(m[1]);
    if ((m = /^results-((BS|RA|PC)\d+)$/.exec(h)) && ART[m[1]]) return renderResults(m[1]);
    renderHome();
  }
  function setNav(h) {
    var key = h;
    var m = /^(quiz|results)-(BS|RA|PC)/.exec(h);
    if (m) key = m[2].toLowerCase();
    document.querySelectorAll('.nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + key); });
  }
  window.addEventListener('hashchange', route);

  // global: clicking an article link marks it as read
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-read]');
    if (a) {
      var id = a.getAttribute('data-read');
      setRead(id, true);
      var row = document.querySelector('[data-row="' + id + '"]');
      if (row) setTimeout(function () { refreshRow(id); }, 50);
      var gate = document.getElementById('gate-confirm');
      if (gate) gate.checked = true, gate.dispatchEvent(new Event('change'));
    }
  });

  var BOOKS = [
    { cover: 'ddpm', title: 'Data-Driven Project Management', sub: 'The Science & Stories Behind Project Decisions', url: 'https://www.lannoo.com/nl-nl/economie-management/data-driven-project-management-9789059968622', review: ['Review by Henny Portman', 'https://hennyportman.wordpress.com/2026/09/03/review-data-driven-project-management/'] },
    { cover: 'ddpm-python', title: 'Data-Driven Project Management with Python', sub: 'Optimizing Schedules, Simulating Risk and Analyzing Project Performance through 10 Example Experiments', url: 'https://doi.org/10.1007/978-3-032-24556-4' },
    { cover: 'quest', title: 'A Quest for Projects with Scarce Resources', sub: 'Seeking Schedule Intelligence Through Project Data Discovery', url: 'https://doi.org/10.1007/978-3-031-71507-5' },
    { cover: 'illusion-of-control', award: 'Awarded by CPM', title: 'The Illusion of Control', sub: 'Project Data, Computer Algorithms and Human Intuition for Project Management and Control', url: 'https://doi.org/10.1007/978-3-031-31785-9' },
    { cover: 'data-driven-pm-manager', award: 'Awarded by IPMA', title: 'The Data-Driven Project Manager', sub: 'A Statistical Battle Against Project Obstacles', url: 'https://doi.org/10.1007/978-1-4842-3498-3' },
    { cover: 'ipmc', title: 'Integrated Project Management and Control', sub: 'First Comes the Theory, then the Practice', url: 'https://doi.org/10.1007/978-3-319-04331-9' },
    { cover: 'pm-dynamic-scheduling', title: 'Project Management with Dynamic Scheduling', sub: 'Baseline Scheduling, Risk Analysis and Project Control', url: 'https://doi.org/10.1007/978-3-642-40438-2' },
    { cover: 'measuring-time', award: 'Awarded by IPMA', title: 'Measuring Time', sub: 'Improving Project Performance Using Earned Value Management', url: 'https://doi.org/10.1007/978-1-4419-1014-1' }
  ];

  // ---------- HOME ----------
  function renderHome() {
    document.title = 'PMKC Quiz';
    var partCards = D.parts.map(function (p) {
      var s = partStats(p.id);
      return '<a class="sheet part-card p-' + p.id + '" href="#' + p.id.toLowerCase() + '">' +
        '<span class="eyebrow">Part ' + ({ BS: 'I', RA: 'II', PC: 'III' })[p.id] + ' · ' + p.id + '</span>' +
        '<h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="meta"><span>' + p.quizzes.length + ' quizzes · ' + p.qcount + ' questions</span><span>' + s.done + '/' + s.total + ' done</span></div>' +
        '<div class="gbar"><i style="width:' + (s.done / s.total * 100) + '%"></i></div></a>';
    }).join('');
    app.innerHTML =
      '<section class="sheet hero">' +
        '<img class="hero-cover" src="img/cover.jpg" alt="Cover of Integrated Project Management Sourcebook by Mario Vanhoucke (Springer)" width="640" height="963">' +
        '<div class="hero-text">' +
          '<span class="eyebrow">Mario Vanhoucke · Springer · 2016</span>' +
          '<h1>Integrated Project Management Sourcebook</h1>' +
          '<p class="lede">A Technical Guide to Project Scheduling, Risk and Control</p>' +
          '<p>This book is the sourcebook for students of any project management course that focuses on the integration of baseline scheduling, schedule risk analysis and project control, known as Dynamic Scheduling or Integrated Project Management and Control. It contains more than 70 articles in three parts, each linked to the other relevant articles of the book.</p>' +
          '<p>Almost every article ends with a set of questions to test your knowledge and understanding of its theme. Those questions are not online: you find them in the book, and here as interactive quizzes with the answers and explanations from the book\'s MS Excel solutions file. The articles themselves can be read for free on the PM Knowledge Center.</p>' +
          '<div class="facts"><div><b>' + D.parts.reduce(function (n, p) { return n + p.articles.length; }, 0) + '</b>articles</div><div><b>' + TOTAL_QUIZ + '</b>quizzes</div><div><b>' + TOTAL_Q + '</b>questions</div></div>' +
          '<div class="row">' +
            '<a class="btn btn-amber" href="#bs">Start with Baseline Scheduling</a>' +
            '<a class="btn btn-ghost" href="https://doi.org/10.1007/978-3-319-27373-0" target="_blank" rel="noopener">Get the book at Springer ' + ICON_EXT + '</a>' +
            '<a class="btn btn-ghost" href="https://www.or-as.be/pm-knowledge-center/" target="_blank" rel="noopener">PM Knowledge Center ' + ICON_EXT + '</a>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="sheet steps">' +
        '<div class="step"><span class="num">STEP 1</span><h3>Read the article</h3><p>Every quiz belongs to one PM Knowledge Center article. Reading it is required before the quiz unlocks.</p></div>' +
        '<div class="step"><span class="num">STEP 2</span><h3>Answer the questions</h3><p>Multiple choice, labelled BS, RA and PC with the number used in the book. You see the result and the explanation after each answer.</p></div>' +
        '<div class="step"><span class="num">STEP 3</span><h3>Track your scores</h3><p>The dashboard shows your best and latest score for every quiz, and your progress per part.</p></div>' +
      '</section>' +
      '<section style="display:grid;gap:14px"><div class="section-head"><h2>The three quiz parts</h2><a href="#dashboard">Open the dashboard</a></div><div class="parts">' + partCards + '</div></section>' +
      '<section class="sheet books"><span class="eyebrow">Also by Mario Vanhoucke</span><ul class="booklist">' +
        BOOKS.map(function (b) {
          return '<li><a class="book-cover" href="' + esc(b.url) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="img/books/' + b.cover + '.jpg" alt="" loading="lazy"></a>' +
            (b.award ? '<span class="book-award">' + esc(b.award) + '</span>' : '') +
            '<a class="book-title" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.title) + ' ' + ICON_EXT + '</a><span class="book-sub">' + esc(b.sub) + '</span>' +
            (b.review ? '<a class="book-review" href="' + esc(b.review[1]) + '" target="_blank" rel="noopener">' + esc(b.review[0]) + ' ' + ICON_EXT + '</a>' : '') + '</li>';
        }).join('') +
      '</ul><p class="books-more">All books, previews and reviews: <a href="https://www.or-as.be/books" target="_blank" rel="noopener">www.or-as.be/books ' + ICON_EXT + '</a></p></section>' +
      footer();
  }
  function footer() {
    return '<footer class="footer"><p>Questions and answers from <i>Integrated Project Management Sourcebook</i> (M. Vanhoucke, Springer, 2016) and its MS Excel solutions file. Articles © PM Knowledge Center, <a href="https://www.or-as.be/" target="_blank" rel="noopener">OR&amp;S</a>.</p><p>Your progress is saved in this browser only.</p></footer>';
  }

  // ---------- PART ----------
  function quizRowHtml(a) {
    var s = stats(a.id), read = isRead(a.id), prog = load().progress[a.id];
    var status = s ? '<span class="pill pill-ok">Best ' + pct(s.best.score / s.best.total) + '</span>' :
      (prog ? '<span class="pill pill-amber">In progress</span>' : '<span class="pill pill-plain">Not started</span>');
    var label = s ? 'Retake quiz' : (prog ? 'Resume quiz' : 'Start quiz');
    return '<div class="sheet quiz-row p-' + a.part + '" data-row="' + a.id + '">' +
      '<div class="qid"><span class="chip chip-id">' + a.id + '</span></div>' +
      '<div class="qbody"><div class="qtitle">' + esc(a.title) + '</div>' +
        '<div class="reading' + (read ? ' done' : '') + '">' +
          '<span class="req">' + (read ? '✓ Read' : 'Required reading') + '</span>' + articleLink(a, 'PM Knowledge Center article') +
          '<label><input type="checkbox" data-confirm="' + a.id + '"' + (read ? ' checked' : '') + '> I have read this article</label>' +
        '</div>' +
        '<div class="stats">' + a.questions.length + ' questions' + (a.page ? ' · book p. ' + a.page : '') + (s ? ' · ' + s.count + ' attempt' + (s.count > 1 ? 's' : '') + ' · last ' + pct(s.last.score / s.last.total) : '') + '</div>' +
      '</div>' +
      '<div class="qactions">' + status +
        '<button class="btn btn-primary btn-sm" data-start="' + a.id + '"' + (read ? '' : ' disabled title="Read the article first"') + '>' + label + '</button>' +
      '</div></div>';
  }
  function refreshRow(id) {
    var row = document.querySelector('[data-row="' + id + '"]');
    if (row) { row.outerHTML = quizRowHtml(ART[id]); }
  }
  function renderPart(pid) {
    var p = PART[pid], s = partStats(pid);
    document.title = p.title + ' · PMKC Quiz';
    var intro = p.articles.filter(function (a) { return a.noquiz; })[0];
    var html = '<section class="sheet part-hero p-' + pid + '"><span class="eyebrow">Part ' + ({ BS: 'I', RA: 'II', PC: 'III' })[pid] + ' · ' + pid + '1 to ' + pid + p.articles.length + '</span><h1>' + esc(p.title) + ' quizzes</h1><p>' + esc(p.desc) + ' Each quiz below unlocks once you have read its article on the PM Knowledge Center.</p>' +
      '<div class="part-summary"><div class="gbar"><i style="width:' + (s.done / s.total * 100) + '%"></i></div><span class="small muted">' + s.done + ' of ' + s.total + ' quizzes done' + (s.done ? ' · average best score ' + pct(s.avgBest) : '') + '</span>' + (s.complete ? '<span class="pill pill-ok">Part complete</span>' : '') + '</div></section>';
    if (intro) html += '<div class="sheet intro-article p-' + pid + '"><span class="chip chip-id">' + intro.id + '</span><span><b>Start here:</b> ' + esc(intro.title) + ' (no quiz)</span>' + articleLink(intro, 'Read the introduction') + '</div>';
    // group by topic / sub
    var groups = [];
    p.quizzes.forEach(function (a) {
      var g = groups[groups.length - 1];
      if (!g || g.topic !== a.topic) { g = { topic: a.topic, items: [] }; groups.push(g); }
      g.items.push(a);
    });
    groups.forEach(function (g) {
      html += '<section class="topic"><h2>' + esc(g.topic) + '</h2>';
      var lastSub = null, list = '';
      g.items.forEach(function (a) {
        if (a.sub && a.sub !== lastSub) { list += '<div class="subtopic">' + esc(a.sub) + '</div>'; }
        if (!a.sub && lastSub) list += '<div class="subtopic">Other</div>';
        lastSub = a.sub;
        list += quizRowHtml(a);
      });
      html += '<div class="quiz-list">' + list + '</div></section>';
    });
    app.innerHTML = html + footer();
    app.onchange = function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-confirm');
      if (id) { setRead(id, e.target.checked); refreshRow(id); }
    };
    app.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-start]');
      if (b && !b.disabled) location.hash = 'quiz-' + b.getAttribute('data-start');
    };
  }

  // ---------- QUIZ ----------
  function renderTable(key) {
    var t = D.tables[key]; if (!t) return '';
    return '<div class="ref"><div class="ref-cap">' + esc(t.caption) + '</div><div class="tablewrap"><table class="data"><thead><tr>' +
      t.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      t.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  function renderRefs(q, a) {
    if (!q.refs.length) return '';
    var out = q.refs.map(function (r) {
      var html = '';
      if (r.table) html += renderTable(r.table);
      if (r.img) html += '<div class="ref"><div class="ref-cap">' + esc(r.imgCaption) + '</div><a class="figure" href="' + esc(r.img) + '" target="_blank" rel="noopener" title="Open full size"><img src="' + esc(r.img) + '" alt="' + esc(r.imgCaption) + '" loading="lazy"></a></div>';
      if (!html) {
        var src = ART[r.article] || a;
        html = '<div class="missing-fig">' + ICON_FIG + '<div>This question uses <b>' + esc(r.label) + '</b>' + (r.page ? ' (book p. ' + r.page + ')' : '') + ', which is a drawing in the article. Keep ' +
          (src.id === a.id ? 'the article' : 'article ' + src.id) + ' open next to the quiz to look at it: ' + articleLink(src, src.id + ' on PM Knowledge Center') + '</div></div>';
      }
      return html;
    }).join('');
    return '<div class="refs">' + out + '</div>';
  }
  function renderTab(name) {
    var t = D.tabs[name]; if (!t) return '';
    var rows = t.grid.map(function (r) {
      return '<tr>' + r.map(function (c) {
        var isNum = /^[−\-€ ]*[\d.,]+( %)?$/.test(c);
        return '<td class="' + (c === '' ? '' : isNum ? 'num' : 'txt') + '">' + esc(c) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<details class="tab"><summary>Worked solution from the Excel file (tab ' + esc(name) + ')</summary><div class="tabwrap"><p class="small muted" style="margin-bottom:8px">' + esc(t.title) + '</p><div class="tablewrap"><table class="data grid"><tbody>' + rows + '</tbody></table></div></div></details>';
  }
  function letters(arr) { return arr.map(function (l) { return '(' + l + ')'; }).join(' and '); }
  function sameSet(a, b) { if (a.length !== b.length) return false; var s = a.slice().sort().join(); return s === b.slice().sort().join(); }

  function renderGate(a) {
    document.title = a.id + ' · PMKC Quiz';
    app.innerHTML = '<section class="sheet gate p-' + a.part + '"><span class="chip chip-id">' + a.id + '</span><h1>Read the article first</h1>' +
      '<p>The ' + a.id + ' quiz is about the article <b>' + esc(a.title) + '</b>. The questions assume you have read it, so the quiz unlocks after you open it on the PM Knowledge Center or confirm that you have read it.</p>' +
      '<div class="reading"><span class="req">Required reading</span>' + articleLink(a, 'Open ' + a.id + ' on PM Knowledge Center') + '<label><input type="checkbox" id="gate-confirm"> I have read this article</label></div>' +
      '<div class="row"><button class="btn btn-primary" id="gate-go" disabled>Start the quiz</button><a class="btn btn-ghost" href="#' + a.part.toLowerCase() + '">Back to ' + esc(partName(a.part)) + '</a></div></section>';
    var cb = document.getElementById('gate-confirm'), go = document.getElementById('gate-go');
    cb.addEventListener('change', function () { setRead(a.id, cb.checked); go.disabled = !cb.checked; });
    go.addEventListener('click', function () { renderQuiz(a.id); });
  }

  function renderQuiz(aid) {
    var a = ART[aid];
    if (!isRead(aid)) return renderGate(a);
    document.title = a.id + ' quiz · PMKC Quiz';
    var st = load();
    var prog = st.progress[aid];
    if (!prog || prog.v !== a.questions.length) prog = st.progress[aid] = { v: a.questions.length, i: 0, answers: {}, started: Date.now() };
    save();
    var selected = [];

    function draw() {
      var i = prog.i, q = a.questions[i], key = String(q.n), done = prog.answers[key];
      if (!done) selected = [];
      var segs = a.questions.map(function (qq, k) {
        var r = prog.answers[String(qq.n)];
        return '<i class="' + (r ? (r.ok ? 'ok' : 'bad') : (k === i ? 'cur' : '')) + '"></i>';
      }).join('');
      var opts = q.options.map(function (o) {
        var cls = 'opt' + (q.multi ? ' multi' : ''), mark = '';
        var pressed = done ? done.chosen.indexOf(o.l) >= 0 : selected.indexOf(o.l) >= 0;
        if (done) {
          if (q.correct.indexOf(o.l) >= 0) { cls += ' is-correct'; mark = 'Correct answer'; }
          else if (pressed) { cls += ' is-wrong'; mark = 'Your answer'; }
        }
        return '<button class="' + cls + '" data-opt="' + o.l + '" aria-pressed="' + pressed + '"' + (done ? ' disabled' : '') + '><span class="key">' + o.l + '</span><span>' + esc(o.t) + '</span><span class="mark">' + mark + '</span></button>';
      }).join('');
      var fb = '';
      if (done) {
        fb = '<div class="feedback ' + (done.ok ? 'ok' : 'bad') + '" role="status"><div class="verdict">' + (done.ok ? 'Correct' : 'Not quite') + '</div>' +
          '<p>' + (done.ok ? 'The answer is ' : 'You chose ' + letters(done.chosen) + '. The correct answer is ') + letters(q.correct) + (q.correct.length > 1 ? ' (both are needed)' : '') + '.</p>' +
          (q.explanation ? '<div class="explain"><span class="lbl">Explanation</span><div>' + q.explanation + '</div></div>' : '') +
          (q.tab ? renderTab(q.tab) : '') + '</div>';
      }
      var last = i === a.questions.length - 1;
      app.innerHTML =
        '<section class="quiz-head p-' + a.part + '"><div class="crumbs"><a href="#' + a.part.toLowerCase() + '">' + esc(partName(a.part)) + '</a><span>/</span><span class="chip chip-id">' + a.id + '</span><span>' + esc(a.title) + '</span></div>' +
        '<div class="segs" aria-label="Question ' + (i + 1) + ' of ' + a.questions.length + '">' + segs + '</div></section>' +
        '<section class="sheet qcard p-' + a.part + '">' +
          '<div class="qnum"><span class="chip chip-id">' + a.id + ' · Q' + q.n + '</span><span class="muted small">Question ' + (i + 1) + ' of ' + a.questions.length + (q.multi ? ' · select all that apply' : '') + '</span><span style="flex:1"></span>' + articleLink(a, 'Article') + '</div>' +
          (a.intro ? '<div class="context">' + esc(a.intro) + '</div>' : '') +
          '<div class="qtext">' + esc(q.text) + '</div>' +
          renderRefs(q, a) +
          (q.note ? '<p class="note">' + esc(q.note) + '</p>' : '') +
          '<div class="options" role="group" aria-label="Answer options">' + opts + '</div>' +
          fb +
          '<div class="qfoot"><span class="hint">Keys: <span class="kbd">a</span>–<span class="kbd">' + q.options[q.options.length - 1].l + '</span> to choose, <span class="kbd">Enter</span> to ' + (done ? 'continue' : 'check') + '</span>' +
            '<div class="row">' + (i > 0 ? '<button class="btn btn-ghost" id="prev">Previous</button>' : '') +
            (done ? '<button class="btn btn-primary" id="next">' + (last ? 'See my results' : 'Next question') + '</button>'
                  : '<button class="btn btn-primary" id="check" disabled>Check answer</button>') +
          '</div></div>' +
        '</section>';
      bind(q, done);
    }
    function updateCheck() { var c = document.getElementById('check'); if (c) c.disabled = !selected.length; }
    function choose(q, l) {
      if (q.multi) { var k = selected.indexOf(l); if (k >= 0) selected.splice(k, 1); else selected.push(l); }
      else selected = [l];
      document.querySelectorAll('.opt').forEach(function (b) { b.setAttribute('aria-pressed', selected.indexOf(b.getAttribute('data-opt')) >= 0); });
      updateCheck();
    }
    function check(q) {
      if (!selected.length) return;
      prog.answers[String(q.n)] = { chosen: selected.slice(), ok: sameSet(selected, q.correct) };
      save(); draw();
      var f = document.querySelector('.feedback'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function next() {
      if (prog.i < a.questions.length - 1) { prog.i++; save(); draw(); window.scrollTo(0, 0); }
      else finish();
    }
    function finish() {
      var score = 0, answers = {};
      a.questions.forEach(function (q) { var r = prog.answers[String(q.n)]; answers[q.n] = r ? r.chosen : []; if (r && r.ok) score++; });
      var at = st.attempts[aid] = st.attempts[aid] || [];
      at.push({ date: Date.now(), score: score, total: a.questions.length, answers: answers });
      delete st.progress[aid]; save();
      location.hash = 'results-' + aid;
    }
    function bind(q, done) {
      app.onclick = function (e) {
        var o = e.target.closest && e.target.closest('[data-opt]');
        if (o && !done) return choose(q, o.getAttribute('data-opt'));
        if (e.target.id === 'check') return check(q);
        if (e.target.id === 'next') return next();
        if (e.target.id === 'prev') { prog.i--; save(); draw(); }
      };
      app.onchange = null;
      document.onkeydown = function (e) {
        if (!/^quiz-/.test(location.hash.slice(1)) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        var k = e.key.toLowerCase();
        if (!done && q.options.some(function (o) { return o.l === k; })) { e.preventDefault(); choose(q, k); }
        else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'SUMMARY')) {
          e.preventDefault(); if (done) next(); else check(q);
        }
      };
      updateCheck();
    }
    draw();
  }

  // ---------- RESULTS ----------
  function ring(frac, color) {
    var r = 54, c = 2 * Math.PI * r;
    return '<svg class="ring" viewBox="0 0 132 132" role="img" aria-label="Score ' + Math.round(frac * 100) + ' percent">' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="12"/>' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * frac) + ' ' + c + '" transform="rotate(-90 66 66)"/>' +
      '<text x="66" y="74" text-anchor="middle" font-size="30" font-weight="700" fill="var(--ink)">' + Math.round(frac * 100) + '%</text></svg>';
  }
  function renderResults(aid) {
    document.onkeydown = null;
    var a = ART[aid], s = stats(aid);
    if (!s) { location.hash = 'quiz-' + aid; return; }
    document.title = a.id + ' results · PMKC Quiz';
    var last = s.last, frac = last.score / last.total;
    var msg = frac === 1 ? 'A perfect score.' : frac >= 0.8 ? 'Strong result.' : frac >= 0.5 ? 'A good basis. Review the questions you missed below.' : 'Worth another read of the article before you retake the quiz.';
    var idx = D.parts.reduce(function (arr, p) { return arr.concat(p.quizzes); }, []);
    var pos = idx.indexOf(a), nextA = idx[pos + 1] && idx[pos + 1].part === a.part ? idx[pos + 1] : null;
    var ps = partStats(a.part);
    var items = a.questions.map(function (q) {
      var ch = last.answers[q.n] || [], ok = sameSet(ch, q.correct);
      return '<div class="sheet review-item ' + (ok ? 'ok' : 'bad') + '"><div class="row"><span class="chip chip-id">Q' + q.n + '</span><span class="pill ' + (ok ? 'pill-ok' : 'pill-plain') + '">' + (ok ? 'Correct' : 'Incorrect') + '</span></div>' +
        '<div>' + esc(q.text) + '</div>' +
        '<div class="ans">Your answer: ' + (ch.length ? ch.map(function (l) { var o = q.options.filter(function (x) { return x.l === l; })[0]; return '(' + l + ') ' + esc(o ? o.t : ''); }).join('; ') : '—') +
        (ok ? '' : '<br>Correct answer: ' + q.correct.map(function (l) { var o = q.options.filter(function (x) { return x.l === l; })[0]; return '(' + l + ') ' + esc(o ? o.t : ''); }).join('; ')) + '</div>' +
        (q.explanation ? '<div class="explain"><span class="lbl">Explanation</span><div>' + q.explanation + '</div></div>' : '') + '</div>';
    }).join('');
    app.innerHTML =
      '<div class="crumbs p-' + a.part + '"><a href="#' + a.part.toLowerCase() + '">' + esc(partName(a.part)) + '</a><span>/</span><span class="chip chip-id">' + a.id + '</span><span>Results</span></div>' +
      '<section class="sheet result-top p-' + a.part + '">' + ring(frac, 'var(--c)') +
        '<div style="display:grid;gap:12px;min-width:0"><h1>' + last.score + ' of ' + last.total + ' correct</h1><p class="muted">' + esc(a.title) + '</p><p>' + msg + (s.count > 1 ? ' Your best score on this quiz is ' + pct(s.best.score / s.best.total) + ' over ' + s.count + ' attempts.' : '') + '</p>' +
        (ps.complete ? '<p><span class="pill pill-ok">' + esc(partName(a.part)) + ' complete</span> You have finished every quiz in this part. <a href="#dashboard">See your dashboard</a>.</p>' : '<p class="small muted">' + ps.done + ' of ' + ps.total + ' quizzes done in ' + esc(partName(a.part)) + '.</p>') +
        '<div class="row"><button class="btn btn-ghost" id="retake">Retake quiz</button>' + (nextA ? '<a class="btn btn-primary" href="#quiz-' + nextA.id + '">Next quiz: ' + nextA.id + '</a>' : '') + '<a class="btn btn-ghost" href="#dashboard">Dashboard</a></div></div></section>' +
      '<section style="display:grid;gap:12px"><h2>Review</h2><div class="review">' + items + '</div></section>' + footer();
    app.onclick = function (e) { if (e.target.id === 'retake') { location.hash = 'quiz-' + aid; if (location.hash === '#quiz-' + aid) route(); } };
  }

  // ---------- DASHBOARD ----------
  function renderDashboard() {
    document.onkeydown = null;
    document.title = 'Dashboard · PMKC Quiz';
    var tot = { done: 0, correct: 0, answered: 0, attempts: 0 };
    D.parts.forEach(function (p) { var s = partStats(p.id); tot.done += s.done; tot.correct += s.correct; tot.answered += s.answered; p.quizzes.forEach(function (a) { var x = stats(a.id); if (x) tot.attempts += x.count; }); });
    var html = '<section style="display:grid;gap:8px"><span class="eyebrow">Your progress</span><h1>Dashboard</h1><p class="muted">Best score per quiz, per part. Scores are kept in this browser.</p></section>' +
      '<section class="tiles">' +
        '<div class="sheet tile"><b>' + tot.done + '<small style="font-size:1rem;color:var(--ink-3)"> / ' + TOTAL_QUIZ + '</small></b><span>quizzes completed</span></div>' +
        '<div class="sheet tile"><b>' + tot.answered + '<small style="font-size:1rem;color:var(--ink-3)"> / ' + TOTAL_Q + '</small></b><span>questions answered (best attempts)</span></div>' +
        '<div class="sheet tile"><b>' + (tot.answered ? pct(tot.correct / tot.answered) : '–') + '</b><span>correct in your best attempts</span></div>' +
        '<div class="sheet tile"><b>' + tot.attempts + '</b><span>quiz attempts in total</span></div>' +
      '</section>';
    D.parts.forEach(function (p) {
      var s = partStats(p.id);
      var rows = p.quizzes.map(function (a) {
        var x = stats(a.id);
        var best = x ? x.best.score / x.best.total : 0, lastf = x ? x.last.score / x.last.total : 0;
        return '<a class="gantt-row" href="#' + (isRead(a.id) ? 'quiz-' : p.id.toLowerCase()) + (isRead(a.id) ? a.id : '') + '" title="' + esc(a.id + ': ' + a.title) + '">' +
          '<span class="chip chip-id">' + a.id + '</span>' +
          '<span class="track">' + (x ? '<i style="width:calc(' + (best * 100) + '% - 4px)"></i>' + (lastf < best ? '<i class="last" style="width:calc(' + (lastf * 100) + '% - 4px)"></i>' : '') : '') + '</span>' +
          '<span class="val' + (x ? '' : ' none') + '">' + (x ? x.best.score + '/' + x.best.total + ' · ' + pct(best) : 'not taken') + '</span></a>';
      }).join('');
      html += '<section class="sheet dash-part p-' + p.id + '"><div class="dash-part-head"><div style="display:grid;gap:6px"><span class="eyebrow">' + p.id + '</span><h2>' + esc(p.title) + '</h2>' + (s.complete ? '<span class="pill pill-ok">Part complete</span>' : '<span class="small muted">Finish all ' + s.total + ' quizzes to complete this part.</span>') + '</div>' +
        '<div class="dash-kpis"><div><b>' + s.done + '/' + s.total + '</b><span>quizzes done</span></div><div><b>' + (s.done ? pct(s.avgBest) : '–') + '</b><span>average best score</span></div><div><b>' + s.correct + '/' + p.qcount + '</b><span>questions correct</span></div></div></div>' +
        '<div class="gantt"><div class="gantt-scale"><span></span><span class="ticks"><span style="left:0">0 %</span><span style="left:25%">25</span><span style="left:50%">50</span><span style="left:75%">75</span><span style="left:100%">100 %</span></span><span></span></div>' + rows + '</div>' +
        '<div class="legend"><span><i style="background:var(--c)"></i>Best score</span><span><i class="o" style="border-color:var(--c)"></i>Latest attempt, when lower than the best</span></div></section>';
    });
    html += '<section class="sheet danger-zone"><div><b>Start over</b><p class="small muted">Removes all scores, reading confirmations and unfinished quizzes from this browser.</p></div><div class="confirm" id="reset-area">' +
      (inFrame ? '' : '<button class="btn btn-ghost btn-sm" id="csv">Download results (CSV)</button>') +
      '<button class="btn btn-ghost btn-sm" id="reset">Reset progress</button></div></section>' + footer();
    app.innerHTML = html;
    app.onclick = function (e) {
      if (e.target.id === 'reset') {
        document.getElementById('reset-area').innerHTML = '<span class="small">Delete all progress?</span><button class="btn btn-danger btn-sm" id="reset-yes">Yes, delete</button><button class="btn btn-ghost btn-sm" id="reset-no">Cancel</button>';
      } else if (e.target.id === 'reset-yes') {
        memory = { read: {}, attempts: {}, progress: {} }; save(); renderDashboard();
      } else if (e.target.id === 'reset-no') { renderDashboard(); }
      else if (e.target.id === 'csv') downloadCsv();
    };
  }
  function downloadCsv() {
    var lines = [['Part', 'Article', 'Title', 'Attempt date', 'Score', 'Questions', 'Percent'].join(',')];
    D.parts.forEach(function (p) { p.quizzes.forEach(function (a) {
      (load().attempts[a.id] || []).forEach(function (t) {
        lines.push([p.id, a.id, '"' + a.title.replace(/"/g, '""') + '"', new Date(t.date).toISOString().slice(0, 10), t.score, t.total, Math.round(t.score / t.total * 100)].join(','));
      });
    }); });
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'pmkc-quiz-results.csv'; document.body.appendChild(link); link.click();
    setTimeout(function () { URL.revokeObjectURL(url); link.remove(); }, 500);
  }

  route();
})();
