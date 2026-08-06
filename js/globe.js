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

// Cities where the studio has shipped work. Spread apart so the pills don't collide.
const markers = [
  { name: 'Delhi NCR', lat: 28.61, lon: 77.21 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
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
  const load = (url, colorSpace) => {
    const t = loader.load(url);
    t.anisotropy = maxAniso;
    if (colorSpace) t.colorSpace = colorSpace;
    return t;
  };

  // Dragging turns this group, so the camera never moves and the crop stays put.
  const globe = new THREE.Group();
  scene.add(globe);

  const earthMat = new THREE.MeshPhongMaterial({
    map: load(SRC.color, THREE.SRGBColorSpace),
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
    map: load(SRC.clouds, THREE.SRGBColorSpace),
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

    return { dot, el, world: new THREE.Vector3(), shown: false };
  });

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
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velY = 0;
  let velX = 0;
  let idleFor = 0;

  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    idleFor = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    globe.rotation.y += dx * 0.005;
    globe.rotation.x += dy * 0.005;
    // Carried into the spin-down after release.
    velY = dx * 0.005;
    velX = dy * 0.005;
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    idleFor = 0;
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
  const updateLabels = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const viewportH = stage.parentElement.clientHeight;

    pins.forEach((pin) => {
      pin.dot.getWorldPosition(pin.world);
      // Facing check: hide pins that have rotated round the back of the globe.
      toCam.copy(camera.position).sub(pin.world).normalize();
      const facing = pin.world.clone().normalize().dot(toCam) > 0.12;

      const p = pin.world.clone().project(camera);
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      // Hide anything the section's crop or the side edges would slice through.
      const margin = pin.el.offsetWidth / 2 + 8;
      const inFrame = y > 16 && y < viewportH - 12 && x > margin && x < w - margin;

      const show = facing && inFrame;
      if (show !== pin.shown) {
        pin.el.classList.toggle('is-visible', show);
        pin.shown = show;
      }
      if (show) {
        pin.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
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
      earth.rotation.y += dt * 0.05 * ease;
      clouds.rotation.y += dt * 0.058 * ease;
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
    }, { rootMargin: '700px' });
    warmup.observe(stage);
  } else {
    initGlobe();
  }
}
