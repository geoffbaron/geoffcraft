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
            `GeoffCraft`,
            `FPS: ${fps}`,
            `XYZ: ${pos.x.toFixed(1)} / ${pos.y.toFixed(1)} / ${pos.z.toFixed(1)}`,
            `Chunk: ${Math.floor(pos.x / 16)}, ${Math.floor(pos.z / 16)}`,
            player.flying ? `<span style="color:#7ef">✦ Flying (double-tap Space to land)</span>` : '',
        ].filter(Boolean).join('<br>');
    }
}
