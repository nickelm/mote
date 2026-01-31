/**
 * Surface Nets isosurface extraction
 * Based on S.F. Gibson, "Constrained Elastic Surface Nets" (1998)
 */

export class SurfaceNets {
    constructor() {
        this.cubeEdges = new Int32Array(24);
        this.edgeTable = new Int32Array(256);
        this.init();
    }

    init() {
        // Initialize cube edges
        let k = 0;
        for (let i = 0; i < 8; ++i) {
            for (let j = 1; j <= 4; j <<= 1) {
                const p = i ^ j;
                if (i <= p) {
                    this.cubeEdges[k++] = i;
                    this.cubeEdges[k++] = p;
                }
            }
        }

        // Initialize edge table
        for (let i = 0; i < 256; ++i) {
            let em = 0;
            for (let j = 0; j < 24; j += 2) {
                const a = !!(i & (1 << this.cubeEdges[j]));
                const b = !!(i & (1 << this.cubeEdges[j + 1]));
                em |= a !== b ? (1 << (j >> 1)) : 0;
            }
            this.edgeTable[i] = em;
        }
    }

    extract(densityFunc, bounds, resolution) {
        const dims = [resolution, resolution, resolution];
        const scale = [
            (bounds[1][0] - bounds[0][0]) / (dims[0] - 1),
            (bounds[1][1] - bounds[0][1]) / (dims[1] - 1),
            (bounds[1][2] - bounds[0][2]) / (dims[2] - 1)
        ];

        const vertices = [];
        const faces = [];
        const grid = new Float32Array(8);

        // 3D buffer to store vertex indices - use a Map for sparse storage
        const vertexBuffer = new Map();
        const getKey = (x, y, z) => `${x},${y},${z}`;

        // March over the volume
        for (let z = 0; z < dims[2] - 1; ++z) {
            for (let y = 0; y < dims[1] - 1; ++y) {
                for (let x = 0; x < dims[0] - 1; ++x) {
                    const xPos = bounds[0][0] + x * scale[0];
                    const yPos = bounds[0][1] + y * scale[1];
                    const zPos = bounds[0][2] + z * scale[2];

                    // Read 8 corners of the cube
                    let mask = 0;
                    let g = 0;
                    for (let dz = 0; dz < 2; ++dz) {
                        for (let dy = 0; dy < 2; ++dy) {
                            for (let dx = 0; dx < 2; ++dx) {
                                const val = densityFunc(
                                    xPos + dx * scale[0],
                                    yPos + dy * scale[1],
                                    zPos + dz * scale[2]
                                );
                                grid[g] = val;
                                mask |= val < 0 ? (1 << g) : 0;
                                g++;
                            }
                        }
                    }

                    // Skip if cube is entirely inside or outside
                    if (mask === 0 || mask === 0xff) {
                        continue;
                    }

                    // Compute vertex position using edge crossings
                    const edgeMask = this.edgeTable[mask];
                    let vertCount = 0;
                    const v = [0, 0, 0];

                    for (let i = 0; i < 12; ++i) {
                        if (!(edgeMask & (1 << i))) continue;

                        const e0 = this.cubeEdges[i << 1];
                        const e1 = this.cubeEdges[(i << 1) + 1];
                        const g0 = grid[e0];
                        const g1 = grid[e1];
                        const t = g0 / (g0 - g1);

                        let k = 1;
                        for (let j = 0; j < 3; ++j) {
                            const a = e0 & k;
                            const b = e1 & k;
                            if (a !== b) {
                                v[j] += a ? 1 - t : t;
                            } else {
                                v[j] += a ? 1 : 0;
                            }
                            k <<= 1;
                        }
                        vertCount++;
                    }

                    // Average the edge crossing points
                    const s = 1.0 / vertCount;
                    const vertIdx = vertices.length;
                    vertices.push([
                        xPos + v[0] * s * scale[0],
                        yPos + v[1] * s * scale[1],
                        zPos + v[2] * s * scale[2]
                    ]);

                    // Store vertex index
                    vertexBuffer.set(getKey(x, y, z), vertIdx);

                    // Generate faces - check edges in each direction

                    // X-axis faces (need neighbors at y-1 and z-1)
                    if (edgeMask & 1) {
                        if (y > 0 && z > 0) {
                            const v0 = vertexBuffer.get(getKey(x, y, z));
                            const v1 = vertexBuffer.get(getKey(x, y - 1, z));
                            const v2 = vertexBuffer.get(getKey(x, y - 1, z - 1));
                            const v3 = vertexBuffer.get(getKey(x, y, z - 1));

                            if (v0 !== undefined && v1 !== undefined && v2 !== undefined && v3 !== undefined) {
                                if (mask & 1) {
                                    faces.push([v0, v1, v2]);
                                    faces.push([v0, v2, v3]);
                                } else {
                                    faces.push([v0, v3, v2]);
                                    faces.push([v0, v2, v1]);
                                }
                            }
                        }
                    }

                    // Y-axis faces (need neighbors at x-1 and z-1)
                    if (edgeMask & 2) {
                        if (x > 0 && z > 0) {
                            const v0 = vertexBuffer.get(getKey(x, y, z));
                            const v1 = vertexBuffer.get(getKey(x, y, z - 1));
                            const v2 = vertexBuffer.get(getKey(x - 1, y, z - 1));
                            const v3 = vertexBuffer.get(getKey(x - 1, y, z));

                            if (v0 !== undefined && v1 !== undefined && v2 !== undefined && v3 !== undefined) {
                                if (mask & 1) {
                                    faces.push([v0, v1, v2]);
                                    faces.push([v0, v2, v3]);
                                } else {
                                    faces.push([v0, v3, v2]);
                                    faces.push([v0, v2, v1]);
                                }
                            }
                        }
                    }

                    // Z-axis faces (need neighbors at x-1 and y-1)
                    if (edgeMask & 4) {
                        if (x > 0 && y > 0) {
                            const v0 = vertexBuffer.get(getKey(x, y, z));
                            const v1 = vertexBuffer.get(getKey(x - 1, y, z));
                            const v2 = vertexBuffer.get(getKey(x - 1, y - 1, z));
                            const v3 = vertexBuffer.get(getKey(x, y - 1, z));

                            if (v0 !== undefined && v1 !== undefined && v2 !== undefined && v3 !== undefined) {
                                if (mask & 1) {
                                    faces.push([v0, v1, v2]);
                                    faces.push([v0, v2, v3]);
                                } else {
                                    faces.push([v0, v3, v2]);
                                    faces.push([v0, v2, v1]);
                                }
                            }
                        }
                    }
                }
            }
        }

        return { vertices, faces };
    }
}
