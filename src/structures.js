import { BlockType } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function placeBlock(chunk, wx, wy, wz, type, ox, oz) {
    const lx = wx - ox, lz = wz - oz;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && wy >= 0 && wy < CHUNK_HEIGHT) {
        chunk.setBlock(lx, wy, lz, type);
    }
}

function fillBox(chunk, x1, y1, z1, x2, y2, z2, type, ox, oz) {
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++)
            for (let z = z1; z <= z2; z++)
                placeBlock(chunk, x, y, z, type, ox, oz);
}

function hollowBox(chunk, x1, y1, z1, x2, y2, z2, type, ox, oz) {
    for (let x = x1; x <= x2; x++)
        for (let y = y1; y <= y2; y++)
            for (let z = z1; z <= z2; z++)
                if (x===x1||x===x2||z===z1||z===z2||y===y1||y===y2)
                    placeBlock(chunk, x, y, z, type, ox, oz);
}

// Deterministic per-chunk hash
export function chunkStructureHash(cx, cz) {
    let h = (cx * 1664525 + cz * 1013904223) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return Math.abs(h ^ (h >>> 16));
}

// ── Village sub-structures ────────────────────────────────────────────────────

function placeHouse(chunk, cx, y, cz, ox, oz, variant) {
    const W = 7 + (variant % 3) * 2; // 7, 9, or 11 wide
    const D = 9;
    const WALL_H = 4;
    const x1 = cx - Math.floor(W / 2), x2 = cx + Math.floor(W / 2);
    const z1 = cz - Math.floor(D / 2), z2 = cz + Math.floor(D / 2);

    // Clear space
    fillBox(chunk, x1 - 1, y, z1 - 1, x2 + 1, y + WALL_H + 4, z2 + 1, BlockType.AIR, ox, oz);

    // Foundation
    fillBox(chunk, x1 - 1, y - 1, z1 - 1, x2 + 1, y - 1, z2 + 1, BlockType.COBBLESTONE, ox, oz);

    // Walls — alternate planks / stone for variety
    const wallBlock = (variant % 2 === 0) ? BlockType.PLANKS : BlockType.COBBLESTONE;
    hollowBox(chunk, x1, y, z1, x2, y + WALL_H - 1, z2, wallBlock, ox, oz);

    // Plank floor
    fillBox(chunk, x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, BlockType.PLANKS, ox, oz);

    // Door (south face)
    const midX = cx;
    placeBlock(chunk, midX,     y,     z2, BlockType.AIR, ox, oz);
    placeBlock(chunk, midX,     y + 1, z2, BlockType.AIR, ox, oz);

    // Glass windows
    for (const wx of [x1 + 2, x2 - 2]) {
        placeBlock(chunk, wx, y + 2, z1, BlockType.GLASS, ox, oz);
        placeBlock(chunk, wx, y + 2, z2, BlockType.GLASS, ox, oz);
    }
    placeBlock(chunk, x1, y + 2, cz, BlockType.GLASS, ox, oz);
    placeBlock(chunk, x2, y + 2, cz, BlockType.GLASS, ox, oz);

    // Roof — 3-layer stepped pyramid from wood
    fillBox(chunk, x1 - 1, y + WALL_H,     z1 - 1, x2 + 1, y + WALL_H,     z2 + 1, BlockType.WOOD, ox, oz);
    fillBox(chunk, x1,     y + WALL_H + 1, z1,     x2,     y + WALL_H + 1, z2,     BlockType.PLANKS, ox, oz);
    fillBox(chunk, x1 + 1, y + WALL_H + 2, z1 + 1, x2 - 1, y + WALL_H + 2, z2 - 1, BlockType.WOOD, ox, oz);
    // Ridge beam
    for (let rx = x1 + 2; rx <= x2 - 2; rx++)
        placeBlock(chunk, rx, y + WALL_H + 3, cz, BlockType.WOOD, ox, oz);
}

function placeWell(chunk, cx, y, cz, ox, oz) {
    // Cobblestone ring
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) === 1 || Math.abs(dz) === 1) {
                placeBlock(chunk, cx + dx, y,     cz + dz, BlockType.COBBLESTONE, ox, oz);
                placeBlock(chunk, cx + dx, y + 1, cz + dz, BlockType.COBBLESTONE, ox, oz);
            }
        }
    }
    placeBlock(chunk, cx, y, cz, BlockType.WATER, ox, oz);
    // Wooden canopy posts + roof
    for (const [dx, dz] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        placeBlock(chunk, cx + dx, y + 2, cz + dz, BlockType.WOOD, ox, oz);
        placeBlock(chunk, cx + dx, y + 3, cz + dz, BlockType.WOOD, ox, oz);
    }
    fillBox(chunk, cx - 1, y + 4, cz - 1, cx + 1, y + 4, cz + 1, BlockType.PLANKS, ox, oz);
}

function placeFarm(chunk, cx, y, cz, ox, oz) {
    const W = 10, D = 8;
    const x1 = cx - Math.floor(W / 2), x2 = x1 + W;
    const z1 = cz - Math.floor(D / 2), z2 = z1 + D;

    // Plank border
    for (let x = x1; x <= x2; x++) {
        placeBlock(chunk, x, y, z1, BlockType.PLANKS, ox, oz);
        placeBlock(chunk, x, y, z2, BlockType.PLANKS, ox, oz);
    }
    for (let z = z1 + 1; z < z2; z++) {
        placeBlock(chunk, x1, y, z, BlockType.PLANKS, ox, oz);
        placeBlock(chunk, x2, y, z, BlockType.PLANKS, ox, oz);
    }

    // Alternating farmland rows / water channels
    for (let z = z1 + 1; z < z2; z++) {
        const isChannel = ((z - z1) % 4 === 0);
        for (let x = x1 + 1; x < x2; x++) {
            if (isChannel) {
                placeBlock(chunk, x, y - 1, z, BlockType.WATER, ox, oz);
                placeBlock(chunk, x, y,     z, BlockType.AIR,   ox, oz);
            } else {
                placeBlock(chunk, x, y - 1, z, BlockType.DIRT,  ox, oz);
                placeBlock(chunk, x, y,     z, BlockType.AIR,   ox, oz);
            }
        }
    }
}

// ── Village ───────────────────────────────────────────────────────────────────

export function generateVillage(chunk, cx, y, cz, ox, oz, hash) {
    const R = 22;

    // Level the ground and clear overhead
    for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dz * dz > R * R) continue;
            // Ground surface
            placeBlock(chunk, cx + dx, y,     cz + dz, BlockType.GRASS, ox, oz);
            placeBlock(chunk, cx + dx, y - 1, cz + dz, BlockType.DIRT,  ox, oz);
            placeBlock(chunk, cx + dx, y - 2, cz + dz, BlockType.DIRT,  ox, oz);
            // Clear above
            for (let dy = 1; dy <= 12; dy++)
                placeBlock(chunk, cx + dx, y + dy, cz + dz, BlockType.AIR, ox, oz);
        }
    }

    // Central gravel paths (cross)
    for (let d = -R; d <= R; d++) {
        placeBlock(chunk, cx + d, y + 1, cz,     BlockType.GRAVEL, ox, oz);
        placeBlock(chunk, cx,     y + 1, cz + d, BlockType.GRAVEL, ox, oz);
    }

    // Well at center
    placeWell(chunk, cx, y + 1, cz, ox, oz);

    // 5 houses around the center
    const housePos = [
        [-13, -13], [13, -13], [-13, 13], [13, 13], [0, -19],
    ];
    for (let i = 0; i < housePos.length; i++) {
        const [dx, dz] = housePos[i];
        placeHouse(chunk, cx + dx, y + 1, cz + dz, ox, oz, (hash + i) % 3);
        // Short gravel path segment toward center
        const steps = Math.max(Math.abs(dx), Math.abs(dz));
        for (let s = 1; s < steps - 5; s++) {
            const px = cx + Math.round(dx * (1 - s / steps));
            const pz = cz + Math.round(dz * (1 - s / steps));
            placeBlock(chunk, px, y + 1, pz, BlockType.GRAVEL, ox, oz);
        }
    }

    // Two farms
    placeFarm(chunk, cx - 16, y + 1, cz + 10, ox, oz);
    placeFarm(chunk, cx + 16, y + 1, cz - 10, ox, oz);
}

// ── Castle ────────────────────────────────────────────────────────────────────

function placeTower(chunk, cx, y, cz, radius, height, mat, ox, oz) {
    const x1 = cx - radius, x2 = cx + radius;
    const z1 = cz - radius, z2 = cz + radius;
    fillBox(chunk, x1 - 1, y, z1 - 1, x2 + 1, y + height + 2, z2 + 1, BlockType.AIR, ox, oz);
    for (let ly = y; ly < y + height; ly++)
        hollowBox(chunk, x1, ly, z1, x2, ly, z2, mat, ox, oz);
    // Flat floor
    fillBox(chunk, x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, mat, ox, oz);
    // Crenellations
    for (let x = x1; x <= x2; x += 2) {
        placeBlock(chunk, x, y + height, z1, mat, ox, oz);
        placeBlock(chunk, x, y + height, z2, mat, ox, oz);
    }
    for (let z = z1 + 1; z < z2; z += 2) {
        placeBlock(chunk, x1, y + height, z, mat, ox, oz);
        placeBlock(chunk, x2, y + height, z, mat, ox, oz);
    }
}

export function generateCastle(chunk, cx, y, cz, ox, oz) {
    const S  = 18;   // half-side of outer wall
    const WH = 7;    // wall height
    const TR = 3;    // tower radius
    const TH = 11;   // tower height
    const T  = 2;    // wall thickness

    // Clear the area
    fillBox(chunk, cx - S - TR - 2, y, cz - S - TR - 2,
                   cx + S + TR + 2, y + TH + 5, cz + S + TR + 2,
                   BlockType.AIR, ox, oz);

    // Cobblestone courtyard floor
    fillBox(chunk, cx - S, y - 1, cz - S, cx + S, y - 1, cz + S,
            BlockType.COBBLESTONE, ox, oz);

    const x1 = cx - S, x2 = cx + S;
    const z1 = cz - S, z2 = cz + S;

    // Outer walls (4 sides, hollow)
    fillBox(chunk, x1, y, z1, x2, y + WH - 1, z1 + T - 1, BlockType.COBBLESTONE, ox, oz); // N
    fillBox(chunk, x1, y, z2 - T + 1, x2, y + WH - 1, z2, BlockType.COBBLESTONE, ox, oz); // S
    fillBox(chunk, x1, y, z1, x1 + T - 1, y + WH - 1, z2, BlockType.COBBLESTONE, ox, oz); // W
    fillBox(chunk, x2 - T + 1, y, z1, x2, y + WH - 1, z2, BlockType.COBBLESTONE, ox, oz); // E

    // Gate opening in south wall
    fillBox(chunk, cx - 2, y, z2 - T + 1, cx + 2, y + 4, z2, BlockType.AIR, ox, oz);
    // Gate arch lintel
    for (let gx = cx - 2; gx <= cx + 2; gx++)
        placeBlock(chunk, gx, y + 4, z2, BlockType.WOOD, ox, oz);

    // Wall crenellations
    for (let x = x1; x <= x2; x += 2) {
        placeBlock(chunk, x, y + WH, z1, BlockType.COBBLESTONE, ox, oz);
        placeBlock(chunk, x, y + WH, z2, BlockType.COBBLESTONE, ox, oz);
    }
    for (let z = z1; z <= z2; z += 2) {
        placeBlock(chunk, x1, y + WH, z, BlockType.COBBLESTONE, ox, oz);
        placeBlock(chunk, x2, y + WH, z, BlockType.COBBLESTONE, ox, oz);
    }

    // Corner towers
    placeTower(chunk, x1, y, z1, TR, TH, BlockType.COBBLESTONE, ox, oz);
    placeTower(chunk, x2, y, z1, TR, TH, BlockType.COBBLESTONE, ox, oz);
    placeTower(chunk, x1, y, z2, TR, TH, BlockType.COBBLESTONE, ox, oz);
    placeTower(chunk, x2, y, z2, TR, TH, BlockType.COBBLESTONE, ox, oz);

    // Central keep (mossy stone for age)
    const KS = 7, KH = 13;
    hollowBox(chunk, cx - KS, y, cz - KS, cx + KS, y + KH - 1, cz + KS,
              BlockType.MOSSY_COBBLE, ox, oz);
    // Keep entrance
    for (let dy = 0; dy <= 3; dy++)
        placeBlock(chunk, cx, y + dy, cz + KS, BlockType.AIR, ox, oz);
    // Keep roof + top tower
    fillBox(chunk, cx - KS, y + KH, cz - KS, cx + KS, y + KH, cz + KS,
            BlockType.STONE, ox, oz);
    // Keep crenellations
    for (let dx = -KS; dx <= KS; dx += 2) {
        placeBlock(chunk, cx + dx, y + KH + 1, cz - KS, BlockType.STONE, ox, oz);
        placeBlock(chunk, cx + dx, y + KH + 1, cz + KS, BlockType.STONE, ox, oz);
    }
    for (let dz = -KS + 1; dz < KS; dz += 2) {
        placeBlock(chunk, cx - KS, y + KH + 1, cz + dz, BlockType.STONE, ox, oz);
        placeBlock(chunk, cx + KS, y + KH + 1, cz + dz, BlockType.STONE, ox, oz);
    }
    // Tall central spire
    placeTower(chunk, cx, y + KH + 1, cz, 2, 7, BlockType.STONE, ox, oz);
}
