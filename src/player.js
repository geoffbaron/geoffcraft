import * as THREE from 'three';
import { isBlockSolid, BlockType } from './blocks.js';

const GRAVITY = 25;
const FLY_SPEED = 15;
const FLY_SPRINT_SPEED = 40;
const PLAYER_WIDTH = 0.3;
const MOUSE_SENSITIVITY = 0.0032;
const TOUCH_LOOK_SENSITIVITY = 0.0055;

export class Player {
    constructor(camera, world, audio) {
        this.camera = camera;
        this.world = world;
        this.audio = audio;

        this.height = 1.7;
        this.jumpForce = 16;
        this.canFly = false;
        this.moveSpeed = 5.5;
        this.sprintSpeed = 8.8;
        this.hasDynamite = false;

        this.position = new THREE.Vector3(0, 80, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = { x: 0, y: 0 }; // pitch, yaw

        this.onGround = false;
        this.sprinting = false;
        this.flying = false;
        this.lastSpaceTap = 0;
        this.stepDistance = 0;

        this.keys = {};
        this.mouseLocked = false;
        this.forwardDir = new THREE.Vector3();
        this.rightDir = new THREE.Vector3();
        this.lookDir = new THREE.Vector3();
        this.moveDir = new THREE.Vector3();
        this.newPos = new THREE.Vector3();

        this.setupControls();
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.keys['Space']) {
                const now = performance.now();
                if (now - this.lastSpaceTap < 300 && this.canFly) {
                    this.flying = !this.flying;
                    if (!this.flying) this.velocity.y = 0;
                }
                this.lastSpaceTap = now;
            }
            this.keys[e.code] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.mouseLocked) return;
            this.applyLookDelta(e.movementX * MOUSE_SENSITIVITY, e.movementY * MOUSE_SENSITIVITY);
        });
    }

    applyLookDelta(deltaX, deltaY, sensitivity = 1) {
        this.rotation.y -= deltaX * sensitivity;
        this.rotation.x -= deltaY * sensitivity;
        this.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.rotation.x));
    }

    applyTouchLook(deltaX, deltaY) {
        this.applyLookDelta(deltaX, deltaY, TOUCH_LOOK_SENSITIVITY);
    }

    getForwardDir() {
        return this.forwardDir.set(
            -Math.sin(this.rotation.y),
            0,
            -Math.cos(this.rotation.y)
        ).normalize();
    }

    getRightDir() {
        return this.rightDir.set(
            Math.cos(this.rotation.y),
            0,
            -Math.sin(this.rotation.y)
        ).normalize();
    }

    getLookDirection() {
        return this.lookDir.set(
            -Math.sin(this.rotation.y) * Math.cos(this.rotation.x),
            Math.sin(this.rotation.x),
            -Math.cos(this.rotation.y) * Math.cos(this.rotation.x)
        ).normalize();
    }

    update(dt) {
        dt = Math.min(dt, 0.05);

        this.sprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

        const forward = this.getForwardDir();
        const right = this.getRightDir();
        const moveDir = this.moveDir.set(0, 0, 0);

        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.add(forward);
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.sub(forward);
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.sub(right);
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.add(right);

        if (this.flying) {
            const flySpeed = this.sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;
            if (moveDir.length() > 0) moveDir.normalize().multiplyScalar(flySpeed);
            this.velocity.x = moveDir.x;
            this.velocity.z = moveDir.z;
            // Space = fly up, Shift = fly down
            if (this.keys['Space']) this.velocity.y = flySpeed;
            else if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) this.velocity.y = -flySpeed;
            else this.velocity.y = 0;
            // No collision in fly mode — move freely
            this.position.addScaledVector(this.velocity, dt);
        } else {
            const speed = this.sprinting ? this.sprintSpeed : this.moveSpeed;
            if (moveDir.length() > 0) moveDir.normalize().multiplyScalar(speed);
            this.velocity.x = moveDir.x;
            this.velocity.z = moveDir.z;
            // Gravity
            this.velocity.y -= GRAVITY * dt;
            // Jump
            if (this.keys['Space'] && this.onGround) {
                this.velocity.y = this.jumpForce;
                this.onGround = false;
                if (this.audio) this.audio.playJump();
            }
            this.moveWithCollision(dt);

            if (this.onGround && moveDir.length() > 0) {
                this.stepDistance += speed * dt;
                const threshold = this.sprinting ? 2.5 : 2.0;
                if (this.stepDistance > threshold) {
                    if (this.audio) this.audio.playStep();
                    this.stepDistance = 0;
                }
            } else if (!this.onGround) {
                this.stepDistance = 0;
            }
        }

        // Update camera
        this.camera.position.copy(this.position);
        this.camera.position.y += this.height;
        const euler = new THREE.Euler(this.rotation.x, this.rotation.y, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    }

    moveWithCollision(dt) {
        // Move each axis independently for better collision
        const newPos = this.newPos.copy(this.position);

        // X axis
        newPos.x += this.velocity.x * dt;
        if (this.collidesAt(newPos)) {
            newPos.x = this.position.x;
            this.velocity.x = 0;
        }

        // Z axis
        newPos.z += this.velocity.z * dt;
        if (this.collidesAt(newPos)) {
            newPos.z = this.position.z;
            this.velocity.z = 0;
        }

        // Y axis
        newPos.y += this.velocity.y * dt;
        if (this.collidesAt(newPos)) {
            if (this.velocity.y < 0) {
                // Landing - snap to block top
                newPos.y = Math.floor(this.position.y) + 0.001;
                // Double check if this snap position is also colliding
                if (this.collidesAt(newPos)) {
                    newPos.y = this.position.y;
                }
                this.onGround = true;
            } else {
                // Hit ceiling
                newPos.y = this.position.y;
            }
            this.velocity.y = 0;
        } else {
            this.onGround = false;
        }

        this.position.copy(newPos);
    }

    collidesAt(pos) {
        const w = PLAYER_WIDTH;
        // Check corners of player AABB
        for (let dx = -1; dx <= 1; dx += 2) {
            for (let dz = -1; dz <= 1; dz += 2) {
                for (let dy = 0; dy <= 1; dy++) {
                    const checkY = dy === 0 ? pos.y : pos.y + this.height;
                    const bx = Math.floor(pos.x + dx * w);
                    const by = Math.floor(checkY);
                    const bz = Math.floor(pos.z + dz * w);
                    if (isBlockSolid(this.world.getBlock(bx, by, bz))) {
                        return true;
                    }
                }
            }
        }
        // Check feet center
        if (isBlockSolid(this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)))) {
            return true;
        }
        return false;
    }

    // Find safe spawn position on dry land, clear of obstacles (trees, etc.)
    findSpawnPosition() {
        const WATER_LEVEL = 32;
        for (let r = 0; r <= 24; r++) {
            for (let i = -r; i <= r; i++) {
                const checks = [
                    [i * 12, -r * 12], [i * 12, r * 12],
                    [-r * 12, i * 12], [r * 12, i * 12],
                ];
                for (const [sx, sz] of checks) {
                    const h = this.world.getHeight(sx, sz);
                    if (h <= WATER_LEVEL + 1) continue;
                    // Verify the 2 blocks above the surface are not solid (e.g. tree trunks)
                    const b1 = this.world.getBlock(sx, h + 1, sz);
                    const b2 = this.world.getBlock(sx, h + 2, sz);
                    if (!isBlockSolid(b1) && !isBlockSolid(b2)) {
                        this.position.set(sx + 0.5, h + 1.01, sz + 0.5);
                        return;
                    }
                }
            }
        }
        this.position.set(0.5, 90, 0.5);
    }
}
