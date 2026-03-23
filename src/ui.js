import { BlockType, BlockData } from './blocks.js';
import { createBlockIcon } from './textures.js';

// Available blocks for the player
const PLACEABLE_BLOCKS = [
    BlockType.GRASS,
    BlockType.DIRT,
    BlockType.STONE,
    BlockType.COBBLESTONE,
    BlockType.PLANKS,
    BlockType.WOOD,
    BlockType.SAND,
    BlockType.GLASS,
    BlockType.BRICK,
    BlockType.LEAVES,
    BlockType.SNOW,
    BlockType.GRAVEL,
    BlockType.COAL_ORE,
    BlockType.IRON_ORE,
];

export class UI {
    constructor() {
        this.debugEl = document.getElementById('debug-info');
    }

    updateDebugInfo(player, fps) {
        const pos = player.position;
        this.debugEl.innerHTML = [
            `EasterCraft`,
            `FPS: ${fps}`,
            `XYZ: ${pos.x.toFixed(1)} / ${pos.y.toFixed(1)} / ${pos.z.toFixed(1)}`,
            `Chunk: ${Math.floor(pos.x / 16)}, ${Math.floor(pos.z / 16)}`,
        ].filter(Boolean).join('<br>');
    }

    updateHunterHUD(timeRemaining, eggs) {
        if (!document.getElementById('time-left')) return;
        let mins = Math.floor(timeRemaining / 60);
        let secs = Math.floor(timeRemaining % 60).toString().padStart(2, '0');
        document.getElementById('time-left').textContent = `Time: ${mins}:${secs}`;
        document.getElementById('eggs-found').textContent = `Eggs Found: ${eggs}`;
    }

    showGameOver(eggs) {
        document.getElementById('final-score').textContent = eggs;
        const screen = document.getElementById('game-over-screen');
        screen.classList.remove('hidden');
        
        
        document.getElementById('crosshair').style.display = 'none';
        document.getElementById('hunter-hud').style.display = 'none';
        
        const submitBtn = document.getElementById('submit-score-btn');
        if (submitBtn) {
            submitBtn.onclick = async () => {
                const name = document.getElementById('player-name-input').value.trim() || 'Anonymous';
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
                
                try {
                    const res = await fetch('/score', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, score: eggs })
                    });
                    
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || `Server responded with status ${res.status}`);
                    }
                    
                    const leaderboard = await res.json();
                    this.renderLeaderboard(leaderboard);
                } catch (err) {
                    console.error("Frontend Submit Error:", err);
                    submitBtn.textContent = 'Error saving';
                }
            };
        }
        this.fetchLeaderboard();
    }

    async fetchLeaderboard() {
        try {
            const res = await fetch('/leaderboard');
            if (res.ok) {
                const data = await res.json();
                this.renderLeaderboard(data);
            }
        } catch (e) { }
    }

    renderLeaderboard(scores) {
        const form = document.getElementById('submission-form');
        if(form) form.classList.add('hidden');
        
        const lbEl = document.getElementById('leaderboard-list');
        lbEl.classList.remove('hidden');
        lbEl.innerHTML = '<h3 style="color:#ea6;margin-bottom:10px;">Top Hunters</h3>';
        
        scores.forEach((s, idx) => {
            const entry = document.createElement('div');
            entry.className = 'lb-entry';
            entry.innerHTML = `<span class="lb-rank">#${idx + 1}</span><span class="lb-name">${s.name}</span><span class="lb-score">${s.score}</span>`;
            lbEl.appendChild(entry);
        });
    }
}
