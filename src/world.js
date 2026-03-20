import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './chunk.js';
import { BlockType, isBlockSolid } from './blocks.js';
import { Noise } from './noise.js';
import { chunkStructureHash, generateVillage, generateCastle, generateWatchtower, generateRuins } from './structures.js';

const RENDER_DISTANCE = 8;
const WATER_LEVEL = 32;

export class World {
    constructor(scene, seed = 42) {
        this.scene = scene;
        this.seed = seed;
        this.chunks = new Map();
        this.noise = new Noise(seed);
        this.treeNoise = new Noise(seed + 100);
        this.caveNoise = new Noise(seed + 200);
        this.oreNoise = new Noise(seed + 300);
        this.faceTextures = null;
        this.waterQueue = new Set();
        this.waterTickTimer = 0;
    }

    setTextures(faceTextures) {
        this.faceTextures = faceTextures;
    }

    chunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    getChunk(cx, cz) {
        return this.chunks.get(this.chunkKey(cx, cz));
    }

    getBlock(wx, wy, wz) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockType.AIR;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return BlockType.AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.blocks[chunk.getIndex(lx, wy, lz)];
    }

    getBlockMeta(wx, wy, wz) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return 0;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.meta[chunk.getIndex(lx, wy, lz)];
    }

    setBlock(wx, wy, wz, type, meta = 0) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.setBlock(lx, wy, lz, type, meta);

        // Mark neighboring chunks dirty if on border
        if (lx === 0) this.markChunkDirty(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
        if (lz === 0) this.markChunkDirty(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

        this.queueWaterNeighbors(wx, wy, wz);
    }

    queueWaterUpdate(wx, wy, wz) {
        this.waterQueue.add(`${wx},${wy},${wz}`);
    }

    queueWaterNeighbors(wx, wy, wz) {
        const sides = [[0,0,0], [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
        for (const [dx, dy, dz] of sides) {
            const block = this.getBlock(wx + dx, wy + dy, wz + dz);
            if (block === BlockType.WATER) {
                this.queueWaterUpdate(wx + dx, wy + dy, wz + dz);
            }
        }
        if (this.getBlock(wx, wy, wz) === BlockType.WATER) {
            this.queueWaterUpdate(wx, wy, wz);
        }
    }

    markChunkDirty(cx, cz) {
        const chunk = this.getChunk(cx, cz);
        if (chunk) chunk.dirty = true;
    }

    ridgedNoise(wx, wz, octaves = 6) {
        // Ridged multifractal: produces sharp mountain ridges (1 - |noise|)
        let value = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            const n = this.noise.noise2D(wx * freq, wz * freq);
            value += (1.0 - Math.abs(n)) * amp;
            max += amp;
            amp *= 0.5;
            freq *= 2.1; // slightly non-integer for less grid regularity
        }
        return value / max; // measured range: [0.44, 0.99], avg ~0.80
    }

    getHeight(wx, wz) {
        // Base rolling plains / hills
        const base = this.noise.fbm(wx * 0.005, wz * 0.005, 4) * 0.5 + 0.5;
        let height = 30 + base * 18; // 30–48

        // Mountain zone mask — measured fbm range here is ~[0.37, 0.62]
        // Frequency 0.002 → mountain ranges spaced ~300-500 blocks apart
        const mZone = this.noise.fbm(wx * 0.002 + 500, wz * 0.002 + 500, 4) * 0.5 + 0.5;
        // Normalize over actual range: threshold 0.46, max ~0.62 → mMask [0,1]
        const mMask = Math.min(1, Math.max(0, (mZone - 0.46) / 0.16));

        if (mMask > 0) {
            const ridge = this.ridgedNoise(wx * 0.006 + 300, wz * 0.006 + 300, 6);
            const ridge2 = this.ridgedNoise(wx * 0.015 + 700, wz * 0.015 + 700, 4);
            // Normalize ridged from measured [0.44, 0.99] → [0, 1]
            const rc = Math.max(0, (ridge * 0.65 + ridge2 * 0.35 - 0.44) / 0.55);
            // Base mountain elevation + sharp jagged peaks
            height += mMask * (22 + rc * rc * 115);
        }

        // Ocean: separate low-frequency noise carves out seas
        const ocean = this.noise.fbm(wx * 0.0015 + 200, wz * 0.0015 + 200, 3) * 0.5 + 0.5;
        if (ocean < 0.46) {
            height -= (0.46 - ocean) * 80;
        }

        // Rivers
        const river = this.noise.fbm(wx * 0.003 + 100, wz * 0.003 + 100, 3);
        if (Math.abs(river) < 0.035 && height > 34) {
            height -= (1.0 - Math.abs(river) / 0.035) * 12;
        }

        // Fine surface roughness
        const detail = this.noise.fbm(wx * 0.04, wz * 0.04, 3) * 0.5 + 0.5;
        return Math.floor(Math.min(CHUNK_HEIGHT - 2, height + detail * 5));
    }

    generateChunk(cx, cz) {
        const key = this.chunkKey(cx, cz);
        if (this.chunks.has(key)) return this.chunks.get(key);

        const chunk = new Chunk(cx, cz, this);
        const worldX = cx * CHUNK_SIZE;
        const worldZ = cz * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldX + x;
                const wz = worldZ + z;
                const height = this.getHeight(wx, wz);

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    let block = BlockType.AIR;

                    if (y === 0) {
                        block = BlockType.BEDROCK;
                    } else if (y < height - 4) {
                        block = BlockType.STONE;

                        // Caves
                        const caveVal = this.caveNoise.noise3D(wx * 0.05, y * 0.07, wz * 0.05);
                        const caveVal2 = this.caveNoise.noise3D(wx * 0.08, y * 0.1, wz * 0.08);
                        if (caveVal > 0.45 && caveVal2 > 0.4 && y > 5 && y < height - 8) {
                            block = BlockType.AIR;
                        } else {
                            // Ores
                            const oreVal = this.oreNoise.noise3D(wx * 0.15, y * 0.15, wz * 0.15);
                            if (y < 30 && oreVal > 0.7) {
                                block = BlockType.IRON_ORE;
                            } else if (y < 50 && oreVal < -0.65) {
                                block = BlockType.COAL_ORE;
                            }
                        }
                    } else if (y < height) {
                        if (height < WATER_LEVEL + 2) {
                            block = BlockType.SAND;
                        } else if (height > 95) {
                            // High alpine: ICE at very peak, then snow, then stone
                            if (y > height - 2) block = BlockType.ICE;
                            else if (y > height - 5) block = BlockType.SNOW;
                            else block = BlockType.STONE;
                        } else if (height > 72) {
                            block = (y > height - 3) ? BlockType.SNOW : BlockType.STONE;
                        } else {
                            block = BlockType.DIRT;
                        }
                    } else if (y === height) {
                        if (height < WATER_LEVEL) {
                            block = BlockType.SAND;
                        } else if (height < WATER_LEVEL + 2) {
                            block = BlockType.SAND;
                        } else if (height > 95) {
                            block = BlockType.ICE;
                        } else if (height > 72) {
                            block = BlockType.SNOW;
                        } else {
                            block = BlockType.GRASS;
                        }
                    } else if (y <= WATER_LEVEL && y > height) {
                        block = BlockType.WATER;
                    }

                    chunk.setBlock(x, y, z, block);
                }
            }
        }

        // Generate trees
        for (let x = 2; x < CHUNK_SIZE - 2; x++) {
            for (let z = 2; z < CHUNK_SIZE - 2; z++) {
                const wx = worldX + x;
                const wz = worldZ + z;
                const height = this.getHeight(wx, wz);

                if (height <= WATER_LEVEL + 2 || height > 95) continue;

                const treeNoiseVal = this.treeNoise.noise2D(wx * 0.05, wz * 0.05);
                if (treeNoiseVal > 0.1 && (wx * 19 + wz * 7) % 11 === 0) {
                    this.placeTree(chunk, x, height + 1, z);
                }
            }
        }

        // Unload far chunks underground
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = worldX + x;
                const wz = worldZ + z;
                const gravelVal = this.oreNoise.noise2D(wx * 0.1, wz * 0.1);
                if (gravelVal > 0.7) {
                    for (let y = 10; y < 20; y++) {
                        if (chunk.getBlock(x, y, z) === BlockType.STONE) {
                            const gv = this.oreNoise.noise3D(wx * 0.2, y * 0.2, wz * 0.2);
                            if (gv > 0.5) chunk.setBlock(x, y, z, BlockType.GRAVEL);
                        }
                    }
                }
            }
        }

        this.generateStructures(chunk, cx, cz);

        this.chunks.set(key, chunk);
        return chunk;
    }

    generateStructures(chunk, cx, cz) {
        const hash = chunkStructureHash(cx, cz);
        const wx = cx * CHUNK_SIZE + 8;
        const wz = cz * CHUNK_SIZE + 8;
        const h = this.getHeight(wx, wz);

        // Village: ~1 in 18 chunks, flat land below snow line
        if (hash % 18 === 0 && h > WATER_LEVEL + 4 && h < 62) {
            generateVillage(chunk, wx, h, wz, cx * CHUNK_SIZE, cz * CHUNK_SIZE, hash);
            return;
        }

        // Castle: ~1 in 60 chunks, on slightly elevated terrain
        if (hash % 60 === 5 && h > WATER_LEVEL + 6 && h < 68) {
            generateCastle(chunk, wx, h, wz, cx * CHUNK_SIZE, cz * CHUNK_SIZE, hash);
            return;
        }

        // Watchtower: ~1 in 10 chunks, anywhere passable
        if (hash % 10 === 3 && h > WATER_LEVEL + 2 && h < 80) {
            generateWatchtower(chunk, wx, h, wz, cx * CHUNK_SIZE, cz * CHUNK_SIZE, hash);
            return;
        }

        // Ruins: ~1 in 15 chunks, anywhere on land
        if (hash % 15 === 7 && h > WATER_LEVEL + 2 && h < 75) {
            generateRuins(chunk, wx, h, wz, cx * CHUNK_SIZE, cz * CHUNK_SIZE, hash);
        }
    }

    placeTree(chunk, x, baseY, z) {
        const trunkHeight = 4 + Math.floor(Math.abs(this.treeNoise.noise2D(x * 13.7, z * 13.7)) * 3);

        // Trunk
        for (let y = 0; y < trunkHeight; y++) {
            chunk.setBlock(x, baseY + y, z, BlockType.WOOD);
        }

        // Leaves
        const leafStart = trunkHeight - 2;
        for (let dy = leafStart; dy <= trunkHeight + 1; dy++) {
            const radius = dy <= trunkHeight - 1 ? 2 : 1;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && dy < trunkHeight) continue;
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.6) continue;
                    const lx = x + dx, ly = baseY + dy, lz = z + dz;
                    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < CHUNK_HEIGHT) {
                        if (chunk.getBlock(lx, ly, lz) === BlockType.AIR) {
                            chunk.setBlock(lx, ly, lz, BlockType.LEAVES);
                        }
                    }
                }
            }
        }
    }

    update(playerX, playerZ) {
        const pcx = Math.floor(playerX / CHUNK_SIZE);
        const pcz = Math.floor(playerZ / CHUNK_SIZE);

        // Generate new chunks
        const chunksToGenerate = [];
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
            for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
                if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE) continue;
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = this.chunkKey(cx, cz);
                if (!this.chunks.has(key)) {
                    chunksToGenerate.push({ cx, cz, dist: dx * dx + dz * dz });
                }
            }
        }

        // Sort by distance, generate closest first
        chunksToGenerate.sort((a, b) => a.dist - b.dist);
        const maxGenPerFrame = 2;
        for (let i = 0; i < Math.min(maxGenPerFrame, chunksToGenerate.length); i++) {
            const { cx, cz } = chunksToGenerate[i];
            this.generateChunk(cx, cz);
        }

        // Water simulation tick (~10 times per second)
        this.waterTickTimer += 0.016; // approximate dt
        if (this.waterTickTimer > 0.1) {
            this.tickWater();
            this.waterTickTimer = 0;
        }

        // Build/rebuild dirty chunk meshes
        let meshBuilds = 0;
        for (const [key, chunk] of this.chunks) {
            if (chunk.dirty && meshBuilds < 3) {
                if (this.faceTextures) {
                    chunk.buildTexturedMesh(this.faceTextures);
                } else {
                    chunk.buildMesh();
                }
                meshBuilds++;
            }
        }

        // Unload far chunks
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.cx - pcx;
            const dz = chunk.cz - pcz;
            if (dx * dx + dz * dz > (RENDER_DISTANCE + 2) * (RENDER_DISTANCE + 2)) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
    }

    // Raycast for block picking
    raycast(origin, direction, maxDist = 8) {
        const step = 0.05;
        const pos = origin.clone();
        const dir = direction.clone().normalize().multiplyScalar(step);
        let prevX = Math.floor(pos.x);
        let prevY = Math.floor(pos.y);
        let prevZ = Math.floor(pos.z);

        for (let d = 0; d < maxDist; d += step) {
            pos.add(dir);
            const bx = Math.floor(pos.x);
            const by = Math.floor(pos.y);
            const bz = Math.floor(pos.z);

            const block = this.getBlock(bx, by, bz);
            if (block !== BlockType.AIR && block !== BlockType.WATER) {
                return {
                    block: { x: bx, y: by, z: bz, type: block },
                    normal: { x: prevX - bx, y: prevY - by, z: prevZ - bz },
                    prevBlock: { x: prevX, y: prevY, z: prevZ },
                };
            }
            prevX = bx;
            prevY = by;
            prevZ = bz;
        }
        return null;
    }

    tickWater() {
        if (this.waterQueue.size === 0) return;
        
        const currentQueue = Array.from(this.waterQueue);
        this.waterQueue.clear();

        let processed = 0;
        
        for (const key of currentQueue) {
            if (processed++ > 2000) { 
                this.waterQueue.add(key); 
                continue;
            }
            
            const [wx, wy, wz] = key.split(',').map(Number);
            const block = this.getBlock(wx, wy, wz);
            if (block !== BlockType.WATER) continue;
            
            const meta = this.getBlockMeta(wx, wy, wz);
            
            // 0. Dry out logic for flowing water
            if (meta > 0) {
                const above = this.getBlock(wx, wy + 1, wz);
                let validSource = false;
                if (above === BlockType.WATER) {
                    validSource = true;
                } else {
                    const sides = [[1,0,0], [-1,0,0], [0,0,1], [0,0,-1]];
                    for (const [dx, dy, dz] of sides) {
                        if (this.getBlock(wx + dx, wy, wz + dz) === BlockType.WATER) {
                            const sideMeta = this.getBlockMeta(wx + dx, wy, wz + dz);
                            if (sideMeta < meta || sideMeta === 0) {
                                validSource = true;
                                break;
                            }
                        }
                    }
                }
                if (!validSource) {
                    this.setBlock(wx, wy, wz, BlockType.AIR);
                    continue; 
                }
            }

            // 1. Check directly below
            const below = this.getBlock(wx, wy - 1, wz);
            let canSpreadSideways = true;

            if (below === BlockType.AIR) {
                this.setBlock(wx, wy - 1, wz, BlockType.WATER, 1);
                if (meta > 0) canSpreadSideways = false; 
            } else if (below === BlockType.WATER) {
                const belowMeta = this.getBlockMeta(wx, wy - 1, wz);
                if (belowMeta !== 0 && belowMeta > 1) {
                    this.setBlock(wx, wy - 1, wz, BlockType.WATER, 1);
                }
                if (meta > 0) canSpreadSideways = false; 
            }

            if (!canSpreadSideways) continue;

            // 2. Spread horizontally (if max flow distance not reached)
            if (meta >= 6) continue; // Flow up to 6 blocks away from source
            
            const sides = [[1,0,0], [-1,0,0], [0,0,1], [0,0,-1]];
            for (const [dx, dy, dz] of sides) {
                const sideBlock = this.getBlock(wx + dx, wy, wz + dz);
                if (sideBlock === BlockType.AIR) {
                    this.setBlock(wx + dx, wy, wz + dz, BlockType.WATER, meta + 1);
                } else if (sideBlock === BlockType.WATER) {
                    const sideMeta = this.getBlockMeta(wx + dx, wy, wz + dz);
                    if (sideMeta > meta + 1 && sideMeta !== 0) {
                        this.setBlock(wx + dx, wy, wz + dz, BlockType.WATER, meta + 1);
                    }
                }
            }
        }
    }
}
