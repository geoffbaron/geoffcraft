import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { BlockType } from './blocks.js';
import { createTextureAtlas } from './textures.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.menuScreen = document.getElementById('menu-screen');
        this.started = false;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 400);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.dirLight.position.set(50, 100, 30);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 150;
        this.dirLight.shadow.camera.left = -50;
        this.dirLight.shadow.camera.right = 50;
        this.dirLight.shadow.camera.top = 50;
        this.dirLight.shadow.camera.bottom = -50;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        // Sun Mesh
        const sunGeo = new THREE.BoxGeometry(10, 10, 10);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);

        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x556633, 0.4);
        this.scene.add(hemisphereLight);

        // Generate textures
        this.faceTextures = createTextureAtlas();

        // World
        this.world = new World(this.scene);
        this.world.setTextures(this.faceTextures);

        // Pre-generate spawn area and build meshes
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                this.world.generateChunk(dx, dz);
            }
        }
        // Build all initial meshes
        for (const [key, chunk] of this.world.chunks) {
            chunk.buildTexturedMesh(this.faceTextures);
        }

        // Clouds
        this.clouds = new THREE.Group();
        const cloudGeo = new THREE.BoxGeometry(16, 4, 24);
        const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        for(let i = 0; i < 30; i++) {
            const mesh = new THREE.Mesh(cloudGeo, cloudMat);
            mesh.position.set((Math.random() - 0.5) * 300, 110 + Math.random() * 20, (Math.random() - 0.5) * 300);
            mesh.castShadow = true;
            this.clouds.add(mesh);
        }
        this.scene.add(this.clouds);

        // Torch light pool — up to 24 flickering PointLights for cave torches
        this.torchLights = [];
        for (let i = 0; i < 24; i++) {
            const pl = new THREE.PointLight(0xff7722, 0, 14, 2);
            pl.visible = false;
            this.scene.add(pl);
            this.torchLights.push(pl);
        }
        this.torchRefresh   = 0;           // countdown until next torch scan
        this.activeTorches  = [];          // flat [x,y,z, ...] of active torch flame positions

        // Player
        this.player = new Player(this.camera, this.world);
        this.player.findSpawnPosition();

        // Set initial camera position — look slightly downward so terrain is visible on menu
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.7;
        this.player.rotation.x = -0.4;  // Look down a bit
        const euler = new THREE.Euler(this.player.rotation.x, this.player.rotation.y, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);

        // UI
        this.ui = new UI();

        // Block highlight
        this.highlightMesh = this.createHighlightMesh();
        this.scene.add(this.highlightMesh);
        this.highlightMesh.visible = false;

        // FPS tracking
        this.frames = 0;
        this.fps = 0;
        this.lastFpsTime = performance.now();
        this.lastTime = performance.now();

        // Block break/place cooldown
        this.actionCooldown = 0;

        this.setupEvents();
        this.animate();
    }

    createHighlightMesh() {
        const geo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        const edges = new THREE.EdgesGeometry(geo);
        const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const mesh = new THREE.LineSegments(edges, mat);
        return mesh;
    }

    setupEvents() {
        // Click to start
        this.menuScreen.addEventListener('click', () => {
            this.start();
        });

        // Pointer lock
        document.addEventListener('pointerlockchange', () => {
            this.player.mouseLocked = document.pointerLockElement === this.canvas;
            if (!this.player.mouseLocked && this.started) {
                this.menuScreen.style.display = 'flex';
                this.menuScreen.querySelector('h1').textContent = 'Paused';
                this.menuScreen.querySelector('p').textContent = 'Click to Resume';
            }
        });

        // Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Block interaction
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.player.mouseLocked) return;
            if (this.actionCooldown > 0) return;

            const origin = this.camera.position.clone();
            const dir = this.player.getLookDirection();
            const hit = this.world.raycast(origin, dir);

            if (!hit) return;

            if (e.button === 0) {
                // Left click - break
                this.world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockType.AIR);
                this.actionCooldown = 0.2;
            } else if (e.button === 2) {
                // Right click - place
                const px = hit.block.x + hit.normal.x;
                const py = hit.block.y + hit.normal.y;
                const pz = hit.block.z + hit.normal.z;

                // Don't place inside the player
                const playerMinX = this.player.position.x - 0.3;
                const playerMaxX = this.player.position.x + 0.3;
                const playerMinZ = this.player.position.z - 0.3;
                const playerMaxZ = this.player.position.z + 0.3;
                const playerMinY = this.player.position.y;
                const playerMaxY = this.player.position.y + 1.7;

                if (px + 1 > playerMinX && px < playerMaxX &&
                    py + 1 > playerMinY && py < playerMaxY &&
                    pz + 1 > playerMinZ && pz < playerMaxZ) {
                    return;
                }

                this.world.setBlock(px, py, pz, this.ui.getSelectedBlock());
                this.actionCooldown = 0.2;
            }
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    start() {
        this.started = true;
        this.menuScreen.style.display = 'none';
        this.canvas.requestPointerLock();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // FPS counter
        this.frames++;
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsTime = now;
        }

        if (this.actionCooldown > 0) this.actionCooldown -= dt;

        // Always update world chunks (so terrain loads on menu screen too)
        this.world.update(this.player.position.x, this.player.position.z);

        // Update light and sun position to follow player continuously
        const sunOffset = new THREE.Vector3(40, 80, 20);
        this.dirLight.position.copy(this.player.position).add(sunOffset);
        this.dirLight.target.position.copy(this.player.position);
        this.sunMesh.position.copy(this.dirLight.position);

        // Animate clouds
        for (const cloud of this.clouds.children) {
            cloud.position.x += 4 * dt;
            cloud.position.z += 2 * dt;
            if (cloud.position.x - this.player.position.x > 150) {
                cloud.position.x = this.player.position.x - 150;
                cloud.position.z = this.player.position.z + (Math.random() - 0.5) * 300;
            }
            if (cloud.position.z - this.player.position.z > 150) {
                cloud.position.z = this.player.position.z - 150;
                cloud.position.x = this.player.position.x + (Math.random() - 0.5) * 300;
            }
        }

        // Update flickering torch lights
        this.updateTorchLights(dt, now);

        // Animate water flowing
        if (this.faceTextures && this.faceTextures[BlockType.WATER]) {
            const time = now / 1000;
            this.faceTextures[BlockType.WATER].top.offset.set(time * 0.05, time * 0.05);
            this.faceTextures[BlockType.WATER].side.offset.set(time * 0.05, time * 0.05);
        }

        if (this.started && this.player.mouseLocked) {
            this.player.update(dt);

            // Block highlight
            const origin = this.camera.position.clone();
            const dir = this.player.getLookDirection();
            const hit = this.world.raycast(origin, dir);
            if (hit) {
                this.highlightMesh.visible = true;
                this.highlightMesh.position.set(
                    hit.block.x + 0.5,
                    hit.block.y + 0.5,
                    hit.block.z + 0.5
                );
            } else {
                this.highlightMesh.visible = false;
            }
        }

        // Update debug info
        this.ui.updateDebugInfo(this.player, this.fps);

        this.renderer.render(this.scene, this.camera);
    }

    updateTorchLights(dt, now) {
        const t = now / 1000;
        const px = this.player.position.x;
        const py = this.player.position.y;
        const pz = this.player.position.z;

        // Re-scan nearby chunks for torch positions every 2 s or on first call
        this.torchRefresh -= dt;
        if (this.torchRefresh <= 0) {
            this.torchRefresh = 2.0;
            this.activeTorches = [];

            const pcx = Math.floor(px / 16);
            const pcz = Math.floor(pz / 16);
            // Collect all torch positions within 4-chunk radius
            const candidates = [];
            for (let dx = -4; dx <= 4; dx++) {
                for (let dz = -4; dz <= 4; dz++) {
                    const chunk = this.world.getChunk(pcx + dx, pcz + dz);
                    if (!chunk || !chunk.torchWorldPositions) continue;
                    const tp = chunk.torchWorldPositions;
                    for (let i = 0; i < tp.length; i += 3) {
                        const ddx = tp[i]   - px;
                        const ddy = tp[i+1] - py;
                        const ddz = tp[i+2] - pz;
                        const dist2 = ddx*ddx + ddy*ddy + ddz*ddz;
                        if (dist2 < 60 * 60) { // within 60 blocks
                            candidates.push({ x: tp[i], y: tp[i+1], z: tp[i+2], dist2 });
                        }
                    }
                }
            }
            // Sort by distance, keep closest 24
            candidates.sort((a, b) => a.dist2 - b.dist2);
            const take = Math.min(candidates.length, this.torchLights.length);
            for (let i = 0; i < take; i++) {
                this.activeTorches.push(candidates[i].x, candidates[i].y, candidates[i].z);
            }
        }

        // Animate each active torch light with multi-frequency flicker
        const count = Math.min(this.activeTorches.length / 3, this.torchLights.length);
        for (let i = 0; i < this.torchLights.length; i++) {
            const light = this.torchLights[i];
            if (i < count) {
                const tx = this.activeTorches[i * 3];
                const ty = this.activeTorches[i * 3 + 1];
                const tz = this.activeTorches[i * 3 + 2];
                light.position.set(tx, ty, tz);
                // Unique multi-frequency flicker per torch index
                const ph = i * 2.399; // golden-angle phase spread
                const flicker =
                    Math.sin(t * 7.3  + ph)       * 0.18 +
                    Math.sin(t * 13.7 + ph * 1.9) * 0.09 +
                    Math.sin(t * 3.1  + ph * 0.6) * 0.06 +
                    (Math.random() < 0.01 ? (Math.random() - 0.5) * 0.4 : 0); // rare pop
                light.intensity = Math.max(0.5, 1.4 + flicker);
                light.visible = true;
            } else {
                light.visible = false;
            }
        }
    }
}

// Start game
window.game = new Game();
