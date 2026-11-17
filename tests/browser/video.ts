import { probeVideoFile, upscaleVideoInApp, VIDEO_TARGETS } from '../../src/lib/tools/videoupscale';
const status = document.getElementById('status')!;
document.getElementById('run')!.onclick = async () => {
  try {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    const audio = new AudioContext();
    await audio.resume();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination); oscillator.start();
    const stream = canvas.captureStream(24); stream.addTrack(destination.stream.getAudioTracks()[0]);
    const source = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    source.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    source.start();
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = i % 2 ? 'blue' : 'red'; ctx.fillRect(0, 0, 64, 48);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await new Promise<void>((resolve) => { source.onstop = () => resolve(); source.stop(); });
    oscillator.stop(); await audio.close();
    stream.getTracks().forEach((t) => t.stop());
    const input = new Blob(chunks, { type: 'video/webm' });
    const meta = await probeVideoFile(input);
    const out = await upscaleVideoInApp(input, 'video.webm', meta, { modelId: 'fsr-easu-rcas', target: { ...VIDEO_TARGETS[0], longEdge: 64 }, fps: 24, format: 'webm', bitrateMbps: 12, keepAudio: true });
    const video = document.createElement('video'); video.src = URL.createObjectURL(out.blob);
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Output video unreadable')); });
    const captured = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
    if (!captured.getAudioTracks().length) throw new Error('Output has no audio track');
    const playback = new AudioContext();
    const analyser = playback.createAnalyser();
    playback.createMediaStreamSource(captured).connect(analyser);
    await playback.resume(); await video.play();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    const peak = Math.max(...samples.map(Math.abs));
    video.pause(); await playback.close(); captured.getTracks().forEach((t) => t.stop());
    URL.revokeObjectURL(video.src);
    if (peak < 0.01) throw new Error(`Output audio is silent (peak ${peak})`);
    status.textContent = 'PASS';
  } catch (error) { status.textContent = 'FAIL: ' + (error instanceof Error ? error.message : String(error)); }
};
