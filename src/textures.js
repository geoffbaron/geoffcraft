import { BlockType, BlockColors } from './blocks.js';
import * as THREE from 'three';

// Generate procedural pixel-art textures for each block
const TEX_SIZE = 16;

function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    return canvas;
}

function noise(x, y, seed = 0) {
    let n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
    return n - Math.floor(n);
}

function drawPixelNoise(ctx, baseR, baseG, baseB, variation = 0.08) {
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y) - 0.5) * variation;
            const r = Math.max(0, Math.min(1, baseR + n));
            const g = Math.max(0, Math.min(1, baseG + n));
            const b = Math.max(0, Math.min(1, baseB + n));
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = r * 255;
            imageData.data[idx + 1] = g * 255;
            imageData.data[idx + 2] = b * 255;
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

function generateGrassTop() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.GRASS].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 1) - 0.5) * 0.15;
            const n2 = (noise(x * 3, y * 3, 2) - 0.5) * 0.05;
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n + n2) * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n * 0.5 + n2) * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n + n2) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateGrassSide() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const dirt = BlockColors[BlockType.GRASS].side;
    const grass = BlockColors[BlockType.GRASS].sideTop;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 3) - 0.5) * 0.1;
            const grassLine = 3 + Math.floor(noise(x, 0, 5) * 2);
            const isGrass = y < grassLine;
            const c = isGrass ? grass : dirt;
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n) * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n) * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateStone() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.STONE].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n1 = (noise(x, y, 10) - 0.5) * 0.15;
            const n2 = (noise(x * 2, y * 2, 11) - 0.5) * 0.08;
            // Add crack-like dark lines
            const crack = (noise(x + y * 0.5, y * 0.7, 12) > 0.85) ? -0.1 : 0;
            const idx = (y * TEX_SIZE + x) * 4;
            const v = c[0] + n1 + n2 + crack;
            imageData.data[idx] = Math.max(0, Math.min(255, v * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, v * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (v + 0.02) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateWood() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.WOOD].side;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 20) - 0.5) * 0.08;
            // Vertical bark lines
            const bark = ((x % 4 === 0) || (x % 4 === 1 && noise(x, y, 21) > 0.6)) ? -0.06 : 0;
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n + bark) * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n + bark) * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n + bark) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateWoodTop() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.WOOD].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2;
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const ring = Math.sin(dist * 1.5) * 0.05;
            const n = (noise(x, y, 22) - 0.5) * 0.06;
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + ring + n) * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + ring + n) * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + ring + n) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateLeaves() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.LEAVES].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 30) - 0.5) * 0.2;
            const hole = noise(x * 2, y * 2, 31) > 0.82;
            const idx = (y * TEX_SIZE + x) * 4;
            if (hole) {
                imageData.data[idx] = (c[0] - 0.08) * 255;
                imageData.data[idx + 1] = (c[1] - 0.15) * 255;
                imageData.data[idx + 2] = (c[2] - 0.05) * 255;
            } else {
                imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n) * 255));
                imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n * 0.7) * 255));
                imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n) * 255));
            }
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateSimpleTexture(blockType, seed = 0) {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[blockType]?.top || [0.5, 0.5, 0.5];
    drawPixelNoise(ctx, c[0], c[1], c[2], 0.1);
    return canvas;
}

function generateBrick() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.BRICK].side;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 40) - 0.5) * 0.06;
            // Brick pattern
            const row = Math.floor(y / 4);
            const offset = (row % 2) * 8;
            const isMortar = (y % 4 === 0) || ((x + offset) % 16 === 0);
            const idx = (y * TEX_SIZE + x) * 4;
            if (isMortar) {
                imageData.data[idx] = 0.75 * 255;
                imageData.data[idx + 1] = 0.72 * 255;
                imageData.data[idx + 2] = 0.68 * 255;
            } else {
                imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n) * 255));
                imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n) * 255));
                imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n) * 255));
            }
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateOre(blockType, oreColor) {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const stoneC = BlockColors[BlockType.STONE].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 50) - 0.5) * 0.12;
            const isOre = noise(x * 1.5, y * 1.5, blockType * 7) > 0.65;
            const c = isOre ? oreColor : stoneC;
            const idx = (y * TEX_SIZE + x) * 4;
            imageData.data[idx] = Math.max(0, Math.min(255, (c[0] + n) * 255));
            imageData.data[idx + 1] = Math.max(0, Math.min(255, (c[1] + n) * 255));
            imageData.data[idx + 2] = Math.max(0, Math.min(255, (c[2] + n) * 255));
            imageData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateGlass() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.GLASS].top;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
            const idx = (y * TEX_SIZE + x) * 4;
            if (isBorder) {
                imageData.data[idx] = c[0] * 200;
                imageData.data[idx + 1] = c[1] * 200;
                imageData.data[idx + 2] = c[2] * 200;
                imageData.data[idx + 3] = 220;
            } else {
                imageData.data[idx] = c[0] * 255;
                imageData.data[idx + 1] = c[1] * 255;
                imageData.data[idx + 2] = c[2] * 255;
                imageData.data[idx + 3] = 60;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateEasterEgg() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = BlockColors[BlockType.EASTER_EGG].side;
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const dot = Math.sin(x * 1.5) * Math.sin(y * 1.5) > 0.4;
            const idx = (y * TEX_SIZE + x) * 4;
            if (dot) {
                imageData.data[idx] = 255;
                imageData.data[idx+1] = 220;
                imageData.data[idx+2] = 100;
            } else {
                imageData.data[idx] = c[0] * 255;
                imageData.data[idx+1] = c[1] * 255;
                imageData.data[idx+2] = c[2] * 255;
            }
            imageData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateGoldenEgg() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const idx = (y * TEX_SIZE + x) * 4;
            const streak = Math.sin(x * 5 + y * 5) > 0.8 ? 255 : 200; // shiny streak
            imageData.data[idx] = 255;
            imageData.data[idx+1] = streak;
            imageData.data[idx+2] = 0;
            imageData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateDiamondEgg() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const idx = (y * TEX_SIZE + x) * 4;
            const streak = Math.sin(x * 8 - y * 3) > 0.85 ? 255 : 200;
            const isSparkle = noise(x*4, y*4, 99) > 0.9;
            imageData.data[idx] = isSparkle ? 255 : 50;
            imageData.data[idx+1] = isSparkle ? 255 : Math.floor(streak * 0.8);
            imageData.data[idx+2] = isSparkle ? 255 : streak;
            imageData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generateLava() {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const idx = (y * TEX_SIZE + x) * 4;
            const heat = noise(x*2, y*2, 2024);
            imageData.data[idx] = 255;
            imageData.data[idx+1] = Math.floor(heat * 130);
            imageData.data[idx+2] = 0;
            imageData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

function generatePowerup(type) {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const c = TEX_SIZE / 2;
    
    if (type === BlockType.MUSHROOM) {
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(c/2, c/2, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(c*1.5, c/2, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(c, c*1.3, 4, 0, Math.PI*2); ctx.fill();
    } else if (type === BlockType.FEATHER) {
        ctx.fillStyle = '#00ffff'; // Neon cyan instead of blending gray
        ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(4, TEX_SIZE-4); ctx.lineTo(TEX_SIZE-4, 4); ctx.stroke();
    } else if (type === BlockType.FROG) {
        ctx.fillStyle = '#22aa22';
        ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(c/2, c/2, 4, 4);
        ctx.fillRect(c*1.5 - 4, c/2, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c/2 + 2, c/2 + 1, 2, 2);
        ctx.fillRect(c*1.5 - 2, c/2 + 1, 2, 2);
    }
    return canvas;
}

function canvasToTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Build a texture atlas and return UV lookup
export function createTextureAtlas() {
    // Generate individual textures per block face
    const faceTextures = {};

    // Grass: different top, side, bottom
    faceTextures[BlockType.GRASS] = {
        top: canvasToTexture(generateGrassTop()),
        side: canvasToTexture(generateGrassSide()),
        bottom: canvasToTexture(generateSimpleTexture(BlockType.DIRT)),
    };

    // Dirt
    const dirtTex = canvasToTexture(generateSimpleTexture(BlockType.DIRT));
    faceTextures[BlockType.DIRT] = { top: dirtTex, side: dirtTex, bottom: dirtTex };

    // Stone
    const stoneTex = canvasToTexture(generateStone());
    faceTextures[BlockType.STONE] = { top: stoneTex, side: stoneTex, bottom: stoneTex };

    // Sand
    const sandTex = canvasToTexture(generateSimpleTexture(BlockType.SAND));
    faceTextures[BlockType.SAND] = { top: sandTex, side: sandTex, bottom: sandTex };

    // Water
    const waterCanvas = createCanvas();
    const waterCtx = waterCanvas.getContext('2d');
    drawPixelNoise(waterCtx, 0.2, 0.4, 0.8, 0.08);
    const waterTex = canvasToTexture(waterCanvas);
    faceTextures[BlockType.WATER] = { top: waterTex, side: waterTex, bottom: waterTex };

    // Wood
    const woodSideTex = canvasToTexture(generateWood());
    const woodTopTex = canvasToTexture(generateWoodTop());
    faceTextures[BlockType.WOOD] = { top: woodTopTex, side: woodSideTex, bottom: woodTopTex };

    // Leaves
    const leavesTex = canvasToTexture(generateLeaves());
    faceTextures[BlockType.LEAVES] = { top: leavesTex, side: leavesTex, bottom: leavesTex };

    // Simple blocks
    for (const type of [BlockType.COBBLESTONE, BlockType.PLANKS, BlockType.SNOW, BlockType.BEDROCK, BlockType.GRAVEL]) {
        const tex = canvasToTexture(generateSimpleTexture(type));
        faceTextures[type] = { top: tex, side: tex, bottom: tex };
    }

    // Ores
    const coalTex = canvasToTexture(generateOre(BlockType.COAL_ORE, [0.15, 0.15, 0.15]));
    faceTextures[BlockType.COAL_ORE] = { top: coalTex, side: coalTex, bottom: coalTex };
    const ironTex = canvasToTexture(generateOre(BlockType.IRON_ORE, [0.72, 0.6, 0.5]));
    faceTextures[BlockType.IRON_ORE] = { top: ironTex, side: ironTex, bottom: ironTex };

    // Glass
    const glassTex = canvasToTexture(generateGlass());
    faceTextures[BlockType.GLASS] = { top: glassTex, side: glassTex, bottom: glassTex };

    // Brick
    const brickTex = canvasToTexture(generateBrick());
    faceTextures[BlockType.BRICK] = { top: brickTex, side: brickTex, bottom: brickTex };

    // Ice — semi-transparent blue with crackle pattern
    const iceCanvas = createCanvas();
    const iceCtx = iceCanvas.getContext('2d');
    const iceData = iceCtx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 60) - 0.5) * 0.08;
            const crack = (noise(x + y * 0.7, y * 0.9, 61) > 0.78) ? -0.12 : 0;
            const idx = (y * TEX_SIZE + x) * 4;
            iceData.data[idx]     = Math.max(0, Math.min(255, (0.55 + n + crack) * 255));
            iceData.data[idx + 1] = Math.max(0, Math.min(255, (0.75 + n + crack * 0.5) * 255));
            iceData.data[idx + 2] = Math.max(0, Math.min(255, (0.95 + n) * 255));
            iceData.data[idx + 3] = 200;
        }
    }
    iceCtx.putImageData(iceData, 0, 0);
    const iceTex = canvasToTexture(iceCanvas);
    faceTextures[BlockType.ICE] = { top: iceTex, side: iceTex, bottom: iceTex };

    // Mossy cobblestone — stone with green patches
    const mossyCanvas = createCanvas();
    const mossyCtx = mossyCanvas.getContext('2d');
    const mossyData = mossyCtx.createImageData(TEX_SIZE, TEX_SIZE);
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const n = (noise(x, y, 70) - 0.5) * 0.1;
            const mossy = noise(x * 1.2, y * 1.2, 71) > 0.6;
            const idx = (y * TEX_SIZE + x) * 4;
            if (mossy) {
                mossyData.data[idx]     = Math.max(0, Math.min(255, (0.25 + n) * 255));
                mossyData.data[idx + 1] = Math.max(0, Math.min(255, (0.45 + n) * 255));
                mossyData.data[idx + 2] = Math.max(0, Math.min(255, (0.2 + n) * 255));
            } else {
                mossyData.data[idx]     = Math.max(0, Math.min(255, (0.42 + n) * 255));
                mossyData.data[idx + 1] = Math.max(0, Math.min(255, (0.42 + n) * 255));
                mossyData.data[idx + 2] = Math.max(0, Math.min(255, (0.42 + n) * 255));
            }
            mossyData.data[idx + 3] = 255;
        }
    }
    mossyCtx.putImageData(mossyData, 0, 0);
    const mossyTex = canvasToTexture(mossyCanvas);
    faceTextures[BlockType.MOSSY_COBBLE] = { top: mossyTex, side: mossyTex, bottom: mossyTex };

    const eggTex = canvasToTexture(generateEasterEgg());
    faceTextures[BlockType.EASTER_EGG] = { top: eggTex, side: eggTex, bottom: eggTex };

    const goldenEggTex = canvasToTexture(generateGoldenEgg());
    faceTextures[BlockType.GOLDEN_EGG] = { top: goldenEggTex, side: goldenEggTex, bottom: goldenEggTex };

    const diamondEggTex = canvasToTexture(generateDiamondEgg());
    faceTextures[BlockType.DIAMOND_EGG] = { top: diamondEggTex, side: diamondEggTex, bottom: diamondEggTex };

    const lavaTex = canvasToTexture(generateLava());
    faceTextures[BlockType.LAVA] = { top: lavaTex, side: lavaTex, bottom: lavaTex };

    const meshTex = canvasToTexture(generatePowerup(BlockType.MUSHROOM));
    faceTextures[BlockType.MUSHROOM] = { top: meshTex, side: meshTex, bottom: meshTex };

    const featherTex = canvasToTexture(generatePowerup(BlockType.FEATHER));
    faceTextures[BlockType.FEATHER] = { top: featherTex, side: featherTex, bottom: featherTex };

    const frogTex = canvasToTexture(generatePowerup(BlockType.FROG));
    faceTextures[BlockType.FROG] = { top: frogTex, side: frogTex, bottom: frogTex };

    const candyRedTex = canvasToTexture(generateSimpleTexture(BlockType.CANDY_RED));
    faceTextures[BlockType.CANDY_RED] = { top: candyRedTex, side: candyRedTex, bottom: candyRedTex };

    const candyWhiteTex = canvasToTexture(generateSimpleTexture(BlockType.CANDY_WHITE));
    faceTextures[BlockType.CANDY_WHITE] = { top: candyWhiteTex, side: candyWhiteTex, bottom: candyWhiteTex };
    
    // Candy Blue has a white swirl!
    const candyBlueCanvas = createCanvas();
    const cbCtx = candyBlueCanvas.getContext('2d');
    const cbData = cbCtx.createImageData(TEX_SIZE, TEX_SIZE);
    const cbc = BlockColors[BlockType.CANDY_BLUE].top;
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const idx = (y * TEX_SIZE + x) * 4;
            const dist = Math.sqrt((x - 8) ** 2 + (y - 8) ** 2);
            const angle = Math.atan2(y - 8, x - 8);
            const swirl = (dist * 0.8 + angle * 2) % (Math.PI * 2) > Math.PI;
            if (swirl) {
                cbData.data[idx] = 255; cbData.data[idx+1] = 255; cbData.data[idx+2] = 255;
            } else {
                cbData.data[idx] = cbc[0]*255; cbData.data[idx+1] = cbc[1]*255; cbData.data[idx+2] = cbc[2]*255;
            }
            cbData.data[idx+3] = 255;
        }
    }
    cbCtx.putImageData(cbData, 0, 0);
    const candyBlueTex = canvasToTexture(candyBlueCanvas);
    faceTextures[BlockType.CANDY_BLUE] = { top: candyBlueTex, side: candyBlueTex, bottom: candyBlueTex };

    return faceTextures;
}

// Create small icon canvases for the hotbar/inventory
export function createBlockIcon(blockType) {
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');
    const c = BlockColors[blockType];
    if (!c) return canvas;

    // Draw an isometric-ish block icon
    const top = c.top;
    const side = c.side;

    // Top face
    ctx.fillStyle = `rgb(${top[0]*255},${top[1]*255},${top[2]*255})`;
    ctx.beginPath();
    ctx.moveTo(18, 4);
    ctx.lineTo(34, 12);
    ctx.lineTo(18, 20);
    ctx.lineTo(2, 12);
    ctx.closePath();
    ctx.fill();

    // Left face (darker)
    ctx.fillStyle = `rgb(${side[0]*180},${side[1]*180},${side[2]*180})`;
    ctx.beginPath();
    ctx.moveTo(2, 12);
    ctx.lineTo(18, 20);
    ctx.lineTo(18, 34);
    ctx.lineTo(2, 26);
    ctx.closePath();
    ctx.fill();

    // Right face
    ctx.fillStyle = `rgb(${side[0]*220},${side[1]*220},${side[2]*220})`;
    ctx.beginPath();
    ctx.moveTo(34, 12);
    ctx.lineTo(18, 20);
    ctx.lineTo(18, 34);
    ctx.lineTo(34, 26);
    ctx.closePath();
    ctx.fill();

    return canvas;
}
