# Steamed Up

A bathroom mirror after a hot shower. Breathe on it to fog it up, then wipe it with your finger, or by pinching in the air.

Play it at **[ernkerr.github.io/steamed-up](https://ernkerr.github.io/steamed-up/)**.

## How it plays

- The mirror starts steamed up and slowly fogs back over, the way a real one does.
- Wipe it with your finger, a mouse, or, with the camera on, by pinching your thumb and finger together in the air.
- Blow on your microphone to fog it up again. No mic? Hold the breathe button, or the space bar.
- Water gathers at the bottom of a wipe and runs down in drips that leave clear trails.
- With the camera on, the reflection is you. Without it, it's the bathroom behind you, drawn flat.
- Save a picture of the mirror, or steam it all back up and start over.

Your camera and mic stay on your device. The hand tracking runs in the browser, and nothing is recorded or sent anywhere.

## How it's made

No build step and no framework. An HTML page, a stylesheet and a few JavaScript files:

- `js/fog.js`: the fog, kept as a grid of densities that steam fills in, breath thickens, wiping clears, and drips cut through.
- `js/hands.js`: air drawing with [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker), loaded only when the camera is on.
- `js/breath.js`: hears a breath as sound well above the room's usual level.
- `js/sound.js`: the squeak of a finger on wet glass, made with the Web Audio API.
- `js/scene.js`: the drawn bathroom, used when there's no camera.

Run it locally with `python3 -m http.server 8000` and open http://localhost:8000 (the camera needs `localhost` or HTTPS).

## Credits

Inspired by [Breath Mirror](https://breathmirror.github.io/). Hand tracking by Google's MediaPipe (Apache 2.0). Fonts from Google Fonts: Geist, Newsreader and Caveat (all OFL).

The code is MIT licensed.
