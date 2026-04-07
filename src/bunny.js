import * as THREE from 'three';
import { isBlockSolid } from './blocks.js';

const GRAVITY = 25;
const JUMP_FORCE = 15;
const HOP_SPEED = 8;
const BUNNY_WIDTH = 0.8;
const BUNNY_HEIGHT = 3.8;

export class Bunny {
    constructor(world, x, y, z) {
        this.world = world;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.newPos = new THREE.Vector3();
        this.onGround = false;
        
        this.stateTimer = Math.random() * 2 + 1;
        this.facing = Math.random() * Math.PI * 2;
        
        this.buildMesh();
    }
    
    buildMesh() {
        this.meshGroup = new THREE.Group();
        
        const mat = new THREE.MeshLambertMaterial({ color: 0xffddaa });
        const matNose = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
        const matEye = new THREE.MeshLambertMaterial({ color: 0x222222 });

        // Body: 1.6 x 1.6 x 2.4 size
        const bodyGeo = new THREE.BoxGeometry(1.6, 1.6, 2.4);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.8, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        this.meshGroup.add(body);
        
        // Head: 1.2 x 1.2 x 1.2 
        const headGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 2.0, 1.0);
        head.castShadow = true;
        head.receiveShadow = true;
        this.meshGroup.add(head);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.4, 0.3, 0.2);
        const nose = new THREE.Mesh(noseGeo, matNose);
        nose.position.set(0, 1.8, 1.6);
        this.meshGroup.add(nose);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const eyeL = new THREE.Mesh(eyeGeo, matEye);
        eyeL.position.set(0.4, 2.2, 1.6);
        const eyeR = new THREE.Mesh(eyeGeo, matEye);
        eyeR.position.set(-0.4, 2.2, 1.6);
        this.meshGroup.add(eyeL);
        this.meshGroup.add(eyeR);
        
        // Ears: 0.4 x 1.6 x 0.2
        const earGeo = new THREE.BoxGeometry(0.4, 1.6, 0.2);
        const earL = new THREE.Mesh(earGeo, mat);
        earL.position.set(0.3, 3.2, 0.8);
        earL.castShadow = true;
        const earR = new THREE.Mesh(earGeo, mat);
        earR.position.set(-0.3, 3.2, 0.8);
        earR.castShadow = true;
        this.meshGroup.add(earL);
        this.meshGroup.add(earR);
        
        // Tail
        const tailGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const tail = new THREE.Mesh(tailGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
        tail.position.set(0, 1.2, -1.3);
        this.meshGroup.add(tail);

        this.world.scene.add(this.meshGroup);
    }
    
    update(dt) {
        dt = Math.min(dt, 0.05);

        this.stateTimer -= dt;
        
        // AI Logic
        if (this.onGround) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            
            if (this.stateTimer <= 0) {
                // Hop!
                this.facing += (Math.random() - 0.5) * Math.PI; // turn a bit
                this.velocity.x = Math.sin(this.facing) * HOP_SPEED;
                this.velocity.z = Math.cos(this.facing) * HOP_SPEED;
                this.velocity.y = JUMP_FORCE;
                this.onGround = false;
                
                // Next hop in 1-3 seconds
                this.stateTimer = Math.random() * 2 + 1;
            }
        }
        
        // Apply Gravity
        this.velocity.y -= GRAVITY * dt;
        
        // Move & Collide
        this.moveWithCollision(dt);
        
        // Update Mesh Position
        this.meshGroup.position.copy(this.position);
        
        // Face moving direction
        this.meshGroup.rotation.y = this.facing;
    }
    
    moveWithCollision(dt) {
        const newPos = this.newPos.copy(this.position);

        newPos.x += this.velocity.x * dt;
        if (this.collidesAt(newPos)) { newPos.x = this.position.x; this.velocity.x = 0; }

        newPos.z += this.velocity.z * dt;
        if (this.collidesAt(newPos)) { newPos.z = this.position.z; this.velocity.z = 0; }

        newPos.y += this.velocity.y * dt;
        if (this.collidesAt(newPos)) {
            if (this.velocity.y < 0) {
                newPos.y = Math.floor(this.position.y) + 0.001;
                if (this.collidesAt(newPos)) newPos.y = this.position.y;
                this.onGround = true;
            } else {
                newPos.y = this.position.y;
            }
            this.velocity.y = 0; // stop vertical momentum
        } else {
            this.onGround = false;
        }

        this.position.copy(newPos);
    }
    
    collidesAt(pos) {
        const w = BUNNY_WIDTH;
        for (let dx = -1; dx <= 1; dx += 2) {
            for (let dz = -1; dz <= 1; dz += 2) {
                for (let dy = 0; dy <= Math.ceil(BUNNY_HEIGHT); dy++) {
                    const checkY = pos.y + dy;
                    if (checkY > pos.y + BUNNY_HEIGHT) continue;
                    
                    const bx = Math.floor(pos.x + dx * w);
                    const by = Math.floor(checkY);
                    const bz = Math.floor(pos.z + dz * w);
                    if (isBlockSolid(this.world.getBlock(bx, by, bz))) {
                        return true;
                    }
                }
            }
        }
        if (isBlockSolid(this.world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)))) return true;
        return false;
    }
}
