export class AudioManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    _playOscillator(type, freqStart, freqEnd, duration, vol) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
        if (freqEnd) {
            osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + Math.max(0.01, duration));
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + Math.max(0.01, duration));

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    _playNoise(duration, vol, filterFreq) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // Pure White Noise
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + Math.max(0.01, duration));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        source.start();
    }

    playJump() {
        this._playOscillator('sine', 150, 400, 0.3, 0.4);
    }

    playStep() {
        this._playNoise(0.08, 0.15, 300); // Muted thud
    }

    playDig() {
        this._playNoise(0.12, 0.3, 800); // Dusty crash
    }

    playEggCollect(points) {
        const baseFreq = points === 30 ? 1200 : (points === 10 ? 800 : 400);
        this._playOscillator('triangle', baseFreq, baseFreq * 1.5, 0.4, 0.2); // Core Chime
        setTimeout(() => this._playOscillator('sine', baseFreq * 2, baseFreq * 3, 0.3, 0.1), 50); // Echo
    }

    playPowerup() {
        // Sweeping arpeggio
        this._playOscillator('square', 300, 1200, 0.4, 0.1);
        setTimeout(() => this._playOscillator('square', 400, 1600, 0.4, 0.1), 100);
        setTimeout(() => this._playOscillator('square', 500, 2000, 0.4, 0.1), 200);
    }

    playExplosion() {
        this._playNoise(1.5, 0.8, 1000); // 1.5 seconds of massive lowpass thunder
    }
}
