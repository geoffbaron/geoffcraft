import * as THREE from 'three';
import { BlockType, isBlockSolid, isBlockTransparent } from './blocks.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;

export class Chunk {
    constructor(cx, cz, world) {
        this.cx = cx;
        this.cz = cz;
        this.world = world;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.meta = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.mesh = null;
        this.waterMesh = null;
        this.dirty = true;
    }

    getIndex(x, y, z) {
        return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            // Fetch from neighboring chunk via world
            const wx = this.cx * CHUNK_SIZE + x;
            const wz = this.cz * CHUNK_SIZE + z;
            return this.world.getBlock(wx, y, wz);
        }
        return this.blocks[this.getIndex(x, y, z)];
    }

    getBlockMeta(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            const wx = this.cx * CHUNK_SIZE + x;
            const wz = this.cz * CHUNK_SIZE + z;
            return this.world.getBlockMeta(wx, y, wz);
        }
        return this.meta[this.getIndex(x, y, z)];
    }

    setBlock(x, y, z, type, meta = 0) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
        const idx = this.getIndex(x, y, z);
        this.blocks[idx] = type;
        this.meta[idx] = meta;
        this.dirty = true;
    }

    buildMesh(faceTextures) {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.world.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh = null;
        }

        // Group faces by block type and face direction for batched rendering
        const solidGeomData = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
        const waterGeomData = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

        let solidVertCount = 0;
        let waterVertCount = 0;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const block = this.blocks[this.getIndex(x, y, z)];
                    if (block === BlockType.AIR) continue;

                    const isWater = block === BlockType.WATER;
                    const geom = isWater ? waterGeomData : solidGeomData;

                    // Check each face
                    for (const face of FACES) {
                        const nx = x + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = z + face.dir[2];
                        const neighbor = this.getBlock(nx, ny, nz);

                        // Render face if neighbor is transparent (and not same type for water)
                        const shouldRender = isWater
                            ? (neighbor !== BlockType.WATER && isBlockTransparent(neighbor))
                            : (isBlockTransparent(neighbor) && neighbor !== block);

                        if (!shouldRender) continue;

                        const vertCount = isWater ? waterVertCount : solidVertCount;

                        // Add face vertices
                        for (let i = 0; i < 4; i++) {
                            const vert = face.vertices[i];
                            geom.positions.push(x + vert[0], y + vert[1], z + vert[2]);
                            geom.normals.push(...face.dir);
                            geom.uvs.push(face.uvs[i][0], face.uvs[i][1]);

                            // AO-like shading based on face direction
                            let shade = 1.0;
                            if (face.dir[1] === -1) shade = 0.5;       // bottom
                            else if (face.dir[1] === 0) {
                                shade = face.dir[0] !== 0 ? 0.7 : 0.8; // sides
                            }
                            geom.colors.push(shade, shade, shade);
                        }

                        geom.indices.push(
                            vertCount, vertCount + 1, vertCount + 2,
                            vertCount, vertCount + 2, vertCount + 3
                        );

                        if (isWater) waterVertCount += 4;
                        else solidVertCount += 4;
                    }
                }
            }
        }

        // Build solid mesh with multi-material approach using vertex colors for shading
        if (solidGeomData.positions.length > 0) {
            this.mesh = this.buildGeometryMesh(solidGeomData, false);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.mesh);
        }

        if (waterGeomData.positions.length > 0) {
            this.waterMesh = this.buildGeometryMesh(waterGeomData, true);
            this.waterMesh.castShadow = true;
            this.waterMesh.receiveShadow = true;
            this.waterMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.waterMesh);
        }

        this.dirty = false;
    }

    buildGeometryMesh(geomData, isWater) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(geomData.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geomData.normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geomData.uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(geomData.colors, 3));
        geometry.setIndex(geomData.indices);

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            transparent: isWater,
            opacity: isWater ? 0.6 : 1.0,
            side: isWater ? THREE.DoubleSide : THREE.FrontSide,
            color: isWater ? 0x3366aa : 0xffffff,
        });

        return new THREE.Mesh(geometry, material);
    }

    // Build mesh using per-block-type textures for better visuals
    buildTexturedMesh(faceTextures) {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.world.scene.remove(this.waterMesh);
            this.waterMesh.material.dispose();
            this.waterMesh.geometry.dispose();
            this.waterMesh = null;
        }

        // Group geometry by material key (blockType + faceType)
        const groups = {};
        const waterGeom = { positions: [], normals: [], uvs: [], colors: [], indices: [], vertCount: 0 };

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const block = this.blocks[this.getIndex(x, y, z)];
                    if (block === BlockType.AIR) continue;
                    const isWater = block === BlockType.WATER;

                    for (const face of FACES) {
                        const nx = x + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = z + face.dir[2];
                        const neighbor = this.getBlock(nx, ny, nz);

                        const shouldRender = isWater
                            ? (neighbor !== BlockType.WATER && isBlockTransparent(neighbor))
                            : (isBlockTransparent(neighbor) && neighbor !== block);

                        if (!shouldRender) continue;

                        if (isWater) {
                            const aboveIsWater = this.getBlock(x, y + 1, z) === BlockType.WATER;
                            const vc = waterGeom.vertCount;
                            for (let i = 0; i < 4; i++) {
                                const v = face.vertices[i];
                                let yPos = v[1];
                                // Smooth surface: top face corners slope based on neighboring meta values
                                if (face.dir[1] === 1 && yPos === 1 && !aboveIsWater) {
                                    yPos = getWaterCornerHeight(this, x, y, z, v[0], v[2]);
                                } else if (!aboveIsWater && yPos === 1 && face.dir[1] === 0) {
                                    // Side faces: top edge uses this block's surface height
                                    yPos = getWaterSurfaceHeight(this, x, y, z);
                                }
                                waterGeom.positions.push(x + v[0], y + yPos, z + v[2]);
                                waterGeom.normals.push(...face.dir);
                                waterGeom.uvs.push(face.uvs[i][0], face.uvs[i][1]);
                                waterGeom.colors.push(1, 1, 1);
                            }
                            waterGeom.indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
                            waterGeom.vertCount += 4;
                            continue;
                        }

                        const matKey = `${block}_${face.texFace}`;
                        if (!groups[matKey]) {
                            groups[matKey] = { positions: [], normals: [], uvs: [], colors: [], indices: [], vertCount: 0, blockType: block, faceType: face.texFace };
                        }
                        const g = groups[matKey];
                        const vc = g.vertCount;

                        for (let i = 0; i < 4; i++) {
                            const v = face.vertices[i];
                            g.positions.push(x + v[0], y + v[1], z + v[2]);
                            g.normals.push(...face.dir);
                            g.uvs.push(face.uvs[i][0], face.uvs[i][1]);

                            let shade = 1.0;
                            if (face.dir[1] === -1) shade = 0.5;
                            else if (face.dir[1] === 0) shade = face.dir[0] !== 0 ? 0.7 : 0.8;
                            g.colors.push(shade, shade, shade);
                        }
                        g.indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
                        g.vertCount += 4;
                    }
                }
            }
        }

        // Merge all solid groups into one geometry with material groups
        const materials = [];
        const allPositions = [];
        const allNormals = [];
        const allUvs = [];
        const allColors = [];
        const allIndices = [];
        let globalVertOffset = 0;

        for (const key of Object.keys(groups)) {
            const g = groups[key];
            if (g.positions.length === 0) continue;

            const matIndex = materials.length;
            const tex = faceTextures[g.blockType]?.[g.faceType] || faceTextures[g.blockType]?.side;

            const mat = new THREE.MeshLambertMaterial({
                map: tex || null,
                vertexColors: true,
                side: THREE.FrontSide,
            });
            materials.push(mat);

            const indexStart = allIndices.length;
            for (const idx of g.indices) {
                allIndices.push(idx + globalVertOffset);
            }
            allPositions.push(...g.positions);
            allNormals.push(...g.normals);
            allUvs.push(...g.uvs);
            allColors.push(...g.colors);

            // We'll add geometry groups after
            materials[matIndex]._indexStart = indexStart;
            materials[matIndex]._indexCount = g.indices.length;

            globalVertOffset += g.vertCount;
        }

        if (allPositions.length > 0) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUvs, 2));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
            geometry.setIndex(allIndices);

            for (let i = 0; i < materials.length; i++) {
                geometry.addGroup(materials[i]._indexStart, materials[i]._indexCount, i);
                delete materials[i]._indexStart;
                delete materials[i]._indexCount;
            }

            this.mesh = new THREE.Mesh(geometry, materials);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.mesh);
        }

        // Water mesh
        if (waterGeom.positions.length > 0) {
            const wGeometry = new THREE.BufferGeometry();
            wGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterGeom.positions, 3));
            wGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterGeom.normals, 3));
            wGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterGeom.uvs, 2));
            wGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterGeom.colors, 3));
            wGeometry.setIndex(waterGeom.indices);

            const wTex = faceTextures[BlockType.WATER]?.top;
            const wMat = new THREE.MeshLambertMaterial({
                map: wTex || null,
                vertexColors: true,
                transparent: true,
                opacity: 0.55,
                side: THREE.DoubleSide,
                color: 0x4488cc,
            });
            this.waterMesh = new THREE.Mesh(wGeometry, wMat);
            this.waterMesh.castShadow = true;
            this.waterMesh.receiveShadow = true;
            this.waterMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.waterMesh);
        }

        this.dirty = false;
    }

    dispose() {
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(m => m.dispose());
            } else {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
        if (this.waterMesh) {
            this.world.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh.material.dispose();
            this.waterMesh = null;
        }
    }
}

// --- Water surface helpers ---

// Returns the visual surface height [0..1] of a water block at (lx, ly, lz).
// Returns -1 if not water.
function getWaterSurfaceHeight(chunk, lx, ly, lz) {
    const block = chunk.getBlock(lx, ly, lz);
    if (block !== BlockType.WATER) return -1;
    if (chunk.getBlock(lx, ly + 1, lz) === BlockType.WATER) return 1.0;
    const meta = chunk.getBlockMeta(lx, ly, lz);
    return (8 - Math.min(meta, 7)) / 8;
}

// Returns the corner height for a water block's top face.
// (vx, vz) are 0 or 1 — the corner's XZ offset within the block.
// Averages the surface heights of the 4 blocks sharing that corner.
function getWaterCornerHeight(chunk, lx, ly, lz, vx, vz) {
    const xs = vx === 0 ? [lx - 1, lx] : [lx, lx + 1];
    const zs = vz === 0 ? [lz - 1, lz] : [lz, lz + 1];
    let total = 0;
    let count = 0;
    for (const cx of xs) {
        for (const cz of zs) {
            const h = getWaterSurfaceHeight(chunk, cx, ly, cz);
            if (h === 1.0) return 1.0; // falling water above → full corner
            if (h > 0) { total += h; count++; }
        }
    }
    if (count === 0) return 0.125; // minimum height
    return total / count;
}

// Face definitions: direction, vertices, UVs
const FACES = [
    { // +Y (top)
        dir: [0, 1, 0],
        texFace: 'top',
        vertices: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
        uvs: [[0,1],[1,1],[1,0],[0,0]],
    },
    { // -Y (bottom)
        dir: [0, -1, 0],
        texFace: 'bottom',
        vertices: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
        uvs: [[0,0],[1,0],[1,1],[0,1]],
    },
    { // +X (right)
        dir: [1, 0, 0],
        texFace: 'side',
        vertices: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],
        uvs: [[0,0],[0,1],[1,1],[1,0]],
    },
    { // -X (left)
        dir: [-1, 0, 0],
        texFace: 'side',
        vertices: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
        uvs: [[0,0],[0,1],[1,1],[1,0]],
    },
    { // +Z (front)
        dir: [0, 0, 1],
        texFace: 'side',
        vertices: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]],
        uvs: [[0,0],[0,1],[1,1],[1,0]],
    },
    { // -Z (back)
        dir: [0, 0, -1],
        texFace: 'side',
        vertices: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]],
        uvs: [[0,0],[0,1],[1,1],[1,0]],
    },
];
