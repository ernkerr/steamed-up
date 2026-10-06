// Hearing a breath on the mirror. Blowing on a microphone is loud,
// rushing noise, so this listens for sound well above the room's usual
// level. (Talking to the mirror fogs it a little too, which seems right.)
//
// The microphone is only listened to here, in the browser. Nothing is
// recorded or sent.

export function listen(stream, ctx) {
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let room = 0.01;

  // How hard you're breathing right now, 0 when you aren't.
  return () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    // The room's level drifts slowly with the quiet moments.
    if (rms < room * 2) room = room * 0.99 + rms * 0.01;
    const threshold = Math.max(0.02, room * 3);
    return Math.max(0, rms - threshold) * 12;
  };
}
