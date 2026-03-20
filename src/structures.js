import { BlockType } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js';

// ── Seeded RNG ────────────────────────────────────────────────────────────────

class SeededRng {
    constructor(seed) { this.s = ((seed ^ 0xdeadbeef) | 1) >>> 0; }
    next() {
        this.s ^= this.s << 13;
        this.s ^= this.s >>> 17;
        this.s ^= this.s << 5;
        return (this.s >>> 0) / 4294967296;
    }
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
    pick(arr)     { return arr[this.int(0, arr.length - 1)]; }
    bool(p = 0.5) { return this.next() < p; }
    fork()        { return new SeededRng(this.int(0, 0x7fffffff)); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function placeBlock(chunk, wx, wy, wz, type, ox, oz) {
    const lx = wx - ox, lz = wz - oz;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && wy >= 0 && wy < CHUNK_HEIGHT)
        chunk.setBlock(lx, wy, lz, type);
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
                if (x === x1 || x === x2 || z === z1 || z === z2 || y === y1 || y === y2)
                    placeBlock(chunk, x, y, z, type, ox, oz);
}

// Deterministic per-chunk hash
export function chunkStructureHash(cx, cz) {
    let h = (cx * 1664525 + cz * 1013904223) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return Math.abs(h ^ (h >>> 16));
}

// ── House ─────────────────────────────────────────────────────────────────────

const WALL_MATS = [BlockType.PLANKS, BlockType.COBBLESTONE, BlockType.STONE, BlockType.BRICK, BlockType.MOSSY_COBBLE];
const ROOF_MATS = [BlockType.WOOD, BlockType.PLANKS, BlockType.STONE, BlockType.COBBLESTONE];

function placeHouse(chunk, cx, y, cz, ox, oz, rng) {
    const W       = rng.int(5, 11) | 1;   // always odd so center is an integer
    const D       = rng.int(7, 11) | 1;
    const WALL_H  = rng.int(3, 5);
    const wallMat = rng.pick(WALL_MATS);
    const roofMat = rng.pick(ROOF_MATS);
    const roofStyle = rng.int(0, 2); // 0=flat, 1=pyramid, 2=gable
    const hasTower  = rng.bool(0.25);
    const foundMat  = rng.bool(0.6) ? BlockType.COBBLESTONE : BlockType.STONE;

    const x1 = cx - (W >> 1), x2 = x1 + W - 1;
    const z1 = cz - (D >> 1), z2 = z1 + D - 1;

    // Clear + foundation
    fillBox(chunk, x1 - 1, y,     z1 - 1, x2 + 1, y + WALL_H + 5, z2 + 1, BlockType.AIR,   ox, oz);
    fillBox(chunk, x1 - 1, y - 1, z1 - 1, x2 + 1, y - 1,          z2 + 1, foundMat,         ox, oz);

    // Walls
    hollowBox(chunk, x1, y, z1, x2, y + WALL_H - 1, z2, wallMat, ox, oz);

    // Floor
    fillBox(chunk, x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, BlockType.PLANKS, ox, oz);

    // Door (south face, centre)
    placeBlock(chunk, cx, y,     z2, BlockType.AIR, ox, oz);
    placeBlock(chunk, cx, y + 1, z2, BlockType.AIR, ox, oz);

    // Windows — varied positions based on house size
    const winY  = y + Math.floor(WALL_H * 0.6);
    const wOffs = rng.int(1, 2);
    for (const wx of [x1 + wOffs, x2 - wOffs]) {
        placeBlock(chunk, wx, winY, z1, BlockType.GLASS, ox, oz);
        placeBlock(chunk, wx, winY, z2, BlockType.GLASS, ox, oz);
    }
    placeBlock(chunk, x1, winY, cz, BlockType.GLASS, ox, oz);
    placeBlock(chunk, x2, winY, cz, BlockType.GLASS, ox, oz);
    // Extra windows on wide houses
    if (W >= 9) {
        placeBlock(chunk, cx, winY, z1, BlockType.GLASS, ox, oz);
        placeBlock(chunk, cx, winY, z2, BlockType.GLASS, ox, oz);
    }

    const topY = y + WALL_H;

    if (roofStyle === 0) {
        // Flat roof with parapet
        fillBox(chunk, x1, topY, z1, x2, topY, z2, roofMat, ox, oz);
        for (let rx = x1; rx <= x2; rx += 2) {
            placeBlock(chunk, rx, topY + 1, z1, roofMat, ox, oz);
            placeBlock(chunk, rx, topY + 1, z2, roofMat, ox, oz);
        }
        for (let rz = z1 + 1; rz < z2; rz += 2) {
            placeBlock(chunk, x1, topY + 1, rz, roofMat, ox, oz);
            placeBlock(chunk, x2, topY + 1, rz, roofMat, ox, oz);
        }
    } else if (roofStyle === 1) {
        // Stepped pyramid
        fillBox(chunk, x1 - 1, topY,     z1 - 1, x2 + 1, topY,     z2 + 1, roofMat, ox, oz);
        fillBox(chunk, x1,     topY + 1, z1,     x2,     topY + 1, z2,     BlockType.PLANKS, ox, oz);
        if (W >= 7 && D >= 7) {
            fillBox(chunk, x1 + 1, topY + 2, z1 + 1, x2 - 1, topY + 2, z2 - 1, roofMat, ox, oz);
            if (W >= 9 && D >= 9) {
                fillBox(chunk, x1 + 2, topY + 3, z1 + 2, x2 - 2, topY + 3, z2 - 2, roofMat, ox, oz);
            }
        }
        // Ridge beam
        for (let rx = x1 + 2; rx <= x2 - 2; rx++)
            placeBlock(chunk, rx, topY + (W >= 9 ? 4 : 3), cz, roofMat, ox, oz);
    } else {
        // Gable roof — ridge along X axis
        const half = (D >> 1) + 1;
        for (let step = 0; step <= half; step++) {
            fillBox(chunk, x1 - 1, topY + step, cz - (half - step), x2 + 1, topY + step, cz + (half - step), roofMat, ox, oz);
        }
    }

    // Optional corner tower (front-right of house)
    if (hasTower) {
        const tH  = WALL_H + rng.int(3, 6);
        const tx  = x2 + 1;
        const tz  = z2 + 1;
        const tMat = rng.bool(0.5) ? wallMat : BlockType.COBBLESTONE;
        for (let ty = y; ty < y + tH; ty++)
            hollowBox(chunk, tx, ty, tz, tx + 2, ty, tz + 2, tMat, ox, oz);
        // Tower top crenellations
        for (let d = 0; d <= 2; d += 2) {
            placeBlock(chunk, tx + d, y + tH, tz,     tMat, ox, oz);
            placeBlock(chunk, tx + d, y + tH, tz + 2, tMat, ox, oz);
            placeBlock(chunk, tx,     y + tH, tz + d, tMat, ox, oz);
            placeBlock(chunk, tx + 2, y + tH, tz + d, tMat, ox, oz);
        }
    }
}

// ── Well ──────────────────────────────────────────────────────────────────────

function placeWell(chunk, cx, y, cz, ox, oz, rng) {
    const mat = rng.pick([BlockType.COBBLESTONE, BlockType.STONE, BlockType.BRICK]);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) === 1 || Math.abs(dz) === 1) {
                placeBlock(chunk, cx + dx, y,     cz + dz, mat, ox, oz);
                placeBlock(chunk, cx + dx, y + 1, cz + dz, mat, ox, oz);
            }
        }
    }
    placeBlock(chunk, cx, y, cz, BlockType.WATER, ox, oz);
    const postMat = rng.pick([BlockType.WOOD, BlockType.PLANKS]);
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        placeBlock(chunk, cx + dx, y + 2, cz + dz, postMat, ox, oz);
        placeBlock(chunk, cx + dx, y + 3, cz + dz, postMat, ox, oz);
    }
    fillBox(chunk, cx - 1, y + 4, cz - 1, cx + 1, y + 4, cz + 1, BlockType.PLANKS, ox, oz);
}

// ── Farm ──────────────────────────────────────────────────────────────────────

function placeFarm(chunk, cx, y, cz, ox, oz, rng) {
    const W = rng.int(8, 14);
    const D = rng.int(6, 10);
    const x1 = cx - (W >> 1), x2 = x1 + W;
    const z1 = cz - (D >> 1), z2 = z1 + D;
    const fenceRow = rng.int(3, 5); // water channel every N rows

    for (let x = x1; x <= x2; x++) {
        placeBlock(chunk, x, y, z1, BlockType.PLANKS, ox, oz);
        placeBlock(chunk, x, y, z2, BlockType.PLANKS, ox, oz);
    }
    for (let z = z1 + 1; z < z2; z++) {
        placeBlock(chunk, x1, y, z, BlockType.PLANKS, ox, oz);
        placeBlock(chunk, x2, y, z, BlockType.PLANKS, ox, oz);
    }
    for (let z = z1 + 1; z < z2; z++) {
        const isChannel = ((z - z1) % fenceRow === 0);
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
    const rng = new SeededRng(hash);
    const R   = rng.int(18, 28);

    // Level and clear the ground
    for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dz * dz > R * R) continue;
            placeBlock(chunk, cx + dx, y,     cz + dz, BlockType.GRASS, ox, oz);
            placeBlock(chunk, cx + dx, y - 1, cz + dz, BlockType.DIRT,  ox, oz);
            placeBlock(chunk, cx + dx, y - 2, cz + dz, BlockType.DIRT,  ox, oz);
            for (let dy = 1; dy <= 14; dy++)
                placeBlock(chunk, cx + dx, y + dy, cz + dz, BlockType.AIR, ox, oz);
        }
    }

    // Central paths — cross or diagonal variant
    const pathMat = rng.pick([BlockType.GRAVEL, BlockType.COBBLESTONE]);
    const diagPaths = rng.bool(0.4);
    for (let d = -R; d <= R; d++) {
        placeBlock(chunk, cx + d, y, cz,     pathMat, ox, oz);
        placeBlock(chunk, cx,     y, cz + d, pathMat, ox, oz);
    }
    if (diagPaths) {
        for (let d = -R; d <= R; d++) {
            placeBlock(chunk, cx + d, y, cz + d, pathMat, ox, oz);
            placeBlock(chunk, cx + d, y, cz - d, pathMat, ox, oz);
        }
    }

    // Well at centre
    placeWell(chunk, cx, y, cz, ox, oz, rng.fork());

    // Houses — random count, random positions in a ring around centre
    const numHouses = rng.int(3, 8);
    for (let i = 0; i < numHouses; i++) {
        const angle  = (i / numHouses) * Math.PI * 2 + rng.next() * 0.6;
        const dist   = rng.int(10, R - 5);
        const hx     = cx + Math.round(Math.cos(angle) * dist);
        const hz     = cz + Math.round(Math.sin(angle) * dist);
        placeHouse(chunk, hx, y, hz, ox, oz, rng.fork());

        // Gravel path from house to centre
        const steps = dist;
        for (let s = 1; s < steps - 3; s++) {
            const px = cx + Math.round(Math.cos(angle) * (dist - s));
            const pz = cz + Math.round(Math.sin(angle) * (dist - s));
            placeBlock(chunk, px, y, pz, pathMat, ox, oz);
        }
    }

    // Farms — 1 to 3
    const numFarms = rng.int(1, 3);
    for (let i = 0; i < numFarms; i++) {
        const fAngle = rng.next() * Math.PI * 2;
        const fDist  = rng.int(R - 10, R - 4);
        placeFarm(chunk,
            cx + Math.round(Math.cos(fAngle) * fDist),
            y,
            cz + Math.round(Math.sin(fAngle) * fDist),
            ox, oz, rng.fork()
        );
    }
}

// ── Castle tower ──────────────────────────────────────────────────────────────

function placeTower(chunk, cx, y, cz, radius, height, mat, ox, oz) {
    const x1 = cx - radius, x2 = cx + radius;
    const z1 = cz - radius, z2 = cz + radius;
    fillBox(chunk, x1 - 1, y, z1 - 1, x2 + 1, y + height + 2, z2 + 1, BlockType.AIR, ox, oz);
    for (let ly = y; ly < y + height; ly++)
        hollowBox(chunk, x1, ly, z1, x2, ly, z2, mat, ox, oz);
    fillBox(chunk, x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, mat, ox, oz);
    for (let x = x1; x <= x2; x += 2) {
        placeBlock(chunk, x, y + height, z1, mat, ox, oz);
        placeBlock(chunk, x, y + height, z2, mat, ox, oz);
    }
    for (let z = z1 + 1; z < z2; z += 2) {
        placeBlock(chunk, x1, y + height, z, mat, ox, oz);
        placeBlock(chunk, x2, y + height, z, mat, ox, oz);
    }
}

// ── Castle ────────────────────────────────────────────────────────────────────

export function generateCastle(chunk, cx, y, cz, ox, oz, hash) {
    const rng  = new SeededRng(hash ^ 0xca573);
    const S    = rng.int(12, 24);   // half-side of outer wall
    const WH   = rng.int(5, 9);     // wall height
    const TR   = rng.int(2, 4);     // tower radius
    const TH   = rng.int(WH + 3, WH + 9); // tower height
    const T    = rng.bool(0.4) ? 3 : 2;   // wall thickness

    const wallMat = rng.pick([BlockType.COBBLESTONE, BlockType.STONE, BlockType.BRICK]);
    const keepMat = rng.pick([BlockType.MOSSY_COBBLE, BlockType.STONE, BlockType.COBBLESTONE]);
    const hasMoat = rng.bool(0.35);
    const hasInnerBuilding = rng.bool(0.5);

    // Clear area
    fillBox(chunk, cx - S - TR - 3, y,     cz - S - TR - 3,
                   cx + S + TR + 3, y + TH + 6, cz + S + TR + 3, BlockType.AIR, ox, oz);

    // Moat
    if (hasMoat) {
        for (let dx = -(S + TR + 2); dx <= S + TR + 2; dx++) {
            for (let dz = -(S + TR + 2); dz <= S + TR + 2; dz++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dz));
                if (dist >= S + TR - 1 && dist <= S + TR + 1) {
                    placeBlock(chunk, cx + dx, y - 1, cz + dz, BlockType.WATER, ox, oz);
                    placeBlock(chunk, cx + dx, y - 2, cz + dz, BlockType.WATER, ox, oz);
                }
            }
        }
    }

    // Courtyard floor
    fillBox(chunk, cx - S, y - 1, cz - S, cx + S, y - 1, cz + S, BlockType.COBBLESTONE, ox, oz);

    const x1 = cx - S, x2 = cx + S;
    const z1 = cz - S, z2 = cz + S;

    // Outer walls (4 sides)
    fillBox(chunk, x1, y, z1,     x2, y + WH - 1, z1 + T - 1, wallMat, ox, oz);
    fillBox(chunk, x1, y, z2 - T + 1, x2, y + WH - 1, z2,     wallMat, ox, oz);
    fillBox(chunk, x1, y, z1,     x1 + T - 1, y + WH - 1, z2, wallMat, ox, oz);
    fillBox(chunk, x2 - T + 1, y, z1, x2, y + WH - 1, z2,     wallMat, ox, oz);

    // Gate opening in south wall
    const gateW = rng.int(2, 3);
    fillBox(chunk, cx - gateW, y, z2 - T + 1, cx + gateW, y + rng.int(3, 5), z2, BlockType.AIR, ox, oz);
    for (let gx = cx - gateW; gx <= cx + gateW; gx++)
        placeBlock(chunk, gx, y + 4, z2, BlockType.WOOD, ox, oz);

    // Wall crenellations
    for (let x = x1; x <= x2; x += 2) {
        placeBlock(chunk, x, y + WH, z1, wallMat, ox, oz);
        placeBlock(chunk, x, y + WH, z2, wallMat, ox, oz);
    }
    for (let z = z1; z <= z2; z += 2) {
        placeBlock(chunk, x1, y + WH, z, wallMat, ox, oz);
        placeBlock(chunk, x2, y + WH, z, wallMat, ox, oz);
    }

    // Corner towers
    placeTower(chunk, x1, y, z1, TR, TH, wallMat, ox, oz);
    placeTower(chunk, x2, y, z1, TR, TH, wallMat, ox, oz);
    placeTower(chunk, x1, y, z2, TR, TH, wallMat, ox, oz);
    placeTower(chunk, x2, y, z2, TR, TH, wallMat, ox, oz);

    // Optional mid-wall towers on large castles
    if (S >= 18 && rng.bool(0.6)) {
        placeTower(chunk, cx, y, z1, TR - 1, TH - 2, wallMat, ox, oz);
        placeTower(chunk, cx, y, z2, TR - 1, TH - 2, wallMat, ox, oz);
        placeTower(chunk, x1, y, cz, TR - 1, TH - 2, wallMat, ox, oz);
        placeTower(chunk, x2, y, cz, TR - 1, TH - 2, wallMat, ox, oz);
    }

    // Central keep
    const KS = rng.int(5, 9);
    const KH = rng.int(10, 16);
    hollowBox(chunk, cx - KS, y, cz - KS, cx + KS, y + KH - 1, cz + KS, keepMat, ox, oz);
    // Keep entrance
    for (let dy = 0; dy <= 3; dy++)
        placeBlock(chunk, cx, y + dy, cz + KS, BlockType.AIR, ox, oz);
    // Keep roof
    fillBox(chunk, cx - KS, y + KH, cz - KS, cx + KS, y + KH, cz + KS, BlockType.STONE, ox, oz);
    // Keep crenellations
    for (let dx = -KS; dx <= KS; dx += 2) {
        placeBlock(chunk, cx + dx, y + KH + 1, cz - KS, keepMat, ox, oz);
        placeBlock(chunk, cx + dx, y + KH + 1, cz + KS, keepMat, ox, oz);
    }
    for (let dz = -KS + 1; dz < KS; dz += 2) {
        placeBlock(chunk, cx - KS, y + KH + 1, cz + dz, keepMat, ox, oz);
        placeBlock(chunk, cx + KS, y + KH + 1, cz + dz, keepMat, ox, oz);
    }

    // Spire on keep
    const spireStyle = rng.int(0, 2);
    if (spireStyle === 0) {
        placeTower(chunk, cx, y + KH + 1, cz, 2, rng.int(6, 10), BlockType.STONE, ox, oz);
    } else if (spireStyle === 1) {
        // Triple spires
        placeTower(chunk, cx,      y + KH + 1, cz,      2, 8,    BlockType.STONE, ox, oz);
        placeTower(chunk, cx - KS, y + KH + 1, cz,      1, 5,    keepMat, ox, oz);
        placeTower(chunk, cx + KS, y + KH + 1, cz,      1, 5,    keepMat, ox, oz);
    } else {
        // Stepped pyramid spire
        for (let step = 0; step < 5; step++)
            fillBox(chunk, cx - (2 - step), y + KH + 1 + step, cz - (2 - step),
                           cx + (2 - step), y + KH + 1 + step, cz + (2 - step), BlockType.STONE, ox, oz);
    }

    // Inner courtyard building (barracks, chapel, stable)
    if (hasInnerBuilding) {
        const ibRng = rng.fork();
        const ibW = ibRng.int(5, 9) | 1;
        const ibD = ibRng.int(5, 7) | 1;
        const ibMat = ibRng.pick(WALL_MATS);
        const ibx = cx + ibRng.int(-S + KS + 4, S - KS - 4);
        const ibz = cz + ibRng.int(-S + KS + 4, S - KS - 4);
        placeHouse(chunk, ibx, y, ibz, ox, oz, ibRng);
    }
}

// ── Watchtower ────────────────────────────────────────────────────────────────

export function generateWatchtower(chunk, cx, y, cz, ox, oz, hash) {
    const rng  = new SeededRng(hash ^ 0x9a7c4);
    const mat  = rng.pick([BlockType.COBBLESTONE, BlockType.STONE, BlockType.BRICK, BlockType.MOSSY_COBBLE]);
    const R    = rng.int(1, 3);
    const H    = rng.int(10, 20);

    fillBox(chunk, cx - R - 1, y, cz - R - 1, cx + R + 1, y + H + 2, cz + R + 1, BlockType.AIR, ox, oz);

    for (let ly = y; ly < y + H; ly++)
        hollowBox(chunk, cx - R, ly, cz - R, cx + R, ly, cz + R, mat, ox, oz);

    // Floor
    fillBox(chunk, cx - R + 1, y, cz - R + 1, cx + R - 1, y, cz + R - 1, mat, ox, oz);

    // Door
    placeBlock(chunk, cx, y,     cz + R, BlockType.AIR, ox, oz);
    placeBlock(chunk, cx, y + 1, cz + R, BlockType.AIR, ox, oz);

    // Platform at top
    fillBox(chunk, cx - R - 1, y + H, cz - R - 1, cx + R + 1, y + H, cz + R + 1, mat, ox, oz);

    // Crenellations
    for (let x = cx - R - 1; x <= cx + R + 1; x += 2) {
        placeBlock(chunk, x, y + H + 1, cz - R - 1, mat, ox, oz);
        placeBlock(chunk, x, y + H + 1, cz + R + 1, mat, ox, oz);
    }
    for (let z = cz - R; z <= cz + R + 1; z += 2) {
        placeBlock(chunk, cx - R - 1, y + H + 1, z, mat, ox, oz);
        placeBlock(chunk, cx + R + 1, y + H + 1, z, mat, ox, oz);
    }

    // Optional flag pole
    if (rng.bool(0.5)) {
        placeBlock(chunk, cx, y + H + 1, cz, BlockType.WOOD, ox, oz);
        placeBlock(chunk, cx, y + H + 2, cz, BlockType.WOOD, ox, oz);
        placeBlock(chunk, cx, y + H + 3, cz, BlockType.WOOD, ox, oz);
    }

    // Foundation / steps
    fillBox(chunk, cx - R, y - 1, cz - R, cx + R, y - 1, cz + R, mat, ox, oz);
}

// ── Ruins ─────────────────────────────────────────────────────────────────────

export function generateRuins(chunk, cx, y, cz, ox, oz, hash) {
    const rng   = new SeededRng(hash ^ 0x4051ab);
    const W     = rng.int(7, 15) | 1;
    const D     = rng.int(7, 13) | 1;
    const H     = rng.int(2, 5);
    const mat   = rng.pick([BlockType.MOSSY_COBBLE, BlockType.COBBLESTONE, BlockType.STONE]);
    const x1 = cx - (W >> 1), x2 = x1 + W - 1;
    const z1 = cz - (D >> 1), z2 = z1 + D - 1;

    fillBox(chunk, x1 - 1, y, z1 - 1, x2 + 1, y + H + 2, z2 + 1, BlockType.AIR, ox, oz);

    // Partial, broken walls
    for (let x = x1; x <= x2; x++) {
        for (let z = z1; z <= z2; z++) {
            if (!(x === x1 || x === x2 || z === z1 || z === z2)) continue;
            const wallH = Math.max(0, H - Math.floor(rng.next() * H * 1.5));
            for (let dy = 0; dy < wallH; dy++) {
                if (rng.next() > 0.15) // occasional missing block for decay
                    placeBlock(chunk, x, y + dy, z, mat, ox, oz);
            }
        }
    }

    // Rubble on floor
    for (let dx = 0; dx < 8; dx++) {
        const rx = cx + rng.int(-W >> 1, W >> 1);
        const rz = cz + rng.int(-D >> 1, D >> 1);
        placeBlock(chunk, rx, y, rz, mat, ox, oz);
    }

    // Optional lone pillar
    if (rng.bool(0.5)) {
        const ph = rng.int(H, H + 4);
        for (let dy = 0; dy < ph; dy++)
            placeBlock(chunk, cx, y + dy, cz, mat, ox, oz);
    }
}
