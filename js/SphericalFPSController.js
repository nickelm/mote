import * as THREE from 'three';

/**
 * First-person controller with spherical gravity
 * Handles movement on a tiny planet where "up" always points away from center
 */
export class SphericalFPSController {
    constructor(camera, planet) {
        this.camera = camera;
        this.planet = planet;

        // Player state
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.up = new THREE.Vector3(0, 1, 0);

        // We store the actual forward vector and maintain it via parallel transport
        this.forward = new THREE.Vector3(0, 0, -1);
        this.pitch = 0;

        // Physics params
        this.gravity = 15;
        this.jumpForce = 12;
        this.moveSpeed = 8;
        this.mouseSensitivity = 0.002;
        this.playerHeight = 1.8;
        this.isGrounded = false;

        // Input state
        this.keys = {};
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.isLocked = false;

        this.setupInput();
        this.spawn();
    }

    spawn() {
        // Position player on top of planet
        this.up = new THREE.Vector3(0, 1, 0);
        const surfaceHeight = this.planet.radius * 1.1;
        this.position.copy(this.planet.center).add(this.up.clone().multiplyScalar(surfaceHeight + this.playerHeight));

        // Forward is in tangent plane
        this.forward = new THREE.Vector3(0, 0, -1);
        this.pitch = 0;
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.mouseDX += e.movementX;
                this.mouseDY += e.movementY;
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement !== null;
            const startScreen = document.getElementById('click-to-start');
            if (startScreen) {
                startScreen.classList.toggle('hidden', this.isLocked);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.isLocked) {
                document.body.requestPointerLock();
            }
        });
    }

    update(dt) {
        dt = Math.min(dt, 0.1);

        // Store old up for parallel transport
        const oldUp = this.up.clone();

        // Update up vector based on gravity
        this.up = this.planet.getGravityDirection(this.position).negate();

        // Parallel transport forward vector to new tangent plane
        const dot = oldUp.dot(this.up);
        if (dot < 0.9999) {
            const axis = new THREE.Vector3().crossVectors(oldUp, this.up);
            if (axis.lengthSq() > 0.000001) {
                axis.normalize();
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
                this.forward.applyQuaternion(quat);
            }
        }

        // Ensure forward stays in tangent plane
        this.forward.sub(this.up.clone().multiplyScalar(this.forward.dot(this.up)));
        this.forward.normalize();

        // Compute right vector
        const right = new THREE.Vector3().crossVectors(this.up, this.forward).normalize();

        // Apply mouse yaw - rotate forward around up axis
        const yawAmount = -this.mouseDX * this.mouseSensitivity;
        if (Math.abs(yawAmount) > 0.0001) {
            const yawQuat = new THREE.Quaternion().setFromAxisAngle(this.up, yawAmount);
            this.forward.applyQuaternion(yawQuat).normalize();
        }

        // Apply mouse pitch (mouse down = look down)
        this.pitch -= this.mouseDY * this.mouseSensitivity;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));

        this.mouseDX = 0;
        this.mouseDY = 0;

        // Recompute right after yaw
        right.crossVectors(this.up, this.forward).normalize();

        // Movement input
        const moveDir = new THREE.Vector3();
        if (this.keys['KeyW']) moveDir.add(this.forward);
        if (this.keys['KeyS']) moveDir.sub(this.forward);
        if (this.keys['KeyD']) moveDir.sub(right);
        if (this.keys['KeyA']) moveDir.add(right);

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize().multiplyScalar(this.moveSpeed);
        }

        // Apply gravity
        const gravityDir = this.planet.getGravityDirection(this.position);
        this.velocity.add(gravityDir.multiplyScalar(this.gravity * dt));

        // Ground check and response
        const distToSurface = this.planet.getDistance(this.position);
        this.isGrounded = distToSurface < this.playerHeight + 0.3;

        if (this.isGrounded && distToSurface < this.playerHeight) {
            this.position.add(this.up.clone().multiplyScalar(this.playerHeight - distToSurface));

            const velDotUp = this.velocity.dot(this.up);
            if (velDotUp < 0) {
                this.velocity.sub(this.up.clone().multiplyScalar(velDotUp));
            }
        }

        // Jump
        if (this.keys['Space'] && this.isGrounded) {
            this.velocity.add(this.up.clone().multiplyScalar(this.jumpForce));
        }

        // Apply movement and velocity
        this.position.add(moveDir.clone().multiplyScalar(dt));
        this.position.add(this.velocity.clone().multiplyScalar(dt));

        // Damping
        this.velocity.multiplyScalar(0.98);

        // Update camera
        this.camera.position.copy(this.position);
        this.camera.up.copy(this.up);

        // Look direction: forward rotated by pitch around right axis
        const lookDir = this.forward.clone();
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(right, -this.pitch);
        lookDir.applyQuaternion(pitchQuat);

        this.camera.lookAt(this.position.clone().add(lookDir));
    }

    getRaycastOrigin() {
        return this.camera.position.clone();
    }

    getRaycastDirection() {
        const right = new THREE.Vector3().crossVectors(this.up, this.forward).normalize();
        const lookDir = this.forward.clone();
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(right, -this.pitch);
        lookDir.applyQuaternion(pitchQuat);
        return lookDir;
    }
}
