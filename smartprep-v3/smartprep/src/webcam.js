// ============================================================
//  SmartPrep — Webcam Confidence Analyser
//  Uses canvas pixel analysis (no external ML libs needed)
//  Measures: brightness, motion, face-region presence
// ============================================================
const WebcamAnalyser = {
  stream: null,
  active: false,
  intervalId: null,
  prevFrame: null,
  scores: { eye: 0, posture: 0, focus: 0, overall: 0 },
  samples: [],   // rolling last-30 samples for final score
  onUpdate: null, // callback(scores)

  async start(onUpdate) {
    this.onUpdate = onUpdate;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      const video = document.getElementById('webcamVideo');
      video.srcObject = this.stream;
      await video.play();
      this.active = true;
      this.samples = [];

      // Start analysis loop every 500ms
      this.intervalId = setInterval(() => this._analyse(), 500);
      return true;
    } catch (err) {
      console.warn('Webcam error:', err);
      return false;
    }
  },

  stop() {
    this.active = false;
    clearInterval(this.intervalId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    const video = document.getElementById('webcamVideo');
    video.srcObject = null;
    this.prevFrame = null;
  },

  _analyse() {
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('camCanvas');
    if (!video || !canvas || video.readyState < 2) return;

    const W = video.videoWidth  || 320;
    const H = video.videoHeight || 240;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, W, H);

    const frame = ctx.getImageData(0, 0, W, H);
    const data  = frame.data;

    // ── 1. Brightness (proxy for face presence + lighting) ──
    //    Sample centre region (middle 50% of frame)
    let brightnessSum = 0, brightCount = 0;
    const x0 = Math.floor(W * 0.25), x1 = Math.floor(W * 0.75);
    const y0 = Math.floor(H * 0.15), y1 = Math.floor(H * 0.85);
    for (let y = y0; y < y1; y += 4) {
      for (let x = x0; x < x1; x += 4) {
        const i = (y * W + x) * 4;
        const lum = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        brightnessSum += lum;
        brightCount++;
      }
    }
    const avgBrightness = brightnessSum / brightCount; // 0-255

    // ── 2. Skin-tone detection in face region ──
    //    Upper-centre quadrant likely contains face
    let skinPixels = 0, totalPixels = 0;
    const fx0 = Math.floor(W * 0.3), fx1 = Math.floor(W * 0.7);
    const fy0 = Math.floor(H * 0.05), fy1 = Math.floor(H * 0.55);
    for (let y = fy0; y < fy1; y += 3) {
      for (let x = fx0; x < fx1; x += 3) {
        const i = (y * W + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        if (this._isSkinTone(r, g, b)) skinPixels++;
        totalPixels++;
      }
    }
    const skinRatio = totalPixels > 0 ? skinPixels / totalPixels : 0;

    // ── 3. Motion detection (frame diff) ──
    let motionScore = 0;
    if (this.prevFrame) {
      let diffSum = 0, diffCount = 0;
      const pd = this.prevFrame.data;
      for (let i = 0; i < data.length; i += 16) {
        const diff = Math.abs(data[i] - pd[i]) + Math.abs(data[i+1] - pd[i+1]) + Math.abs(data[i+2] - pd[i+2]);
        diffSum += diff;
        diffCount++;
      }
      const avgDiff = diffSum / diffCount;
      // Low motion = steady = confident; very high motion = fidgeting
      // Ideal: slight movement (5-25), steady (0-5 ok too), excessive (>40) penalised
      if      (avgDiff < 3)   motionScore = 65;  // too still (possibly frozen)
      else if (avgDiff < 15)  motionScore = 95;  // natural movement — great
      else if (avgDiff < 30)  motionScore = 78;  // moderate movement
      else if (avgDiff < 50)  motionScore = 55;  // active movement
      else                    motionScore = 30;  // excessive movement — nervous
    } else {
      motionScore = 60;
    }
    this.prevFrame = frame;

    // ── Score Calculations ──
    // Eye contact (proxy: face centred, decent brightness, skin detected)
    const facePresent = skinRatio > 0.08;
    const goodLight   = avgBrightness > 40 && avgBrightness < 220;
    let eyeScore = 0;
    if (facePresent && goodLight) {
      eyeScore = Math.min(100, Math.round(60 + skinRatio * 120 + (goodLight ? 15 : 0)));
    } else if (facePresent) {
      eyeScore = 45;
    } else {
      eyeScore = 20;
    }

    // Posture (proxy: face in upper region means sitting upright)
    let postureScore = 0;
    let topSkin = 0, bottomSkin = 0, topTotal = 0, bottomTotal = 0;
    const midY = Math.floor(H / 2);
    for (let y = 0; y < H; y += 4) {
      for (let x = Math.floor(W*0.25); x < Math.floor(W*0.75); x += 4) {
        const i = (y * W + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        if (y < midY) { if (this._isSkinTone(r,g,b)) topSkin++; topTotal++; }
        else { if (this._isSkinTone(r,g,b)) bottomSkin++; bottomTotal++; }
      }
    }
    const topRatio    = topTotal    > 0 ? topSkin    / topTotal    : 0;
    const bottomRatio = bottomTotal > 0 ? bottomSkin / bottomTotal : 0;
    // More skin in top half = face is up = good posture
    if      (topRatio > bottomRatio * 2.5) postureScore = 90;
    else if (topRatio > bottomRatio * 1.5) postureScore = 75;
    else if (topRatio > bottomRatio)       postureScore = 58;
    else                                   postureScore = 35;

    // Focus = motion score (steady presence = focused)
    const focusScore = motionScore;

    // Overall visual confidence
    const overall = Math.round(eyeScore * 0.4 + postureScore * 0.3 + focusScore * 0.3);

    this.scores = { eye: eyeScore, posture: postureScore, focus: focusScore, overall };
    this.samples.push(overall);
    if (this.samples.length > 60) this.samples.shift();

    this.onUpdate?.(this.scores);
    this._drawOverlay(ctx, W, H, facePresent, eyeScore);
  },

  // Simple skin tone detection (works across various skin tones)
  _isSkinTone(r, g, b) {
    // Normalised RGB check (handles diverse skin tones)
    const sum = r + g + b;
    if (sum === 0) return false;
    const nr = r / sum, ng = g / sum;
    // Core skin conditions
    const c1 = r > 60 && g > 40 && b > 20;
    const c2 = r > g && r > b;
    const c3 = Math.abs(r - g) > 8;
    const c4 = nr > 0.33 && ng > 0.28;
    const c5 = r < 250; // not overexposed
    return c1 && c2 && c3 && c4 && c5;
  },

  // Draw minimal confidence overlay on canvas
  _drawOverlay(ctx, W, H, facePresent, eyeScore) {
    ctx.clearRect(0, 0, W, H); // Don't draw on video — overlays in HTML badges only
    // Draw face region guide box when face detected
    if (facePresent) {
      ctx.strokeStyle = eyeScore > 65
        ? 'rgba(0,245,196,0.5)'
        : 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      const bx = W * 0.28, by = H * 0.08;
      const bw = W * 0.44, bh = H * 0.52;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }
  },

  // Get final average score from session samples
  getFinalScore() {
    if (this.samples.length === 0) return null;
    return Math.round(this.samples.reduce((a,b) => a+b, 0) / this.samples.length);
  }
};
