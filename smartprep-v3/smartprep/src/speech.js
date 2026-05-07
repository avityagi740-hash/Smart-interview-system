// ============================================================
//  SmartPrep — Speech Recognition Engine
//  Primary:  Web Speech API (works in all Chromium browsers)
//  Optional: IBM Watson STT via WebSocket
// ============================================================
const SpeechEngine = {
  mode: 'browser',   // 'browser' | 'watson'
  watsonKey: null,
  watsonUrl: null,
  recognition: null,   // Web Speech API instance
  watsonSocket: null,  // WebSocket for Watson
  mediaRecorder: null,
  audioStream: null,
  isRecording: false,
  finalText: '',
  interimText: '',
  onTranscript: null,   // (finalText, interimText) => void
  onStatus: null,       // (state: 'ready'|'recording'|'error'|'done', msg) => void
  waveAnalyser: null,
  waveAudioCtx: null,
  waveAnimId: null,

  configure(mode, key, url) {
    this.mode = mode;
    if (mode === 'watson') {
      this.watsonKey = key?.trim();
      this.watsonUrl = url?.trim().replace(/\/$/, '');
    }
  },

  // ── Start Recording ─────────────────────────────────────
  async start(onTranscript, onStatus) {
    this.onTranscript = onTranscript;
    this.onStatus     = onStatus;
    this.finalText    = '';
    this.interimText  = '';
    this.isRecording  = true;

    if (this.mode === 'watson' && this.watsonKey && this.watsonUrl) {
      await this._startWatson();
    } else {
      this._startBrowser();
    }
  },

  // ── Stop Recording ───────────────────────────────────────
  stop() {
    this.isRecording = false;
    if (this.mode === 'watson') {
      this._stopWatson();
    } else {
      this._stopBrowser();
    }
    this._stopWaveform();
    this.onStatus?.('done', 'Processing complete');
  },

  // ══════════════════════════════════════════
  //  BROWSER (Web Speech API)
  // ══════════════════════════════════════════
  _startBrowser() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.onStatus?.('error', 'Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    this.recognition = new SR();
    this.recognition.lang           = 'en-US';
    this.recognition.continuous     = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.onStatus?.('recording', 'Listening...');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          this.finalText += t + ' ';
        } else {
          interim += t;
        }
      }
      this.interimText = interim;
      this.onTranscript?.(this.finalText, this.interimText);
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        // Restart silently — common when user pauses
        if (this.isRecording) {
          try { this.recognition.start(); } catch(_) {}
        }
        return;
      }
      if (e.error === 'aborted') return; // user stopped — ignore
      this.onStatus?.('error', `Speech error: ${e.error}`);
    };

    this.recognition.onend = () => {
      // Auto-restart if still recording (browser stops after ~60s of silence)
      if (this.isRecording) {
        try { this.recognition.start(); } catch(_) {}
      }
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.onStatus?.('error', 'Could not start microphone: ' + err.message);
    }

    // Start waveform
    this._startWaveform();
  },

  _stopBrowser() {
    try {
      this.recognition?.abort();
    } catch (_) {}
    this.recognition = null;
  },

  // ══════════════════════════════════════════
  //  IBM WATSON STT (WebSocket)
  // ══════════════════════════════════════════
  async _startWatson() {
    try {
      // Get mic stream
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._startWaveform(this.audioStream);

      // Build WebSocket URL with auth embedded
      let wsUrl = this.watsonUrl
        .replace(/^https?:\/\//, '')
        .replace(/^wss?:\/\//, '');
      wsUrl = `wss://apikey:${this.watsonKey}@${wsUrl}/v1/recognize?model=en-US_BroadbandModel`;

      this.watsonSocket = new WebSocket(wsUrl);
      this.watsonSocket.binaryType = 'arraybuffer';

      this.watsonSocket.onopen = () => {
        // Send start recognition message
        this.watsonSocket.send(JSON.stringify({
          action: 'start',
          content_type: 'audio/webm;codecs=opus',
          interim_results: true,
          smart_formatting: true,
          profanity_filter: false
        }));
        this.onStatus?.('recording', 'Watson listening...');
        this._startMediaRecorder();
      };

      this.watsonSocket.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.results?.length) {
            const r = msg.results[0];
            const t = r.alternatives[0]?.transcript || '';
            if (r.final) { this.finalText += t + ' '; this.interimText = ''; }
            else         { this.interimText = t; }
            this.onTranscript?.(this.finalText, this.interimText);
          }
        } catch (_) {}
      };

      this.watsonSocket.onerror = () => {
        this.onStatus?.('error', 'Watson connection failed. Falling back to browser STT.');
        this._stopWatson();
        this._startBrowser(); // graceful fallback
      };

    } catch (err) {
      this.onStatus?.('error', 'Microphone access denied: ' + err.message);
    }
  },

  _startMediaRecorder() {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && this.watsonSocket?.readyState === WebSocket.OPEN) {
        this.watsonSocket.send(e.data);
      }
    };
    this.mediaRecorder.start(250);
  },

  _stopWatson() {
    try { this.mediaRecorder?.stop(); } catch (_) {}
    try {
      if (this.watsonSocket?.readyState === WebSocket.OPEN) {
        this.watsonSocket.send(JSON.stringify({ action: 'stop' }));
        setTimeout(() => this.watsonSocket?.close(), 1000);
      }
    } catch (_) {}
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
  },

  // ══════════════════════════════════════════
  //  WAVEFORM VISUALISER
  // ══════════════════════════════════════════
  async _startWaveform(stream) {
    try {
      // If stream not provided, get mic for visualisation
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this._waveOwnStream = stream;
      }
      this.waveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.waveAudioCtx.createMediaStreamSource(stream);
      this.waveAnalyser = this.waveAudioCtx.createAnalyser();
      this.waveAnalyser.fftSize = 512;
      src.connect(this.waveAnalyser);
      this._drawWave();
    } catch (_) {
      // Waveform is cosmetic — silent fail
    }
  },

  _drawWave() {
    const canvas = document.getElementById('waveCanvas');
    if (!canvas || !this.waveAnalyser) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 340;
    const H = 56;
    canvas.width  = W;
    canvas.height = H;

    const buf = new Uint8Array(this.waveAnalyser.frequencyBinCount);

    const frame = () => {
      this.waveAnimId = requestAnimationFrame(frame);
      this.waveAnalyser.getByteFrequencyData(buf);

      ctx.clearRect(0, 0, W, H);
      const barW = Math.max(2, (W / buf.length) * 2.2);
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const bh = (buf[i] / 255) * H;
        const grad = ctx.createLinearGradient(0, H, 0, H - bh);
        grad.addColorStop(0, 'rgba(0,245,196,0.9)');
        grad.addColorStop(1, 'rgba(124,58,237,0.5)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, H - bh, barW - 1, bh, 2);
        ctx.fill();
        x += barW + 1;
      }
    };
    frame();
  },

  _stopWaveform() {
    if (this.waveAnimId) { cancelAnimationFrame(this.waveAnimId); this.waveAnimId = null; }
    const canvas = document.getElementById('waveCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    try { this.waveAudioCtx?.close(); } catch(_) {}
    if (this._waveOwnStream) {
      this._waveOwnStream.getTracks().forEach(t => t.stop());
      this._waveOwnStream = null;
    }
  },

  reset() {
    this.finalText   = '';
    this.interimText = '';
    this.isRecording = false;
  }
};
