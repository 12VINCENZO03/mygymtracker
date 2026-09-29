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

// 1. Whistle Generator
function whistleSample(t) {
  // Blasts:
  // Blast 1: 0.05 to 0.45
  // Blast 2: 0.60 to 1.00
  // Blast 3: 1.15 to 2.45
  let blastEnv = 0;
  const inRange = (t, start, end) => t >= start && t <= end;
  
  const envelope = (t, start, end) => {
    const dur = end - start;
    const progress = (t - start) / dur;
    const attack = Math.min(1, (t - start) / 0.03); // 30ms attack
    const decay = Math.min(1, (end - t) / 0.05); // 50ms release
    return attack * decay;
  };

  if (inRange(t, 0.05, 0.45)) {
    blastEnv = envelope(t, 0.05, 0.45);
  } else if (inRange(t, 0.60, 1.00)) {
    blastEnv = envelope(t, 0.60, 1.00);
  } else if (inRange(t, 1.15, 2.45)) {
    blastEnv = envelope(t, 1.15, 2.45);
  } else {
    return 0;
  }

  // Dual tone typical of referee whistles + pea modulation
  const flutter = 1 + 0.15 * Math.sin(2 * Math.PI * 33 * t);
  const freq1 = 2820 * flutter;
  const freq2 = 3180 * flutter;
  const tone1 = Math.sin(2 * Math.PI * freq1 * t);
  const tone2 = Math.sin(2 * Math.PI * freq2 * t);
  const harmonic = 0.2 * Math.sin(2 * Math.PI * (freq1 * 2) * t);
  const noise = (Math.random() * 2 - 1) * 0.12;

  const raw = (tone1 * 0.45 + tone2 * 0.45 + harmonic + noise) * blastEnv;
  return raw * 0.85;
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
generateWav('/tmp/whistle.wav', 2.6, whistleSample);
generateWav('/tmp/beep.wav', 0.2, beepSample);

// Convert to MP3
execSync('ffmpeg -y -i /tmp/whistle.wav -codec:a libmp3lame -qscale:a 2 public/timer-end.mp3');
execSync('ffmpeg -y -i /tmp/beep.wav -codec:a libmp3lame -qscale:a 2 public/beep.mp3');

console.log('Audio files created in public/');
