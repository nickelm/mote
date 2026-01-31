# Mote

A tiny planet exploration game built with Three.js. Walk around miniature spherical worlds with realistic gravity, mine terrain, and explore.

<!-- ![Mote Screenshot](screenshot.png) -->

## Play

Visit the live demo: [https://nickelm.github.io/mote](https://nickelm.github.io/mote)

Or run locally:
```bash
# Any static file server works
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Look around |
| Space | Jump |
| Left Click | Mine terrain |
| Right Click | Place terrain |
| F | Toggle wireframe |
| T | Toggle torch |

## Features

- **Spherical gravity**: Walk around the entire planet, even upside-down
- **Procedural terrain**: Surface nets mesh generation from signed distance functions
- **Multi-octave noise**: Continental, mountain, hill, and micro-detail terrain layers
- **Real-time terrain modification**: Mine and place material
- **Dynamic lighting**: Sun illumination with player torch for dark side exploration

## Technical Details

### Architecture

- `index.html` - Entry point and styling
- `js/main.js` - Application setup, rendering loop, interaction handling
- `js/SurfaceNets.js` - Isosurface extraction algorithm
- `js/TinyPlanet.js` - Planet SDF, terrain generation, mesh management
- `js/SphericalFPSController.js` - First-person controls with spherical gravity

### Terrain Generation

Terrain is defined as a signed distance function (SDF) combining:
1. Base sphere
2. Continental noise (low frequency, large amplitude)
3. Ridged mountain noise (medium frequency, sharp peaks)
4. Hill noise (medium-high frequency)
5. Micro detail (high frequency, small amplitude)

The SDF is polygonized using surface nets, which produces smoother results than marching cubes while being simpler than dual contouring.

### Spherical Movement

The player controller maintains a forward vector that is parallel-transported as the player moves around the sphere. This preserves heading direction while continuously adapting to the changing "up" direction (always away from planet center).

## Future Ideas

- Multiple planets with inter-planetary travel
- Resource gathering and crafting
- Base building with explicit geometry (not just SDF modifications)
- Vegetation and atmosphere effects
- Multiplayer

## License

MIT License - see [LICENSE](LICENSE)

## Credits

- Three.js for 3D rendering
- Perlin noise implementation based on classic algorithms
- Surface nets based on S.F. Gibson's "Constrained Elastic Surface Nets" (1998)
