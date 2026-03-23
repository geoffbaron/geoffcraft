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
        const lavaGeomData = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

        let solidVertCount = 0;
        let waterVertCount = 0;
        let lavaVertCount = 0;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const block = this.blocks[this.getIndex(x, y, z)];
                    if (block === BlockType.AIR) continue;

                    const isWater = block === BlockType.WATER;
                    const isLava = block === BlockType.LAVA;
                    const isFluid = isWater || isLava;
                    const geom = isFluid ? (isWater ? waterGeomData : lavaGeomData) : solidGeomData;

                    // Check each face
                    for (const face of FACES) {
                        const nx = x + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = z + face.dir[2];
                        const neighbor = this.getBlock(nx, ny, nz);

                        // Render face if neighbor is transparent (and not same type for fluid)
                        const shouldRender = isFluid
                            ? (neighbor !== block && isBlockTransparent(neighbor))
                            : (isBlockTransparent(neighbor) && neighbor !== block);

                        if (!shouldRender) continue;

                        const vertCount = isFluid ? (isWater ? waterVertCount : lavaVertCount) : solidVertCount;

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
                        else if (isLava) lavaVertCount += 4;
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

        if (lavaGeomData.positions.length > 0) {
            this.lavaMesh = this.buildGeometryMesh(lavaGeomData, true);
            this.lavaMesh.castShadow = true;
            this.lavaMesh.receiveShadow = true;
            this.lavaMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.lavaMesh);
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
        if (this.torchMesh) {
            this.world.scene.remove(this.torchMesh);
            this.torchMesh.material.dispose();
            this.torchMesh.geometry.dispose();
            this.torchMesh = null;
        }
        if (this.eggMesh) {
            this.world.scene.remove(this.eggMesh);
            this.eggMesh.material.dispose();
            this.eggMesh.geometry.dispose();
            this.eggMesh = null;
        }

        // Group geometry by material key (blockType + faceType)
        const groups = {};
        const waterGeom = { positions: [], normals: [], uvs: [], colors: [], indices: [], vertCount: 0 };
        const lavaGeom = { positions: [], normals: [], uvs: [], colors: [], indices: [], vertCount: 0 };

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const block = this.blocks[this.getIndex(x, y, z)];
                    // Skip AIR, TORCH, EASTER_EGG, GOLDEN_EGG, DIAMOND_EGG (which get custom meshes)
                    if (block === BlockType.AIR || block === BlockType.TORCH || block === BlockType.EASTER_EGG || block === BlockType.GOLDEN_EGG || block === BlockType.DIAMOND_EGG) continue;
                    const isWater = block === BlockType.WATER;
                    const isLava = block === BlockType.LAVA;
                    const isFluid = isWater || isLava;

                    for (const face of FACES) {
                        const nx = x + face.dir[0];
                        const ny = y + face.dir[1];
                        const nz = z + face.dir[2];
                        const neighbor = this.getBlock(nx, ny, nz);

                        const shouldRender = isFluid
                            ? (neighbor !== block && isBlockTransparent(neighbor))
                            : (isBlockTransparent(neighbor) && neighbor !== block);

                        if (!shouldRender) continue;

                        if (isFluid) {
                            const activeGeom = isWater ? waterGeom : lavaGeom;
                            const aboveIsSame = this.getBlock(x, y + 1, z) === block;
                            const vc = activeGeom.vertCount;
                            for (let i = 0; i < 4; i++) {
                                const v = face.vertices[i];
                                let yPos = v[1];
                                // Smooth surface: top face corners slope based on neighboring meta values
                                if (face.dir[1] === 1 && yPos === 1 && !aboveIsSame) {
                                    yPos = getFluidCornerHeight(this, x, y, z, v[0], v[2], block);
                                } else if (!aboveIsSame && yPos === 1 && face.dir[1] === 0) {
                                    // Side faces: top edge uses this block's surface height
                                    yPos = getFluidSurfaceHeight(this, x, y, z, block);
                                }
                                activeGeom.positions.push(x + v[0], y + yPos, z + v[2]);
                                activeGeom.normals.push(...face.dir);
                                activeGeom.uvs.push(face.uvs[i][0], face.uvs[i][1]);
                                activeGeom.colors.push(1, 1, 1);
                            }
                            activeGeom.indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
                            activeGeom.vertCount += 4;
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

        // Lava mesh
        if (lavaGeom.positions.length > 0) {
            const lGeometry = new THREE.BufferGeometry();
            lGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lavaGeom.positions, 3));
            lGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(lavaGeom.normals, 3));
            lGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(lavaGeom.uvs, 2));
            lGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lavaGeom.colors, 3));
            lGeometry.setIndex(lavaGeom.indices);

            const lTex = faceTextures[BlockType.LAVA]?.top;
            const lMat = new THREE.MeshLambertMaterial({
                map: lTex || null,
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
                emissive: 0xaa4400,
                color: 0xff8833,
            });
            this.lavaMesh = new THREE.Mesh(lGeometry, lMat);
            this.lavaMesh.castShadow = true;
            this.lavaMesh.receiveShadow = true;
            this.lavaMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
            this.world.scene.add(this.lavaMesh);
        }

        // Build torch cross mesh
        this.buildTorchMesh();

        // Build 3D egg instanced mesh
        this.buildEggMesh(faceTextures);

        this.dirty = false;
    }

    buildEggMesh(faceTextures) {
        if (this.eggMesh) { this.world.scene.remove(this.eggMesh); this.eggMesh.geometry.dispose(); this.eggMesh.material.dispose(); this.eggMesh = null; }
        if (this.goldenEggMesh) { this.world.scene.remove(this.goldenEggMesh); this.goldenEggMesh.geometry.dispose(); this.goldenEggMesh.material.dispose(); this.goldenEggMesh = null; }
        if (this.diamondEggMesh) { this.world.scene.remove(this.diamondEggMesh); this.diamondEggMesh.geometry.dispose(); this.diamondEggMesh.material.dispose(); this.diamondEggMesh = null; }

        const normalEggs = [];
        const goldenEggs = [];
        const diamondEggs = [];
        const worldX = this.cx * CHUNK_SIZE;
        const worldZ = this.cz * CHUNK_SIZE;

        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                    const bt = this.blocks[this.getIndex(lx, ly, lz)];
                    if (bt === BlockType.EASTER_EGG) {
                        normalEggs.push({ x: worldX + lx + 0.5, y: ly + 0.5, z: worldZ + lz + 0.5 });
                    } else if (bt === BlockType.GOLDEN_EGG) {
                        goldenEggs.push({ x: worldX + lx + 0.5, y: ly + 0.5, z: worldZ + lz + 0.5 });
                    } else if (bt === BlockType.DIAMOND_EGG) {
                        diamondEggs.push({ x: worldX + lx + 0.5, y: ly + 0.5, z: worldZ + lz + 0.5 });
                    }
                }
            }
        }

        if (normalEggs.length === 0 && goldenEggs.length === 0 && diamondEggs.length === 0) return;

        // Shape a sphere into an egg
        const geo = new THREE.SphereGeometry(0.35, 24, 24);
        const posAttr = geo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            let y = posAttr.getY(i);
            const taper = y > 0 ? 1.0 - (y * 0.7) : 1.0; 
            posAttr.setX(i, posAttr.getX(i) * taper);
            posAttr.setZ(i, posAttr.getZ(i) * taper);
            posAttr.setY(i, y * 1.5 - 0.35); 
        }
        geo.computeVertexNormals();

        if (normalEggs.length > 0) {
            const tex = faceTextures[BlockType.EASTER_EGG]?.top;
            const mat = new THREE.MeshLambertMaterial({ map: tex || null });
            this.eggMesh = new THREE.InstancedMesh(geo, mat, normalEggs.length);
            this.eggMesh.castShadow = true; this.eggMesh.receiveShadow = true;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < normalEggs.length; i++) {
                dummy.position.set(normalEggs[i].x, normalEggs[i].y, normalEggs[i].z);
                dummy.rotation.y = (normalEggs[i].x * 13 + normalEggs[i].z * 7) % Math.PI;
                dummy.updateMatrix();
                this.eggMesh.setMatrixAt(i, dummy.matrix);
            }
            this.world.scene.add(this.eggMesh);
        }

        if (goldenEggs.length > 0) {
            const tex = faceTextures[BlockType.GOLDEN_EGG]?.top;
            const mat = new THREE.MeshLambertMaterial({ map: tex || null, emissive: 0x443300 }); // Shiny inner glow
            this.goldenEggMesh = new THREE.InstancedMesh(geo, mat, goldenEggs.length);
            this.goldenEggMesh.castShadow = true; this.goldenEggMesh.receiveShadow = true;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < goldenEggs.length; i++) {
                dummy.position.set(goldenEggs[i].x, goldenEggs[i].y, goldenEggs[i].z);
                dummy.rotation.y = (goldenEggs[i].x * 13 + goldenEggs[i].z * 7) % Math.PI;
                dummy.updateMatrix();
                this.goldenEggMesh.setMatrixAt(i, dummy.matrix);
            }
            this.world.scene.add(this.goldenEggMesh);
        }

        if (diamondEggs.length > 0) {
            const tex = faceTextures[BlockType.DIAMOND_EGG]?.top;
            const mat = new THREE.MeshLambertMaterial({ map: tex || null, emissive: 0x004455 }); // Shiny cyan glow
            this.diamondEggMesh = new THREE.InstancedMesh(geo, mat, diamondEggs.length);
            this.diamondEggMesh.castShadow = true; this.diamondEggMesh.receiveShadow = true;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < diamondEggs.length; i++) {
                dummy.position.set(diamondEggs[i].x, diamondEggs[i].y, diamondEggs[i].z);
                dummy.rotation.y = (diamondEggs[i].x * 13 + diamondEggs[i].z * 7) % Math.PI;
                dummy.updateMatrix();
                this.diamondEggMesh.setMatrixAt(i, dummy.matrix);
            }
            this.world.scene.add(this.diamondEggMesh);
        }
    }

    buildTorchMesh() {
        if (this.torchMesh) {
            this.world.scene.remove(this.torchMesh);
            this.torchMesh.material.dispose();
            this.torchMesh.geometry.dispose();
            this.torchMesh = null;
        }
        this.torchWorldPositions = []; // [x,y,z, ...] world-space flame positions for PointLights

        const positions = [];
        const colors    = [];
        const indices   = [];
        let vc = 0;

        const worldX = this.cx * CHUNK_SIZE;
        const worldZ = this.cz * CHUNK_SIZE;

        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                    if (this.blocks[this.getIndex(lx, ly, lz)] !== BlockType.TORCH) continue;

                    const wx = worldX + lx + 0.5;
                    const wy = ly;
                    const wz = worldZ + lz + 0.5;

                    // Record flame-tip for PointLight placement
                    this.torchWorldPositions.push(wx, wy + 0.75, wz);

                    const sw = 0.06;            // stick half-width
                    const sh = 0.55;            // stick height
                    const fw = 0.18;            // flame half-width
                    const fb = wy + sh;         // flame bottom y
                    const ft = wy + sh + 0.18;  // flame top y

                    // 4 quads: stick X, stick Z, flame X, flame Z
                    const quads = [
                        [wx-sw, wy, wz,    wx+sw, wy, wz,    wx+sw, wy+sh, wz,    wx-sw, wy+sh, wz],
                        [wx, wy, wz-sw,    wx, wy, wz+sw,    wx, wy+sh, wz+sw,    wx, wy+sh, wz-sw],
                        [wx-fw, fb, wz,    wx+fw, fb, wz,    wx+fw, ft, wz,        wx-fw, ft, wz],
                        [wx, fb, wz-fw,    wx, fb, wz+fw,    wx, ft, wz+fw,        wx, ft, wz-fw],
                    ];

                    for (let qi = 0; qi < 4; qi++) {
                        const flame = qi >= 2;
                        const q = quads[qi];
                        for (let vi = 0; vi < 4; vi++) {
                            positions.push(q[vi*3], q[vi*3+1], q[vi*3+2]);
                            const top = vi >= 2;
                            if (flame) {
                                colors.push(1.0, top ? 1.0 : 0.55, top ? 0.6 : 0.0); // yellow→orange
                            } else {
                                colors.push(top ? 0.85 : 0.28, top ? 0.45 : 0.16, 0.04); // brown stick
                            }
                        }
                        indices.push(vc, vc+1, vc+2,  vc, vc+2, vc+3);
                        vc += 4;
                    }
                }
            }
        }

        if (positions.length === 0) return;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
        geo.setIndex(indices);

        this.torchMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
        }));
        this.world.scene.add(this.torchMesh);
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
        if (this.torchMesh) {
            this.world.scene.remove(this.torchMesh);
            this.torchMesh.geometry.dispose();
            this.torchMesh.material.dispose();
            this.torchMesh = null;
        }
        if (this.eggMesh) {
            this.world.scene.remove(this.eggMesh);
            this.eggMesh.geometry.dispose();
            this.eggMesh.material.dispose();
            this.eggMesh = null;
        }
        if (this.goldenEggMesh) {
            this.world.scene.remove(this.goldenEggMesh);
            this.goldenEggMesh.geometry.dispose();
            this.goldenEggMesh.material.dispose();
            this.goldenEggMesh = null;
        }
    }
}

// --- Fluid surface helpers ---

// Returns the visual surface height [0..1] of a fluid block at (lx, ly, lz).
// Returns -1 if not fluid.
function getFluidSurfaceHeight(chunk, lx, ly, lz, fluidType) {
    const block = chunk.getBlock(lx, ly, lz);
    if (block !== fluidType) return -1;
    if (chunk.getBlock(lx, ly + 1, lz) === fluidType) return 1.0;
    const meta = chunk.getBlockMeta(lx, ly, lz);
    return (8 - Math.min(meta, 7)) / 8;
}

// Returns the corner height for a fluid block's top face.
// (vx, vz) are 0 or 1 — the corner's XZ offset within the block.
// Averages the surface heights of the 4 blocks sharing that corner.
function getFluidCornerHeight(chunk, lx, ly, lz, vx, vz, fluidType) {
    const xs = vx === 0 ? [lx - 1, lx] : [lx, lx + 1];
    const zs = vz === 0 ? [lz - 1, lz] : [lz, lz + 1];
    let total = 0;
    let count = 0;
    for (const cx of xs) {
        for (const cz of zs) {
            const h = getFluidSurfaceHeight(chunk, cx, ly, cz, fluidType);
            if (h === 1.0) return 1.0; // falling fluid above → full corner
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
