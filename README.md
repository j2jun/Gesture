# Gesture
Hand gesture recognition in the browser. Point your webcam at your hand (or pick a photo) and it names the gesture live, with the hand's skeleton drawn on top.

![Demo: the page naming peace, thumbs up, pointing up and thumbs down from photos](docs/demo.gif)

<img src="docs/screenshot.png" alt="Peace sign recognized at 91% with the hand skeleton drawn" width="62%"> <img src="docs/screenshot-dark-mobile.png" alt="Thumbs up recognized in dark mode on a phone" width="30%">

Recognizes: ✊ Fist · ✋ Open palm · ☝️ Pointing up · 👍 Thumbs up · 👎 Thumbs down · ✌️ Peace · 🤟 I love you

Runs entirely on your device with Google's [MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer). No server, no API key, and video never leaves the browser.

## Run it
It's one file, `index.html`, with no build step. Browsers only allow the camera on `https://` or `localhost`, so serve it instead of double-clicking the file:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or turn on GitHub Pages for this repo (Settings → Pages → deploy from `main`) to get an https link that works on phones too.

## How it works
1. MediaPipe's model finds up to two hands per frame and returns 21 landmarks each, plus a gesture label and confidence.
2. The page draws the frame and landmarks on a canvas and shows the label. Anything below 50% confidence is shown as "gesture unclear" instead of a guess.
3. Demo photos are MediaPipe's own gesture sample images.
4. Library version (`@mediapipe/tasks-vision@0.10.35`) and model URL are pinned at the top of the script.
