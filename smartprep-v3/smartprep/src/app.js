// ============================================================
//  SmartPrep — Main Application Controller
// ============================================================

// ── App State ─────────────────────────────────────────────
const App = {
  domain:       'DSA',
  question:     null,
  finalText:    '',
  interimText:  '',
  isRecording:  false,
  cameraOn:     false,
  timerInterval: null,
  timerSecs:    0,
  history:      JSON.parse(sessionStorage.getItem('sp_history') || '[]'),
  lastResult:   null,
  visualScoreSamples: [],
  sttMode:      'browser'
};

// ══════════════════════════════════════════════
//  MODAL / SETUP
// ══════════════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  event.target.classList.add('active');
  document.getElementById(name + 'Tab').classList.remove('hidden');
}

function startApp(mode) {
  App.sttMode = mode;

  if (mode === 'watson') {
    const key = document.getElementById('watsonKey').value.trim();
    const url = document.getElementById('watsonUrl').value.trim();
    if (!key || !url) { toast('Please fill in both Watson credentials.', 'error'); return; }
    SpeechEngine.configure('watson', key, url);
    document.getElementById('sttBadge').textContent = 'IBM Watson STT';
    sessionStorage.setItem('sp_wkey', key);
    sessionStorage.setItem('sp_wurl', url);
  } else {
    SpeechEngine.configure('browser');
    document.getElementById('sttBadge').textContent = 'Browser STT';
  }

  document.getElementById('configModal').classList.remove('active');
  document.getElementById('app').classList.remove('hidden');
  loadQuestion();
  toast('Welcome to SmartPrep! Select a domain and start speaking.', 'info');
}

function openSettings() {
  const modal = document.getElementById('configModal');
  modal.classList.add('active');
  const k = sessionStorage.getItem('sp_wkey');
  const u = sessionStorage.getItem('sp_wurl');
  if (k) document.getElementById('watsonKey').value = k;
  if (u) document.getElementById('watsonUrl').value = u;
}

// Auto-restore session
window.addEventListener('load', () => {
  const k = sessionStorage.getItem('sp_wkey');
  const u = sessionStorage.getItem('sp_wurl');
  if (k && u) {
    document.getElementById('watsonKey').value = k;
    document.getElementById('watsonUrl').value = u;
  }
});

// ══════════════════════════════════════════════
//  DOMAIN
// ══════════════════════════════════════════════
function pickDomain(btn) {
  document.querySelectorAll('.domain-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  App.domain = btn.dataset.domain;
  loadQuestion();
}

// ══════════════════════════════════════════════
//  QUESTION
// ══════════════════════════════════════════════
function loadQuestion() {
  if (App.isRecording) stopMic();

  App.question = getNextQuestion(App.domain);
  clearAnswer();

  const el = document.getElementById('qText');
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.textContent = App.question.text;
  setTimeout(() => {
    el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 30);

  document.getElementById('qNum').textContent  = `Q${qState.count}`;
  const diffEl = document.getElementById('qDiff');
  diffEl.textContent  = App.question.difficulty;
  diffEl.className    = 'q-diff ' + App.question.difficulty;

  document.getElementById('hintPanel').classList.add('hidden');
  document.getElementById('resultsCard').classList.add('hidden');
}

function loadNextQuestion() {
  loadQuestion();
}

function toggleHint() {
  const panel = document.getElementById('hintPanel');
  if (panel.classList.contains('hidden')) {
    panel.textContent = '💡 ' + App.question.hint;
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

// ══════════════════════════════════════════════
//  MICROPHONE
// ══════════════════════════════════════════════
async function toggleMic() {
  if (App.isRecording) { stopMic(); } else { await startMic(); }
}

async function startMic() {
  App.isRecording = true;
  App.finalText   = '';
  App.interimText = '';
  updateTranscript('', '');
  setMicUI(true);
  startTimer();
  setSttStatus('live', 'Listening...');

  await SpeechEngine.start(
    (final, interim) => {
      App.finalText   = final;
      App.interimText = interim;
      updateTranscript(final, interim);
      const wc = final.trim().split(/\s+/).filter(Boolean).length;
      document.getElementById('evalBtn').disabled = wc < 3;
    },
    (state, msg) => {
      if (state === 'error') {
        toast(msg, 'error');
        setSttStatus('error', msg);
        setMicUI(false);
        stopTimer();
        App.isRecording = false;
      } else if (state === 'recording') {
        setSttStatus('live', msg);
      } else if (state === 'done') {
        setSttStatus('done', 'Done');
      }
    }
  );
}

function stopMic() {
  SpeechEngine.stop();
  App.isRecording = false;
  setMicUI(false);
  stopTimer();
  setSttStatus('done', 'Recording stopped');

  const wc = App.finalText.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('evalBtn').disabled = wc < 3;
}

function setMicUI(on) {
  const btn   = document.getElementById('micBtn');
  const label = document.getElementById('micLabel');
  const timer = document.getElementById('recTimer');
  if (on) {
    btn.classList.add('active');
    label.textContent = 'Click to stop';
    timer.classList.remove('hidden');
  } else {
    btn.classList.remove('active');
    label.textContent = 'Click to speak';
    timer.classList.add('hidden');
  }
}

function setSttStatus(state, msg) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className  = 'status-dot ' + state;
  text.textContent = msg;
}

// ── Timer ─────────────────────────────────────
function startTimer() {
  App.timerSecs = 0;
  clearInterval(App.timerInterval);
  App.timerInterval = setInterval(() => {
    App.timerSecs++;
    const m = String(Math.floor(App.timerSecs / 60)).padStart(2,'0');
    const s = String(App.timerSecs % 60).padStart(2,'0');
    document.getElementById('recTimer').textContent = `${m}:${s}`;
    if (App.timerSecs >= 180) { stopMic(); toast('Max recording time (3 min) reached.', 'info'); }
  }, 1000);
}
function stopTimer() { clearInterval(App.timerInterval); }

// ── Transcript UI ─────────────────────────────
function updateTranscript(final, interim) {
  const area = document.getElementById('transcriptArea');
  if (!final && !interim) {
    area.innerHTML = '<p class="t-placeholder">Speak your answer — it will appear here in real-time...</p>';
    document.getElementById('wordCount').textContent = '0 words';
    return;
  }
  const wc = final.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('wordCount').textContent = wc + ' word' + (wc !== 1 ? 's' : '');

  area.innerHTML = '';
  if (final) {
    const span = document.createElement('span');
    span.textContent = final.trim();
    area.appendChild(span);
  }
  if (interim) {
    area.appendChild(document.createTextNode(' '));
    const iSpan = document.createElement('span');
    iSpan.className = 'interim-text';
    iSpan.textContent = interim;
    area.appendChild(iSpan);
  }
  area.scrollTop = area.scrollHeight;
}

function clearAnswer() {
  App.finalText   = '';
  App.interimText = '';
  if (App.isRecording) stopMic();
  updateTranscript('', '');
  document.getElementById('evalBtn').disabled = true;
  document.getElementById('wordCount').textContent = '0 words';
}

// ══════════════════════════════════════════════
//  WEBCAM
// ══════════════════════════════════════════════
async function toggleCamera() {
  const btn = document.getElementById('camToggleBtn');
  const overlay = document.getElementById('camOverlay');
  const badges = document.getElementById('liveBadges');

  if (App.cameraOn) {
    WebcamAnalyser.stop();
    App.cameraOn = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Camera Off`;
    btn.classList.remove('on');
    overlay.classList.remove('hidden');
    badges.style.display = 'none';
    updateCamBadges({ eye: 0, posture: 0, focus: 0, overall: 0 });
  } else {
    const ok = await WebcamAnalyser.start((scores) => {
      App.visualScoreSamples.push(scores.overall);
      updateCamBadges(scores);
    });

    if (ok) {
      App.cameraOn = true;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Camera On`;
      btn.classList.add('on');
      overlay.classList.add('hidden');
      badges.style.display = 'flex';
      toast('Camera active — sit facing the camera for best results.', 'info');
    } else {
      toast('Camera access denied or unavailable.', 'error');
    }
  }
}

function updateCamBadges(scores) {
  const grade = v => v >= 70 ? '🟢' : v >= 45 ? '🟡' : '🔴';
  document.getElementById('eyeVal').textContent     = scores.overall > 0 ? grade(scores.eye)     + ' ' + scores.eye     : '--';
  document.getElementById('postureVal').textContent = scores.overall > 0 ? grade(scores.posture) + ' ' + scores.posture : '--';
  document.getElementById('focusVal').textContent   = scores.overall > 0 ? grade(scores.focus)   + ' ' + scores.focus   : '--';

  const fill = document.getElementById('csBarFill');
  const val  = document.getElementById('csVal');
  fill.style.width = scores.overall + '%';
  val.textContent  = scores.overall > 0 ? scores.overall + '%' : '--';

  // Colour bar
  if (scores.overall >= 70)      fill.style.background = 'linear-gradient(90deg,#10b981,#00f5c4)';
  else if (scores.overall >= 45) fill.style.background = 'linear-gradient(90deg,#f59e0b,#fb923c)';
  else if (scores.overall > 0)   fill.style.background = 'linear-gradient(90deg,#f43f5e,#fb923c)';
}

// ══════════════════════════════════════════════
//  EVALUATION
// ══════════════════════════════════════════════
function runEvaluation() {
  const text = App.finalText.trim();
  if (!text || text.split(/\s+/).filter(Boolean).length < 3) {
    toast('Please record a longer answer first.', 'error');
    return;
  }

  // Disable button + show loading state
  const btn = document.getElementById('evalBtn');
  btn.disabled = true;
  document.getElementById('evalBtnText').innerHTML = '<span class="spinner"></span>Evaluating...';

  setTimeout(() => {
    const q  = App.question;
    const g  = Evaluator.grammar(text);
    const k  = Evaluator.keywords(text, q.keywords);
    const c  = Evaluator.confidence(text);
    const v  = App.cameraOn ? WebcamAnalyser.getFinalScore() : null;
    const ov = Evaluator.overall(g, k, c, v);
    const fb = Evaluator.feedback(g, k, c, v, App.domain);
    const { found, missed } = Evaluator.kwAnalysis(text, q.keywords);

    App.lastResult = { g, k, c, v, ov, found, missed, fb };
    showResults(g, k, c, v, ov, found, missed, fb);

    document.getElementById('evalBtnText').textContent = 'Evaluate My Answer';
    btn.disabled = false;
  }, 400);
}

function showResults(g, k, c, v, ov, found, missed, fb) {
  const card = document.getElementById('resultsCard');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Overall pill
  const pill = document.getElementById('overallPill');
  pill.textContent = ov + '%';
  pill.style.color = ov >= 70 ? 'var(--green)' : ov >= 45 ? 'var(--accent3)' : 'var(--red)';

  // Animate score rings
  animateRing('gRing', 'gScore', g);
  animateRing('kRing', 'kScore', k);
  animateRing('cRing', 'cScore', c);

  // Visual score section
  const vRow = document.getElementById('visualRow');
  if (v !== null && v !== undefined) {
    vRow.style.display = 'grid';
    animateRing('vRing', 'vScore', v);

    // Breakdown bars
    const breakdown = WebcamAnalyser.scores;
    document.getElementById('camBreakdown').innerHTML = `
      <div class="cb-row"><span class="cb-label">👁 Eye Contact</span><div class="cb-bar-track"><div class="cb-bar-fill" style="width:${breakdown.eye}%"></div></div><span class="cb-val">${breakdown.eye}%</span></div>
      <div class="cb-row"><span class="cb-label">🧍 Posture</span><div class="cb-bar-track"><div class="cb-bar-fill" style="width:${breakdown.posture}%"></div></div><span class="cb-val">${breakdown.posture}%</span></div>
      <div class="cb-row"><span class="cb-label">🎯 Steadiness</span><div class="cb-bar-track"><div class="cb-bar-fill" style="width:${breakdown.focus}%"></div></div><span class="cb-val">${breakdown.focus}%</span></div>
    `;
  } else {
    vRow.style.display = 'none';
  }

  // Keywords
  const kwFound  = document.getElementById('kwFound');
  const kwMissed = document.getElementById('kwMissed');
  kwFound.innerHTML  = found.slice(0,6).map(kw => `<span class="kw-chip found">✓ ${kw}</span>`).join('');
  kwMissed.innerHTML = missed.map(kw => `<span class="kw-chip miss">✗ ${kw}</span>`).join('');

  // Feedback
  document.getElementById('feedbackText').textContent = fb;
}

function animateRing(ringId, scoreId, value) {
  const ring  = document.getElementById(ringId);
  const sEl   = document.getElementById(scoreId);
  if (!ring || !sEl) return;
  let cur = 0;
  const target = Math.round(value);
  const step = () => {
    cur = Math.min(cur + 2, target);
    ring.setAttribute('stroke-dasharray', `${cur},100`);
    sEl.textContent = cur;
    ring.style.stroke = cur >= 70 ? '#10b981' : cur >= 45 ? '#f59e0b' : '#f43f5e';
    if (cur < target) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 150);
}

// ══════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════
function saveSession() {
  if (!App.lastResult) return;
  const entry = {
    id:       Date.now(),
    domain:   App.domain,
    question: App.question.text,
    ...App.lastResult,
    date:     new Date().toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })
  };
  App.history.unshift(entry);
  if (App.history.length > 100) App.history.pop();
  sessionStorage.setItem('sp_history', JSON.stringify(App.history));
  toast('Result saved!', 'success');
}

function openHistory() {
  const drawer = document.getElementById('historyDrawer');
  drawer.classList.remove('hidden');
  renderHistory();
}
function closeHistory() {
  document.getElementById('historyDrawer').classList.add('hidden');
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (App.history.length === 0) {
    list.innerHTML = '<p class="h-empty">No saved results yet. Complete and save some answers!</p>';
    return;
  }
  const scoreColour = s => s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--accent3)' : 'var(--red)';
  list.innerHTML = App.history.map(h => `
    <div class="h-item">
      <div class="h-score" style="color:${scoreColour(h.ov)}">${h.ov}%</div>
      <div class="h-q">${h.question.slice(0,90)}...</div>
      <div class="h-meta">${h.domain} · G:${h.g} K:${h.k} C:${h.c}${h.v ? ' V:'+h.v : ''} · ${h.date}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let toastTimer = null;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ══════════════════════════════════════════════
//  MISC
// ══════════════════════════════════════════════
// Close history drawer on outside click
document.addEventListener('click', (e) => {
  const drawer = document.getElementById('historyDrawer');
  if (!drawer.classList.contains('hidden') &&
      !drawer.contains(e.target) &&
      !e.target.closest('.hbtn')) {
    closeHistory();
  }
});

// Handle page visibility — pause cam analysis when tab hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && App.isRecording) stopMic();
});
