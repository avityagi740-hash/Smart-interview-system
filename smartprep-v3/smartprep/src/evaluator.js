// ============================================================
//  SmartPrep — Answer Evaluator
// ============================================================
const Evaluator = {
  grammar(text) {
    if (!text || text.trim().split(/\s+/).length < 3) return 0;
    let score = 100;
    const lower = text.toLowerCase();
    const words = text.trim().split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2);
    const fillers = ["um","uh","like","you know","basically","literally","so basically","kind of","sort of","i mean","actually actually"];
    fillers.forEach(f => { const c = (lower.split(f).length - 1); if (c > 0) score -= Math.min(c * 5, 18); });
    for (let i = 1; i < words.length; i++) { if (words[i].toLowerCase() === words[i-1].toLowerCase() && words[i].length > 2) score -= 5; }
    if (words.length > 30) score += 5;
    if (words.length > 60) score += 5;
    if (sentences.length >= 3) score += 5;
    if (words.length < 10) score -= 25;
    if (words.length < 5)  score -= 30;
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  keywords(text, expected) {
    if (!text || !expected?.length) return 0;
    const lower = text.toLowerCase();
    const found = expected.filter(kw => lower.includes(kw.toLowerCase()));
    return Math.round((found.length / expected.length) * 100);
  },

  kwAnalysis(text, expected) {
    if (!text || !expected) return { found: [], missed: [] };
    const lower = text.toLowerCase();
    return {
      found:  expected.filter(kw => lower.includes(kw.toLowerCase())),
      missed: expected.filter(kw => !lower.includes(kw.toLowerCase())).slice(0, 5)
    };
  },

  confidence(text) {
    if (!text || text.trim().split(/\s+/).length < 3) return 0;
    const lower = text.toLowerCase();
    const words = text.trim().split(/\s+/);
    let score = 50;
    const assertive = ["i think","i believe","i would","i can","this means","the key","importantly","specifically","for example","such as","which means","therefore","clearly","in summary","to summarize"];
    const uncertain = ["i'm not sure","maybe","i guess","i don't know","possibly","might be","not really","kind of","sort of"];
    assertive.forEach(p => { if (lower.includes(p)) score += 4; });
    uncertain.forEach(p => { if (lower.includes(p)) score -= 6; });
    if (words.length > 20)  score += 8;
    if (words.length > 50)  score += 8;
    if (words.length > 100) score += 4;
    if (words.length < 10)  score -= 20;
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  overall(g, k, c, v) {
    // v = visual confidence (optional)
    if (v !== null && v !== undefined) {
      return Math.round(k * 0.38 + g * 0.25 + c * 0.22 + v * 0.15);
    }
    return Math.round(k * 0.45 + g * 0.30 + c * 0.25);
  },

  feedback(g, k, c, v, domain) {
    const ov = this.overall(g, k, c, v);
    let fb = "";
    if      (ov >= 80) fb += "🎉 Excellent answer! Strong technical knowledge and clear communication. ";
    else if (ov >= 60) fb += "👍 Good effort! You covered the key concepts reasonably well. ";
    else if (ov >= 40) fb += "📚 Fair attempt. Strengthening your answer with more depth will help. ";
    else               fb += "💪 Keep practicing! Focus on covering core concepts more thoroughly. ";

    if (g >= 80)       fb += "Your sentence structure and delivery were solid. ";
    else if (g < 55)   fb += "Try to cut filler words (um, uh, like) for a more polished delivery. ";

    if (k >= 70)       fb += `You used the right ${domain} vocabulary — impressive! `;
    else if (k < 40)   fb += `Focus on including key ${domain} terms to show depth. `;

    if (c >= 70)       fb += "You spoke assertively and with conviction. ";
    else if (c < 40)   fb += "Speak more confidently — avoid phrases like 'I'm not sure' or 'maybe'. ";

    if (v !== null && v !== undefined) {
      if (v >= 70)     fb += "Your body language and eye contact conveyed strong visual confidence. ";
      else if (v < 45) fb += "Maintain eye contact with the camera and sit upright to project confidence. ";
    }
    return fb.trim();
  }
};
