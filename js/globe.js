import * as THREE from 'three';

const stage = document.getElementById('globe-stage');
const canvasHost = document.getElementById('globe-canvas');
const labelHost = document.getElementById('globe-labels');

// Sharp 4K imagery on desktop; lighter maps on phones so mobile data stays sane.
const HI = 'https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/';
const LO = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
// NASA Blue Marble composite — natural colours rather than a saturated stylised earth.
const BLUE_MARBLE = 'https://cdn.jsdelivr.net/gh/vasturiano/three-globe@master/example/img/earth-blue-marble.jpg';
const useHiRes = window.innerWidth >= 768;
const SRC = useHiRes
  ? { color: BLUE_MARBLE, bump: HI + 'elev_bump_4k.jpg', clouds: HI + 'fair_clouds_4k.png' }
  : { color: LO + 'earth_atmos_2048.jpg', bump: LO + 'earth_normal_2048.jpg', clouds: LO + 'earth_clouds_1024.png' };

const RADIUS = 1;

// Markets where the studio has shipped work. City entries sit on the city itself;
// country entries sit on the country's centre so the pill doesn't read as a capital.
// Several of these cluster tightly, so updateLabels() culls overlapping pills.
const markers = [
  { name: 'Delhi NCR', lat: 28.61, lon: 77.21 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Hyderabad', lat: 17.39, lon: 78.49 },
  { name: 'Bangalore', lat: 12.97, lon: 77.59 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Abu Dhabi', lat: 24.45, lon: 54.38 },
  { name: 'UAE', lat: 23.60, lon: 54.60 },
  { name: 'Lebanon', lat: 33.85, lon: 35.86 },
  { name: 'Greece', lat: 39.07, lon: 21.82 },
  { name: 'Ukraine', lat: 48.85, lon: 31.17 },
  { name: 'Germany', lat: 51.16, lon: 10.45 },
  { name: 'Denmark', lat: 55.68, lon: 12.57 },
  { name: 'Norway', lat: 59.91, lon: 10.75 },
  { name: 'Netherlands', lat: 52.37, lon: 4.90 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'USA', lat: 39.83, lon: -98.58 },
];

const latLonToVec3 = (lat, lon, r) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
};

function initGlobe() {
  const scene = new THREE.Scene();

  // Framed from slightly above so mid-latitudes sit inside the cropped band.
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.35, 2.75);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasHost.appendChild(renderer.domElement);

  // 8x is visually indistinguishable from max here but far cheaper on weak GPUs.
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const loader = new THREE.TextureLoader();
  // Anisotropic filtering keeps the surface sharp where it curves toward the limb.
  const load = (url, colorSpace, onReady) => {
    const t = loader.load(url, () => onReady && onReady());
    t.anisotropy = maxAniso;
    if (colorSpace) t.colorSpace = colorSpace;
    return t;
  };

  // Dragging turns this group, so the camera never moves and the crop stays put.
  const globe = new THREE.Group();
  scene.add(globe);

  // Nothing is shown until the surface texture lands, otherwise the untextured
  // sphere renders as a black disc while the download is in flight.
  const reveal = () => canvasHost.classList.add('is-ready');

  const earthMat = new THREE.MeshPhongMaterial({
    map: load(SRC.color, THREE.SRGBColorSpace, reveal),
    bumpMap: load(SRC.bump),
    bumpScale: 0.014,
    specular: new THREE.Color(0x151515),
    shininess: 8,
  });
  // Pull the land tones back toward muted browns/greys instead of vivid green.
  earthMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float _lum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
       diffuseColor.rgb = mix( vec3( _lum ), diffuseColor.rgb, 0.62 );`
    );
  };

  const earth = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 96), earthMat);
  // Start facing India / the Middle East rather than the default mid-Pacific view.
  earth.rotation.y = THREE.MathUtils.degToRad(205);
  globe.add(earth);

  // Clouds sit just above the surface and drift slightly faster than the globe.
  const cloudMat = new THREE.MeshLambertMaterial({
    map: load(SRC.clouds, THREE.SRGBColorSpace, () => { clouds.visible = true; }),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    emissive: new THREE.Color(0x3a3f47), // keeps cloud tops bright toward the limb
  });
  // Thicken the wispy edges so the cloud systems read as heavy weather, not haze.
  cloudMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       diffuseColor.a = clamp( diffuseColor.a * 2.1, 0.0, 1.0 );`
    );
  };

  const clouds = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.004, 64, 64), cloudMat);
  clouds.visible = false; // switched on by its own texture callback above
  clouds.rotation.y = earth.rotation.y;
  globe.add(clouds);

  // Marker dots ride along with the globe's rotation; the HTML pills track them.
  const markerGroup = new THREE.Group();
  earth.add(markerGroup);
  const dotGeo = new THREE.SphereGeometry(0.011, 12, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const pins = markers.map(({ name, lat, lon }) => {
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(latLonToVec3(lat, lon, RADIUS * 1.012));
    markerGroup.add(dot);

    const el = document.createElement('span');
    el.className = 'globe-label';
    el.textContent = name;
    labelHost.appendChild(el);

    return {
      dot, el, world: new THREE.Vector3(), shown: false,
      x: 0, y: 0, facing: -1, want: false,
      lx: 0, ly: 0, slot: 0, // resolved pill position, and which slot it settled in
    };
  });

  // Reused each frame to rank pills by how face-on they are; never re-allocated.
  const byFacing = pins.slice();

  // Daylight setup: key light near the camera axis keeps the facing hemisphere lit,
  // with enough fill that the limb falls off softly instead of going black.
  // Flat, bright daylight: heavy ambient with a soft key, so the surface stays
  // evenly lit and the limb falls off gently instead of dropping into shadow.
  scene.add(new THREE.AmbientLight(0xffffff, 1.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(0.5, 0.6, 2.5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdce6ff, 0.75);
  fill.position.set(-2, 0.4, 0.6);
  scene.add(fill);

  // Drag spins the globe on its own axis, unlimited on both axes so it never stops.
  const DRAG_SPEED = 0.0021; // radians per pixel — deliberately gentle
  const DRAG_THRESHOLD = 4;  // px of travel before a press counts as a drag
  let pointerDown = false;
  let dragging = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let velY = 0;
  let velX = 0;
  let idleFor = 0;

  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    // Note: `dragging` stays false here, so a plain click never halts the spin.
    pointerDown = true;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!pointerDown) return;

    if (!dragging) {
      // Wait for real travel before taking over from the idle spin.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_THRESHOLD) return;
      dragging = true;
      idleFor = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    globe.rotation.y += dx * DRAG_SPEED;
    globe.rotation.x += dy * DRAG_SPEED;
    // Carried into the spin-down after release.
    velY = dx * DRAG_SPEED;
    velX = dy * DRAG_SPEED;
  });

  const endDrag = (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    if (dragging) {
      dragging = false;
      idleFor = 0;
    }
    if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('pointerleave', endDrag);

  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener('resize', resize);

  // Only render while the section is actually on screen.
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { rootMargin: '150px' }
    ).observe(stage);
  }

  const toCam = new THREE.Vector3();
  const proj = new THREE.Vector3();
  const LABEL_GAP = 4;   // px of breathing room kept between neighbouring pills
  const DOT_GAP = 9;     // px between a dot and the pill anchored to it
  const EDGE = 6;        // px a pill must stay clear of the stage edges
  // Where a pill may sit relative to its dot, best first: beside it, then above or
  // below, then the diagonals. A pill is only dropped if every slot is taken.
  const SLOTS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  const placed = [];     // pill boxes already granted a slot this frame

  const updateLabels = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const viewportH = stage.parentElement.clientHeight;

    // Pass 1 — where each dot lands on screen, and how face-on it is.
    pins.forEach((pin) => {
      pin.dot.getWorldPosition(pin.world);
      // Facing check: hide pins that have rotated round the back of the globe.
      toCam.copy(camera.position).sub(pin.world).normalize();
      pin.facing = proj.copy(pin.world).normalize().dot(toCam);

      proj.copy(pin.world).project(camera);
      pin.x = (proj.x * 0.5 + 0.5) * w;
      pin.y = (-proj.y * 0.5 + 0.5) * h;
      pin.want = pin.facing > 0.12 &&
        pin.y > 4 && pin.y < viewportH - 4 && pin.x > 4 && pin.x < w - 4;
    });

    // Pass 2 — clusters like NW Europe or southern India put several dots within a
    // pill's width of each other, so pills are nudged off their dot into whichever
    // neighbouring slot is still free. Dots nearest the centre of the visible disc
    // choose first; only a pin with no free slot at all loses its label.
    byFacing.sort((a, b) => b.facing - a.facing);
    placed.length = 0;

    byFacing.forEach((pin) => {
      let show = false;

      if (pin.want) {
        const halfW = pin.el.offsetWidth / 2;
        const halfH = pin.el.offsetHeight / 2;
        const boxW = halfW + LABEL_GAP;
        const boxH = halfH + LABEL_GAP;

        // Last frame's slot is tried first so a pill doesn't hop about as the
        // globe turns; it only moves once that slot is genuinely blocked.
        for (let i = 0; i <= SLOTS.length; i++) {
          const [ox, oy] = SLOTS[i === 0 ? pin.slot : i - 1];
          const cx = pin.x + ox * (halfW + DOT_GAP);
          const cy = pin.y + oy * (halfH + DOT_GAP);

          // Skip slots the stage edges or the section's crop would slice through.
          if (cx - halfW < EDGE || cx + halfW > w - EDGE) continue;
          if (cy - halfH < EDGE || cy + halfH > viewportH - EDGE) continue;
          if (placed.some((r) =>
            Math.abs(cx - r.x) < boxW + r.halfW && Math.abs(cy - r.y) < boxH + r.halfH)) continue;

          placed.push({ x: cx, y: cy, halfW: boxW, halfH: boxH });
          pin.slot = i === 0 ? pin.slot : i - 1;
          pin.lx = cx;
          pin.ly = cy;
          show = true;
          break;
        }
      }

      if (show !== pin.shown) {
        pin.el.classList.toggle('is-visible', show);
        pin.shown = show;
      }
      if (show) {
        pin.el.style.transform = `translate(-50%, -50%) translate(${pin.lx}px, ${pin.ly}px)`;
      }
    });
  };

  const clock = new THREE.Clock();
  const animate = () => {
    requestAnimationFrame(animate);
    if (!visible) return;
    const dt = clock.getDelta();

    if (!dragging) {
      // Let the throw decay, then ease the idle spin back in.
      if (Math.abs(velY) > 0.00002 || Math.abs(velX) > 0.00002) {
        globe.rotation.y += velY;
        globe.rotation.x += velX;
        velY *= 0.94;
        velX *= 0.94;
      } else {
        velY = 0;
        velX = 0;
      }
      idleFor += dt;
      const ease = Math.min(idleFor / 1.2, 1);
      earth.rotation.y += dt * 0.02 * ease;
      clouds.rotation.y += dt * 0.024 * ease;
    }

    renderer.render(scene, camera);
    updateLabels();
  };
  animate();
}

if (stage && canvasHost && labelHost) {
  // The textures are heavy, so don't fetch them until the section is nearly in view.
  if ('IntersectionObserver' in window) {
    const warmup = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      warmup.disconnect();
      initGlobe();
    }, { rootMargin: '1400px' });
    warmup.observe(stage);
  } else {
    initGlobe();
  }
}
