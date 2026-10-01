import fs from 'fs';
import { execSync } from 'child_process';

function generateWav(filename, duration, sampleGenerator) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = sampleGenerator(t, i, numSamples);
    s = Math.max(-1, Math.min(1, s));
    const intSample = Math.floor(s * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  fs.writeFileSync(filename, buffer);
}

// 1. Bell Generator (crisp dual chime)
function bellSample(t) {
  const playTone = (time, freq) => {
    if (t < time) return 0;
    const localT = t - time;
    if (localT > 2.0) return 0;
    const env = Math.exp(-localT * 3.5);
    const tone = Math.sin(2 * Math.PI * freq * localT);
    const harmonic = 0.15 * Math.sin(2 * Math.PI * (freq * 2) * localT);
    return (tone + harmonic) * env;
  };
  const tone1 = playTone(0.0, 880.0);
  const tone2 = playTone(0.3, 1108.73);
  return (tone1 + tone2) * 0.7;
}

// 2. Beep Generator (crisp chime)
function beepSample(t) {
  const dur = 0.14;
  if (t > dur) return 0;
  const env = Math.exp(-t * 22);
  const tone = Math.sin(2 * Math.PI * 1046.5 * t); // C6
  const sub = 0.3 * Math.sin(2 * Math.PI * 2093 * t); // C7
  return (tone + sub) * env * 0.7;
}

// Generate WAVs
generateWav('/tmp/bell.wav', 2.5, bellSample);
generateWav('/tmp/beep.wav', 0.2, beepSample);

// Convert to MP3
execSync('ffmpeg -y -i /tmp/bell.wav -codec:a libmp3lame -qscale:a 2 public/timer-end.mp3');
execSync('ffmpeg -y -i /tmp/beep.wav -codec:a libmp3lame -qscale:a 2 public/beep.mp3');

console.log('Audio files created in public/');
