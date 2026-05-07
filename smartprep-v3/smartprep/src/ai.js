// ============================================================
//  SmartPrep — AI Interview Engine
//  Uses Claude API (claude-sonnet-4-20250514) to:
//    1. Parse user questions + extract keywords
//    2. Conduct real-time follow-up interview
//    3. Evaluate answers with detailed AI feedback
//    4. Generate ideal answer summaries
// ============================================================

const AIInterview = {
  // ── State ────────────────────────────────────────────────
  apiKey:        null,
  questions:     [],        // array of {text, difficulty, keywords, hint}
  currentIdx:    -1,
  followupCount: 1,
  sessionResults: [],
  inFollowup:    false,
  followupsDone: 0,
  currentConversation: [], // for multi-turn context
  active:        false,
  lastAiResult:  null,

  // ── Open / Close Modal ───────────────────────────────────
  openModal() {
    const modal = document.getElementById('customInterviewModal');
    modal.classList.add('active');
    // restore saved key
    const saved = sessionStorage.getItem('sp_anthro_key');
    if (saved) document.getElementById('ciApiKey').value = saved;
    // Show step 1
    document.getElementById('ciStep1').classList.remove('hidden');
    document.getElementById('ciStep2').classList.add('hidden');
  },

  closeModal() {
    document.getElementById('customInterviewModal').classList.remove('active');
    document.getElementById('ciStep1').classList.remove('hidden');
    document.getElementById('ciStep2').classList.add('hidden');
    document.getElementById('ciStartBtnText').textContent = 'Start AI Interview';
  },

  // ── Start Session ────────────────────────────────────────
  async start() {
    const raw        = document.getElementById('ciQuestionsInput').value.trim();
    const difficulty = document.getElementById('ciDifficulty').value;
    const followups  = parseInt(document.getElementById('ciFollowups').value);
    const apiKey     = document.getElementById('ciApiKey').value.trim();

    if (!raw) { toast('Please enter at least one question.', 'error'); return; }

    const lines = raw.split('\n')
      .map(l => l.replace(/^\d+[\.\)\-]\s*/, '').trim())
      .filter(l => l.length > 5);

    if (lines.length === 0) { toast('No valid questions found. Enter one question per line.', 'error'); return; }

    this.apiKey       = apiKey || null;
    this.followupCount = followups;
    this.sessionResults = [];
    this.active       = true;

    // Save key for later
    if (apiKey) sessionStorage.setItem('sp_anthro_key', apiKey);

    // Show loading
    document.getElementById('ciStep1').classList.add('hidden');
    document.getElementById('ciStep2').classList.remove('hidden');

    // Build questions — either use AI to enrich them or do it locally
    if (apiKey) {
      document.getElementById('ciLoadingText').textContent = 'Claude is analysing your questions...';
      this.questions = await this._enrichQuestionsWithAI(lines, difficulty, apiKey);
    } else {
      this.questions = lines.map(q => ({
        text: q, difficulty, keywords: this._extractKeywordsLocal(q), hint: ''
      }));
    }

    this.closeModal();
    this._activateSessionUI();
    this.currentIdx = -1;
    this.nextQuestion();
  },

  // ── AI: Enrich questions (extract keywords, hints, follow-ups) ─
  async _enrichQuestionsWithAI(lines, difficulty, apiKey) {
    const prompt = `You are an expert technical interviewer. Given these interview questions, extract relevant keywords that a good answer should contain, and write a concise hint for each.

Questions:
${lines.map((q,i) => `${i+1}. ${q}`).join('\n')}

Respond ONLY with valid JSON array — no markdown, no explanation:
[
  {
    "text": "original question text",
    "difficulty": "${difficulty}",
    "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
    "hint": "one-sentence hint for the candidate"
  }
]`;

    try {
      const data = await this._callClaude(prompt, apiKey, 800);
      const text = data.content.map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      console.warn('AI enrichment failed, using local extraction:', e);
      return lines.map(q => ({
        text: q, difficulty,
        keywords: this._extractKeywordsLocal(q),
        hint: 'Take your time and structure your answer clearly.'
      }));
    }
  },

  // ── Local keyword extraction fallback ───────────────────
  _extractKeywordsLocal(questionText) {
    const techWords = questionText.match(/\b[A-Z][a-z]+|[A-Z]{2,}|\b(algorithm|complexity|database|function|class|object|method|array|tree|graph|loop|async|promise|cache|server|client|api|rest|http|sql|heap|stack|queue|hash|sort|search|binary|linear|recursive|dynamic|polymorphism|inheritance|abstraction|encapsulation)\b/gi) || [];
    return [...new Set(techWords.map(w => w.toLowerCase()))].slice(0, 6);
  },

  // ── Activate the in-app session UI ──────────────────────
  _activateSessionUI() {
    document.getElementById('aiSessionBanner').classList.remove('hidden');
    document.getElementById('aiChatPanel').classList.remove('hidden');
    document.getElementById('aiChatMessages').innerHTML = '';
    document.getElementById('aiEvalCard').classList.add('hidden');

    // Hide preset domain selector (keep everything else)
    document.querySelector('.domain-card').style.opacity = '0.4';
    document.querySelector('.domain-card').style.pointerEvents = 'none';

    // Welcome message
    this._addBubble('ai', '👋 Welcome to your custom AI interview session! I\'ll be your interviewer today. I\'ll ask your questions, follow up on your answers, and give detailed feedback. Let\'s begin!');
  },

  // ── Load next question ───────────────────────────────────
  nextQuestion() {
    this.currentIdx++;
    if (this.currentIdx >= this.questions.length) {
      this._showSessionSummary();
      return;
    }

    this.inFollowup    = false;
    this.followupsDone = 0;
    this.currentConversation = [];

    const q = this.questions[this.currentIdx];
    const total = this.questions.length;

    // Update banner
    document.getElementById('aiSessionProgress').textContent =
      `Q${this.currentIdx + 1} of ${total}`;

    // Update the main question panel with current question
    this._setMainQuestion(q);

    // Clear AI eval card
    document.getElementById('aiEvalCard').classList.add('hidden');

    // Add question bubble after short delay
    setTimeout(() => {
      const prefix = this.currentIdx === 0
        ? `Let's start with question ${this.currentIdx + 1}:`
        : `Great! Moving on to question ${this.currentIdx + 1}:`;
      this._addBubble('ai', `${prefix}\n\n❓ ${q.text}`);

      // Store in conversation
      this.currentConversation.push({
        role: 'assistant',
        content: `${prefix}\n\n❓ ${q.text}`
      });
    }, 400);
  },

  // ── Set main question panel to current AI question ──────
  _setMainQuestion(q) {
    const el = document.getElementById('qText');
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.textContent = q.text;
    setTimeout(() => {
      el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 30);

    document.getElementById('qNum').textContent = `Q${this.currentIdx + 1}`;
    const diffEl = document.getElementById('qDiff');
    diffEl.textContent = q.difficulty;
    diffEl.className   = 'q-diff ' + q.difficulty;

    const hintPanel = document.getElementById('hintPanel');
    if (q.hint) {
      hintPanel.textContent = '💡 ' + q.hint;
      hintPanel.classList.remove('hidden');
    } else {
      hintPanel.classList.add('hidden');
    }

    // Clear answer area
    clearAnswer();
  },

  // ── Called after user stops recording + hits Evaluate ───
  async handleAnswer(answerText) {
    if (!this.active || this.currentIdx < 0) return;

    const q = this.questions[this.currentIdx];

    // Add user answer bubble
    const preview = answerText.trim().slice(0, 220) + (answerText.length > 220 ? '...' : '');
    this._addBubble('user', preview);
    this.currentConversation.push({ role: 'user', content: answerText });

    // Show typing indicator
    const typingId = this._addTypingBubble();

    if (this.apiKey && this.followupCount > 0 && this.followupsDone < this.followupCount && !this.inFollowup) {
      // Get AI follow-up question
      const followup = await this._getFollowupQuestion(q, answerText);
      this._removeTyping(typingId);

      if (followup) {
        this.inFollowup    = true;
        this.followupsDone++;
        this._addBubble('ai', followup, true); // true = is follow-up
        this.currentConversation.push({ role: 'assistant', content: followup });
        // Prompt user to answer follow-up via mic
        toast('Follow-up question added — record your answer!', 'info');
        return; // wait for follow-up answer
      }
    }

    // No follow-up or follow-ups exhausted — evaluate
    this._removeTyping(typingId);
    await this._evaluateAnswer(q, answerText);
  },

  // ── Get follow-up question from Claude ──────────────────
  async _getFollowupQuestion(q, answer) {
    const prompt = `You are conducting a technical interview. The question was:
"${q.text}"

The candidate answered:
"${answer}"

Generate ONE concise follow-up question that:
- Digs deeper into something mentioned in their answer
- Or tests a related concept they may have missed
- Is direct and specific (1-2 sentences max)
- Does NOT repeat the original question

Respond with ONLY the follow-up question, no preamble or quotes.`;

    try {
      const data = await this._callClaude(prompt, this.apiKey, 120);
      return data.content[0]?.text?.trim() || null;
    } catch (e) {
      return null;
    }
  },

  // ── Evaluate answer with Claude ──────────────────────────
  async _evaluateAnswer(q, finalAnswer) {
    const typingId = this._addTypingBubble();
    document.getElementById('evalBtn').disabled = true;
    document.getElementById('evalBtnText').innerHTML = '<span class="spinner"></span>AI Evaluating...';

    let aiEval = null;

    if (this.apiKey) {
      const convoContext = this.currentConversation
        .map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
        .join('\n\n');

      const prompt = `You are an expert technical interviewer evaluating a candidate's answer.

Full interview exchange:
${convoContext}

Candidate's final answer: "${finalAnswer}"

Evaluate based on:
- Technical accuracy and depth
- Keywords/concepts covered: ${q.keywords.join(', ')}
- Communication clarity
- Confidence in delivery

Respond ONLY with this exact JSON (no markdown):
{
  "grammar_score": 0-100,
  "keyword_score": 0-100,
  "confidence_score": 0-100,
  "overall_score": 0-100,
  "found_keywords": ["kw1","kw2"],
  "missed_keywords": ["kw3","kw4"],
  "feedback": "2-3 sentence constructive feedback",
  "ideal_answer_summary": "2-3 sentence summary of what a great answer would include",
  "encouragement": "one short encouraging closing line"
}`;

      try {
        const data = await this._callClaude(prompt, this.apiKey, 600);
        const text = data.content.map(b => b.text || '').join('');
        const clean = text.replace(/```json|```/g, '').trim();
        aiEval = JSON.parse(clean);
      } catch (e) {
        console.warn('AI evaluation failed, using local:', e);
      }
    }

    // Fallback to local evaluator
    if (!aiEval) {
      const g = Evaluator.grammar(finalAnswer);
      const k = Evaluator.keywords(finalAnswer, q.keywords);
      const c = Evaluator.confidence(finalAnswer);
      const { found, missed } = Evaluator.kwAnalysis(finalAnswer, q.keywords);
      aiEval = {
        grammar_score: g, keyword_score: k, confidence_score: c,
        overall_score: Evaluator.overall(g, k, c, null),
        found_keywords: found, missed_keywords: missed,
        feedback: Evaluator.feedback(g, k, c, null, 'Custom'),
        ideal_answer_summary: 'Focus on covering the key technical concepts with clear structure.',
        encouragement: 'Keep practising — every answer is a learning opportunity!'
      };
    }

    this._removeTyping(typingId);

    // Add brief AI feedback message in chat
    this._addBubble('ai',
      `${aiEval.encouragement}\n\nOverall score: **${aiEval.overall_score}%** — see detailed breakdown below.`
    );

    // Store result
    this.lastAiResult = {
      question: q.text,
      answer: finalAnswer,
      ...aiEval,
      visual: App.cameraOn ? WebcamAnalyser.getFinalScore() : null
    };
    this.sessionResults.push({ ...this.lastAiResult });

    // Show eval card
    this._showEvalCard(aiEval, q);

    document.getElementById('evalBtnText').textContent = 'Evaluate My Answer';
    // Keep eval btn disabled until next question
    document.getElementById('evalBtn').disabled = true;
  },

  // ── Show structured evaluation card ─────────────────────
  _showEvalCard(ev, q) {
    const card = document.getElementById('aiEvalCard');
    card.classList.remove('hidden');

    const visual = App.cameraOn ? WebcamAnalyser.getFinalScore() : null;
    const ov = visual
      ? Math.round(ev.overall_score * 0.88 + visual * 0.12)
      : ev.overall_score;

    const pill = document.getElementById('aiOverallPill');
    pill.textContent = ov + '%';
    pill.style.color = ov >= 70 ? 'var(--green)' : ov >= 45 ? 'var(--accent3)' : 'var(--red)';

    const scoreColour = s => s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--accent3)' : 'var(--red)';

    const visualBox = visual !== null ? `
      <div class="ai-score-box">
        <div class="ai-score-val" style="color:var(--cyan)">${visual}%</div>
        <div class="ai-score-lbl">Visual</div>
      </div>` : '';

    document.getElementById('aiEvalBody').innerHTML = `
      <div class="ai-score-grid" style="grid-template-columns:repeat(${visual !== null ? 4 : 3},1fr)">
        <div class="ai-score-box">
          <div class="ai-score-val" style="color:${scoreColour(ev.grammar_score)}">${ev.grammar_score}%</div>
          <div class="ai-score-lbl">Grammar</div>
        </div>
        <div class="ai-score-box">
          <div class="ai-score-val" style="color:${scoreColour(ev.keyword_score)}">${ev.keyword_score}%</div>
          <div class="ai-score-lbl">Keywords</div>
        </div>
        <div class="ai-score-box">
          <div class="ai-score-val" style="color:${scoreColour(ev.confidence_score)}">${ev.confidence_score}%</div>
          <div class="ai-score-lbl">Confidence</div>
        </div>
        ${visualBox}
      </div>

      <div class="ai-kw-row">
        ${(ev.found_keywords||[]).slice(0,6).map(k=>`<span class="kw-chip found">✓ ${k}</span>`).join('')}
        ${(ev.missed_keywords||[]).slice(0,5).map(k=>`<span class="kw-chip miss">✗ ${k}</span>`).join('')}
      </div>

      <div class="ai-feedback-block">
        <div class="ai-feedback-label">AI Feedback</div>
        <div class="ai-feedback-text">${ev.feedback}</div>
      </div>

      <div class="ai-ideal-block">
        <div class="ai-ideal-label">💡 What a great answer includes</div>
        <div class="ai-ideal-text">${ev.ideal_answer_summary}</div>
      </div>
    `;

    // Update next button label
    const isLast = this.currentIdx >= this.questions.length - 1;
    document.getElementById('aiNextBtn').textContent =
      isLast ? '🏁 See Session Summary' : 'Next Question →';

    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  // ── Chat bubble helpers ──────────────────────────────────
  _addBubble(role, text, isFollowup = false) {
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;

    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    div.innerHTML = `
      <div class="bubble-avatar">${role === 'ai' ? '🤖' : '🧑'}</div>
      <div class="bubble-content">
        <div class="bubble-name">${role === 'ai' ? 'AI Interviewer' : 'You'}</div>
        ${isFollowup ? '<div class="followup-pill">🔍 Follow-up Question</div>' : ''}
        <div class="bubble-text">${formattedText}</div>
      </div>`;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  },

  _addTypingBubble() {
    const container = document.getElementById('aiChatMessages');
    const div = document.createElement('div');
    div.className = 'chat-bubble ai typing-bubble';
    div.id = 'typingBubble_' + Date.now();
    div.innerHTML = `
      <div class="bubble-avatar">🤖</div>
      <div class="bubble-content">
        <div class="bubble-name">AI Interviewer</div>
        <div class="bubble-text">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div.id;
  },

  _removeTyping(id) {
    document.getElementById(id)?.remove();
  },

  // ── Session Summary ──────────────────────────────────────
  _showSessionSummary() {
    this.active = false;
    const results = this.sessionResults;
    if (results.length === 0) { this.endSession(); return; }

    const avg = arr => Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
    const avgOverall  = avg(results.map(r => r.overall_score));
    const avgKeywords = avg(results.map(r => r.keyword_score));
    const avgConf     = avg(results.map(r => r.confidence_score));

    const colour = s => s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--accent3)' : 'var(--red)';

    const summaryHtml = `
      <div class="session-summary">
        <div class="ss-title">🏁 Interview Complete — Session Summary</div>
        <div class="ss-grid">
          <div class="ss-item">
            <div class="ss-val" style="color:${colour(avgOverall)}">${avgOverall}%</div>
            <div class="ss-lbl">Overall</div>
          </div>
          <div class="ss-item">
            <div class="ss-val" style="color:${colour(avgKeywords)}">${avgKeywords}%</div>
            <div class="ss-lbl">Keywords</div>
          </div>
          <div class="ss-item">
            <div class="ss-val" style="color:${colour(avgConf)}">${avgConf}%</div>
            <div class="ss-lbl">Confidence</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
          Completed ${results.length} question${results.length !== 1 ? 's' : ''}
          ${results[0].visual !== null ? ' · Webcam analysis included' : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-primary" style="width:auto;flex:1" onclick="AIInterview.saveAllResults(); toast('All results saved!','success')">💾 Save All Results</button>
          <button class="btn-secondary" onclick="AIInterview.endSession()">↩ Back to Practice</button>
        </div>
      </div>`;

    const chatPanel = document.getElementById('aiChatPanel');
    chatPanel.insertAdjacentHTML('afterend', summaryHtml);
    chatPanel.querySelector('.ai-chat-messages')
      .scrollTop = chatPanel.querySelector('.ai-chat-messages').scrollHeight;

    // Update banner
    document.getElementById('aiSessionProgress').textContent = 'Session Complete';
    document.getElementById('aiNextBtn').textContent = '↩ Back to Practice';

    toast(`Session complete! Average score: ${avgOverall}%`, avgOverall >= 60 ? 'success' : 'info');
  },

  // ── End session & restore normal UI ─────────────────────
  endSession() {
    this.active = false;
    document.getElementById('aiSessionBanner').classList.add('hidden');
    document.getElementById('aiChatPanel').classList.add('hidden');
    document.getElementById('aiEvalCard').classList.add('hidden');
    document.querySelectorAll('.session-summary').forEach(el => el.remove());

    document.querySelector('.domain-card').style.opacity   = '';
    document.querySelector('.domain-card').style.pointerEvents = '';

    // Re-enable eval button logic
    document.getElementById('evalBtn').disabled = true;
    loadQuestion();
    toast('Returned to practice mode.', 'info');
  },

  // ── Save all session results to history ─────────────────
  saveAllResults() {
    this.sessionResults.forEach(r => {
      const entry = {
        id:       Date.now() + Math.random(),
        domain:   'Custom AI',
        question: r.question,
        g: r.grammar_score, k: r.keyword_score,
        c: r.confidence_score, v: r.visual,
        ov: r.overall_score,
        found: r.found_keywords, missed: r.missed_keywords,
        fb: r.feedback,
        date: new Date().toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })
      };
      App.history.unshift(entry);
    });
    if (App.history.length > 100) App.history.length = 100;
    sessionStorage.setItem('sp_history', JSON.stringify(App.history));
  },

  saveLastResult() {
    if (!this.lastAiResult) return;
    const r = this.lastAiResult;
    const entry = {
      id: Date.now(), domain: 'Custom AI',
      question: r.question, g: r.grammar_score,
      k: r.keyword_score, c: r.confidence_score, v: r.visual,
      ov: r.overall_score, fb: r.feedback,
      date: new Date().toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' })
    };
    App.history.unshift(entry);
    if (App.history.length > 100) App.history.pop();
    sessionStorage.setItem('sp_history', JSON.stringify(App.history));
    toast('Result saved!', 'success');
  },

  // ── Claude API call ──────────────────────────────────────
  async _callClaude(prompt, apiKey, maxTokens = 600) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  }
};

// ══════════════════════════════════════════════
//  Global bridge functions called from HTML
// ══════════════════════════════════════════════
function openCustomInterview()  { AIInterview.openModal(); }
function closeCustomInterview() { AIInterview.closeModal(); }
function startCustomInterview() { AIInterview.start(); }
function endCustomSession()     { AIInterview.endSession(); }
function aiNextQuestion()       { AIInterview.nextQuestion(); }
function saveAiSession()        { AIInterview.saveLastResult(); }

// ══════════════════════════════════════════════
//  Patch runEvaluation to route to AI engine
//  when AI interview is active
// ══════════════════════════════════════════════
const _origRunEvaluation = runEvaluation;
window.runEvaluation = function() {
  if (AIInterview.active) {
    const text = App.finalText.trim();
    if (!text || text.split(/\s+/).filter(Boolean).length < 3) {
      toast('Please record a longer answer first.', 'error');
      return;
    }
    AIInterview.handleAnswer(text);
  } else {
    _origRunEvaluation();
  }
};

// Patch loadNextQuestion to route to AI engine when active
const _origLoadNext = loadNextQuestion;
window.loadNextQuestion = function() {
  if (AIInterview.active) {
    AIInterview.nextQuestion();
  } else {
    _origLoadNext();
  }
};
