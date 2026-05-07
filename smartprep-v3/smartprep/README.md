# 🎤 SmartPrep v2 — AI Interview Practice System

Complete rebuild with fixed microphone, webcam confidence analysis, and IBM Watson STT support.

---

## 🚀 Running in VS Code (2 minutes)

### Recommended: Live Server Extension
1. Open the `smartprep` folder in VS Code
2. Install **Live Server** extension (by Ritwick Dey) if not already installed
3. Right-click `index.html` → **Open with Live Server**
4. Browser opens at `http://127.0.0.1:5500` ✅

### Alternative: Node.js
```bash
npx http-server . -p 3000 --cors -o
```

### Alternative: Python
```bash
python -m http.server 3000
# then open http://localhost:3000
```

> ⚠️ **Never open index.html directly** (file://) — microphone and webcam require HTTP.

---

## 🎙 Speech Recognition Modes

### Mode 1: Browser STT (Default — works instantly)
- Uses Chrome/Edge built-in speech recognition
- No API key needed
- Click **"Start Practicing Now"** on the setup screen
- ✅ Works in: Chrome, Edge, Safari (limited), Opera
- ❌ Not supported: Firefox (uses Watson fallback)

### Mode 2: IBM Watson STT (Premium accuracy)
1. Go to [cloud.ibm.com](https://cloud.ibm.com) and sign up free
2. Catalog → **Speech to Text** → Lite plan → Create
3. Manage → Credentials → copy **API Key** and **URL**
4. Click **"IBM Watson STT"** tab in setup and paste credentials

---

## 📸 Webcam Confidence Analysis

The webcam feature analyses:
- **Eye Contact** — whether your face is centred and visible
- **Posture** — whether you're sitting upright (face in upper frame)
- **Steadiness** — minimal fidgeting = calm confidence

Enable it by clicking **Camera Off** → **Camera On** in the app.

> 💡 **Tips for best results:**
> - Sit so your face fills the upper-centre of the webcam frame
> - Ensure good lighting (natural or desk lamp from front)
> - Look directly into the camera, not at your screen
> - Keep movements minimal while answering

---

## 📁 File Structure

```
smartprep/
├── index.html          — Main HTML layout
└── src/
    ├── style.css       — Complete styles (dark industrial theme)
    ├── app.js          — Main controller, state, UI logic
    ├── speech.js       — Speech engine (Browser STT + Watson)
    ├── webcam.js       — Webcam analysis (pixel-based, no ML libs)
    ├── evaluator.js    — Grammar / keyword / confidence scoring
    └── questions.js    — 35+ questions across 5 domains
```

---

## 🎯 Scoring System

| Dimension    | Method                              | Weight (with cam) |
|-------------|-------------------------------------|-------------------|
| Keywords     | Domain terms matched in answer      | 38%               |
| Grammar      | Filler words, structure, length     | 25%               |
| Confidence   | Assertive language, answer depth    | 22%               |
| Visual       | Eye contact, posture, steadiness    | 15%               |

---

## 🌐 Browser Support

| Browser  | Speech Recognition | Webcam |
|----------|--------------------|--------|
| Chrome   | ✅ Native           | ✅     |
| Edge     | ✅ Native           | ✅     |
| Safari   | ✅ (iOS 14.5+)      | ✅     |
| Firefox  | ❌ (use Watson)     | ✅     |
| Opera    | ✅ Native           | ✅     |

---

## ❓ Troubleshooting

**Microphone not working**
→ Ensure you open via Live Server (http://) not file://
→ Click the lock icon in browser address bar → allow Microphone
→ Try Chrome if using Firefox

**"Speech error: not-allowed"**
→ Browser denied microphone. Go to chrome://settings/content/microphone and allow localhost

**Webcam shows black screen**
→ Allow camera permission in browser
→ Close other apps using the camera (Zoom, Teams etc.)

**Watson connection fails**
→ Check your API key has no extra spaces
→ Ensure the URL ends with the instance ID, no trailing slash
→ App auto-falls back to Browser STT if Watson fails
