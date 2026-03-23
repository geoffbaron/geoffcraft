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
        this.selectedSlot = 0;
        this.hotbarBlocks = PLACEABLE_BLOCKS.slice(0, 9);
        this.inventoryOpen = false;

        this.hotbarEl = document.getElementById('hotbar');
        this.inventoryEl = document.getElementById('inventory-screen');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.debugEl = document.getElementById('debug-info');

        this.buildHotbar();
        this.buildInventory();
        this.setupInput();
    }

    buildHotbar() {
        this.hotbarEl.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot' + (i === this.selectedSlot ? ' selected' : '');

            const num = document.createElement('span');
            num.className = 'slot-number';
            num.textContent = i + 1;
            slot.appendChild(num);

            if (this.hotbarBlocks[i]) {
                const icon = createBlockIcon(this.hotbarBlocks[i]);
                icon.className = 'block-icon';
                slot.appendChild(icon);
            }

            this.hotbarEl.appendChild(slot);
        }
    }

    buildInventory() {
        this.inventoryGrid.innerHTML = '';
        for (const blockType of PLACEABLE_BLOCKS) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';

            const icon = createBlockIcon(blockType);
            icon.className = 'block-icon';
            slot.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'block-name';
            name.textContent = BlockData[blockType].name;
            slot.appendChild(name);

            slot.addEventListener('click', () => {
                this.hotbarBlocks[this.selectedSlot] = blockType;
                this.buildHotbar();
            });

            this.inventoryGrid.appendChild(slot);
        }
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            // Number keys 1-9 for hotbar selection
            if (e.code >= 'Digit1' && e.code <= 'Digit9') {
                this.selectedSlot = parseInt(e.code.charAt(5)) - 1;
                this.buildHotbar();
            }

            // E for inventory
            if (e.code === 'KeyE') {
                this.toggleInventory();
            }
        });

        // Mouse wheel for hotbar scroll
        document.addEventListener('wheel', (e) => {
            if (this.inventoryOpen) return;
            if (e.deltaY > 0) {
                this.selectedSlot = (this.selectedSlot + 1) % 9;
            } else {
                this.selectedSlot = (this.selectedSlot + 8) % 9;
            }
            this.buildHotbar();
        });
    }

    toggleInventory() {
        this.inventoryOpen = !this.inventoryOpen;
        this.inventoryEl.classList.toggle('hidden', !this.inventoryOpen);
    }

    getSelectedBlock() {
        return this.hotbarBlocks[this.selectedSlot] || BlockType.STONE;
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
        
        this.hotbarEl.style.display = 'none';
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
