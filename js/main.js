import * as THREE from 'three';
import { TinyPlanet } from './TinyPlanet.js';
import { SphericalFPSController } from './SphericalFPSController.js';

/**
 * Main application class
 */
export class App {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        this.scene.fog = new THREE.FogExp2(0x000011, 0.003);

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.debug = document.getElementById('debug');

        this.setupLighting();
        this.createPlanet();
        this.createStarfield();
        this.setupController();
        this.setupInteraction();

        window.addEventListener('resize', () => this.onResize());

        this.animate();
    }

    setupLighting() {
        // Sun light
        const sunLight = new THREE.DirectionalLight(0xffffee, 2);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 50;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        this.scene.add(sunLight);

        // Ambient light
        const ambient = new THREE.AmbientLight(0x222244, 0.5);
        this.scene.add(ambient);

        // Hemisphere light for subtle color variation
        const hemi = new THREE.HemisphereLight(0x446688, 0x442211, 0.3);
        this.scene.add(hemi);
    }

    createPlanet() {
        const planetCenter = new THREE.Vector3(0, 0, 0);
        const planetRadius = 25; // 25m radius = 50m diameter

        console.log('Generating planet mesh...');
        const startTime = performance.now();

        this.planet = new TinyPlanet(this.scene, planetCenter, planetRadius, 120);

        const elapsed = performance.now() - startTime;
        console.log(`Planet generated in ${elapsed.toFixed(0)}ms`);
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 400 + Math.random() * 100;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const brightness = 0.5 + Math.random() * 0.5;
            colors[i * 3] = brightness;
            colors[i * 3 + 1] = brightness;
            colors[i * 3 + 2] = brightness * (0.8 + Math.random() * 0.4);
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    setupController() {
        this.controller = new SphericalFPSController(this.camera, this.planet);

        // Player torch light
        this.torch = new THREE.PointLight(0xffeecc, 0, 30);
        this.torch.castShadow = false;
        this.torchOn = false;
        this.camera.add(this.torch);
        this.scene.add(this.camera);
    }

    toggleTorch() {
        this.torchOn = !this.torchOn;
        this.torch.intensity = this.torchOn ? 2 : 0;
        return this.torchOn;
    }

    setupInteraction() {
        this.raycaster = new THREE.Raycaster();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF') {
                const isWireframe = this.planet.toggleWireframe();
                console.log('Wireframe:', isWireframe ? 'ON' : 'OFF');
            }
            if (e.code === 'KeyT') {
                const torchOn = this.toggleTorch();
                console.log('Torch:', torchOn ? 'ON' : 'OFF');
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (!this.controller.isLocked) return;

            const origin = this.controller.getRaycastOrigin();
            const direction = this.controller.getRaycastDirection();

            this.raycaster.set(origin, direction);

            const intersects = this.raycaster.intersectObject(this.planet.mesh);

            if (intersects.length > 0) {
                const hit = intersects[0];

                if (e.button === 0) {
                    // Left click - mine
                    this.planet.mine(hit.point, 3);
                } else if (e.button === 2) {
                    // Right click - place
                    const placePos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(2));
                    this.planet.place(placePos, 2);
                }
            }
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const dt = this.clock.getDelta();

        this.controller.update(dt);

        // Update debug info
        if (this.debug) {
            const dist = this.planet.getDistance(this.controller.position);
            const grounded = this.controller.isGrounded ? 'YES' : 'NO';
            this.debug.innerHTML = `
                Height: ${dist.toFixed(1)}m<br>
                Grounded: ${grounded}<br>
                Mods: ${this.planet.modifications.length}
            `;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Auto-start when module loads
const app = new App();
