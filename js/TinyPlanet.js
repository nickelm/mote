import * as THREE from 'three';
import { SurfaceNets } from './SurfaceNets.js';

/**
 * A tiny spherical planet with procedural terrain
 */
export class TinyPlanet {
    constructor(scene, center, radius, resolution = 64) {
        this.scene = scene;
        this.center = center.clone();
        this.radius = radius;
        this.resolution = resolution;
        this.modifications = []; // List of {position, radius, add} for CSG ops
        this.wireframe = false;

        this.mesh = null;
        this.surfaceNets = new SurfaceNets();
        this.initNoise();
        this.generateMesh();
    }

    // Permutation table for Perlin noise
    initNoise() {
        this.perm = new Uint8Array(512);
        const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        for (let i = 0; i < 256; i++) {
            this.perm[i] = this.perm[i + 256] = p[i];
        }
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

    lerp(a, b, t) { return a + t * (b - a); }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    // Proper Perlin noise - consistent for any input coordinates
    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;

        return this.lerp(
            this.lerp(
                this.lerp(this.grad(this.perm[AA], x, y, z), this.grad(this.perm[BA], x - 1, y, z), u),
                this.lerp(this.grad(this.perm[AB], x, y - 1, z), this.grad(this.perm[BB], x - 1, y - 1, z), u),
                v
            ),
            this.lerp(
                this.lerp(this.grad(this.perm[AA + 1], x, y, z - 1), this.grad(this.perm[BA + 1], x - 1, y, z - 1), u),
                this.lerp(this.grad(this.perm[AB + 1], x, y - 1, z - 1), this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1), u),
                v
            ),
            w
        );
    }

    // Signed distance function for the planet
    sdf(x, y, z) {
        const dx = x - this.center.x;
        const dy = y - this.center.y;
        const dz = z - this.center.z;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Base sphere
        let dist = distFromCenter - this.radius;

        // Normalized direction for noise sampling (position on unit sphere)
        const nx = dx / distFromCenter;
        const ny = dy / distFromCenter;
        const nz = dz / distFromCenter;

        // === TERRAIN LAYERS ===

        // 1. Continental scale - broad elevation differences
        const continentNoise = this.noise3D(nx * 2, ny * 2, nz * 2);
        const continentHeight = continentNoise * this.radius * 0.08;

        // 2. Mountain ranges - ridged noise for sharp peaks
        const mountainNoise1 = this.noise3D(nx * 4 + 50, ny * 4 + 50, nz * 4 + 50);
        // Ridged noise: take absolute value and invert for sharp ridges
        const ridged = 1.0 - Math.abs(mountainNoise1);
        const mountainHeight = Math.pow(ridged, 2) * this.radius * 0.15;

        // 3. Hills - medium frequency
        const hillNoise = this.noise3D(nx * 10, ny * 10, nz * 10);
        const hillHeight = hillNoise * this.radius * 0.03;

        // 4. Micro detail - rocks and small bumps
        const microNoise1 = this.noise3D(nx * 25, ny * 25, nz * 25);
        const microNoise2 = this.noise3D(nx * 50, ny * 50, nz * 50);
        const microHeight = (microNoise1 * 0.015 + microNoise2 * 0.008) * this.radius;

        // Combine all layers
        dist -= continentHeight;
        dist -= mountainHeight;
        dist -= hillHeight;
        dist -= microHeight;

        // Apply modifications (mining/building)
        for (const mod of this.modifications) {
            const mdx = x - mod.position.x;
            const mdy = y - mod.position.y;
            const mdz = z - mod.position.z;
            const modDist = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz) - mod.radius;

            if (mod.add) {
                dist = Math.min(dist, modDist);
            } else {
                dist = Math.max(dist, -modDist);
            }
        }

        return dist;
    }

    generateMesh() {
        const padding = this.radius * 0.3;
        const bounds = [
            [this.center.x - this.radius - padding,
             this.center.y - this.radius - padding,
             this.center.z - this.radius - padding],
            [this.center.x + this.radius + padding,
             this.center.y + this.radius + padding,
             this.center.z + this.radius + padding]
        ];

        const result = this.surfaceNets.extract(
            (x, y, z) => this.sdf(x, y, z),
            bounds,
            this.resolution
        );

        // Remove old mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
        }

        // Create new geometry
        const geometry = new THREE.BufferGeometry();

        const positions = new Float32Array(result.vertices.length * 3);
        for (let i = 0; i < result.vertices.length; i++) {
            positions[i * 3] = result.vertices[i][0];
            positions[i * 3 + 1] = result.vertices[i][1];
            positions[i * 3 + 2] = result.vertices[i][2];
        }

        const indices = [];
        for (const face of result.faces) {
            indices.push(face[0], face[1], face[2]);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Create vertex colors based on height/slope
        const colors = new Float32Array(result.vertices.length * 3);
        for (let i = 0; i < result.vertices.length; i++) {
            const v = result.vertices[i];
            const dx = v[0] - this.center.x;
            const dy = v[1] - this.center.y;
            const dz = v[2] - this.center.z;
            const height = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const normalized = (height - this.radius * 0.85) / (this.radius * 0.3);

            // Color gradient: deep brown -> grass green -> rock gray -> snow white
            let r, g, b;
            if (normalized < 0.3) {
                r = 0.4; g = 0.25; b = 0.1;
            } else if (normalized < 0.6) {
                const t = (normalized - 0.3) / 0.3;
                r = 0.4 * (1 - t) + 0.3 * t;
                g = 0.25 * (1 - t) + 0.5 * t;
                b = 0.1 * (1 - t) + 0.2 * t;
            } else if (normalized < 0.85) {
                const t = (normalized - 0.6) / 0.25;
                r = 0.3 * (1 - t) + 0.5 * t;
                g = 0.5 * (1 - t) + 0.5 * t;
                b = 0.2 * (1 - t) + 0.5 * t;
            } else {
                r = 0.9; g = 0.9; b = 0.95;
            }

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.05,
            flatShading: false,
            wireframe: this.wireframe || false
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    toggleWireframe() {
        this.wireframe = !this.wireframe;
        if (this.mesh && this.mesh.material) {
            this.mesh.material.wireframe = this.wireframe;
        }
        return this.wireframe;
    }

    mine(position, radius = 2) {
        this.modifications.push({
            position: position.clone(),
            radius: radius,
            add: false
        });
        this.generateMesh();
    }

    place(position, radius = 2) {
        this.modifications.push({
            position: position.clone(),
            radius: radius,
            add: true
        });
        this.generateMesh();
    }

    // Get surface normal at a point (gradient of SDF)
    getNormal(position) {
        const eps = 0.1;
        const x = position.x;
        const y = position.y;
        const z = position.z;

        const normal = new THREE.Vector3(
            this.sdf(x + eps, y, z) - this.sdf(x - eps, y, z),
            this.sdf(x, y + eps, z) - this.sdf(x, y - eps, z),
            this.sdf(x, y, z + eps) - this.sdf(x, y, z - eps)
        );
        return normal.normalize();
    }

    // Get distance to surface at a point
    getDistance(position) {
        return this.sdf(position.x, position.y, position.z);
    }

    // Get gravity direction at a point (toward center)
    getGravityDirection(position) {
        const dir = this.center.clone().sub(position);
        return dir.normalize();
    }
}
