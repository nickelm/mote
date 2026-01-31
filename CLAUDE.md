# CLAUDE.md

This file provides context for AI assistants (like Claude) working on this codebase.

## Project Overview

Mote is a browser-based tiny planet exploration game. Players walk around small spherical planets (50m diameter) with realistic spherical gravity, mine terrain, and explore. Think Super Mario Galaxy meets Minecraft.

## Tech Stack

- **Three.js** (v0.160.0) - 3D rendering, loaded via ES modules from unpkg CDN
- **Vanilla JavaScript** - ES modules, no build step required
- **GitHub Pages** - Static hosting target

## Architecture

```
mote/
├── index.html              # Entry point, styles, importmap
├── js/
│   ├── main.js             # App class, render loop, interaction
│   ├── SurfaceNets.js      # Isosurface extraction from SDF
│   ├── TinyPlanet.js       # Planet terrain SDF and mesh
│   └── SphericalFPSController.js  # Player movement
├── README.md
├── CLAUDE.md               # This file
└── LICENSE                 # MIT
```

## Key Concepts

### Signed Distance Functions (SDF)
The planet terrain is defined implicitly as an SDF - a function returning the distance to the nearest surface (negative = inside solid, positive = in air). This allows:
- Smooth terrain blending
- Easy CSG operations (mining = sphere subtraction, placing = sphere union)
- Resolution-independent definition

### Surface Nets
A mesh extraction algorithm that converts the SDF to triangles. It places vertices at the average of edge crossings within each cell, producing smoother results than marching cubes. The implementation is in `SurfaceNets.js`.

### Spherical Gravity
The player's "up" vector always points away from the planet center. Movement uses parallel transport to maintain heading direction as the player walks around the sphere. This is handled in `SphericalFPSController.js`.

### Terrain Layers
Terrain noise is composed of multiple octaves:
1. Continental (2x frequency, 8% radius) - broad elevation
2. Mountains (4-6x frequency, 15% radius) - ridged noise for peaks
3. Hills (10x frequency, 3% radius) - medium bumps
4. Micro (25-50x frequency, 2% radius) - surface detail

## Common Tasks

### Adjusting terrain
Edit `TinyPlanet.js` → `sdf()` method. Modify noise frequencies and amplitudes.

### Changing planet size
Edit `main.js` → `createPlanet()`. Adjust `planetRadius` and `resolution`.

### Adding controls
Edit `SphericalFPSController.js` → `setupInput()` for key bindings, `update()` for behavior.

### Performance tuning
- Reduce `resolution` in `createPlanet()` for faster mesh generation
- Terrain modifications trigger full mesh rebuild (could be optimized with chunking)

## Known Limitations

1. **No tunneling** - Collision uses radial "up", so digging down doesn't work properly yet
2. **Mesh rebuild on edit** - Mining/placing regenerates entire planet mesh (slow for large planets)
3. **Single planet** - Multi-planet support not yet implemented
4. **No save/load** - Terrain modifications are lost on refresh

## Development

No build step required. Just serve the directory:

```bash
npx serve .
# or
python -m http.server 8000
```

For GitHub Pages, push to main branch and enable Pages in repo settings.

## Code Style

- ES modules with explicit imports
- Classes for major components (TinyPlanet, SphericalFPSController, App)
- Descriptive variable names
- Comments for non-obvious math (noise, SDF operations, parallel transport)
