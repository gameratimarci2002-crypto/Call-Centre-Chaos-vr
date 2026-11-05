import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let camera, scene, renderer;
let controller1, controller2;
let wand;

init();

function init() {
    // 1. Szcéna és Kamera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101020); // Sötét, varázslatos éjszakai háttér
    scene.fog = new THREE.FogExp2(0x101020, 0.05);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3); // Átlagos szemmagasság (1.6m)

    // 2. Fények
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // 3. Padló (Roxfort Nagy Terem / Pince aljzat)
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 4. Renderer & WebXR Engedélyezése
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // 5. VR Kontrollerek Beállítása
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', castSpell); // Trigger gomb = Varázslás
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    // 6. Varázspálca modell készítése és kontrollerhez csatolása
    const wandGeometry = new THREE.CylinderGeometry(0.005, 0.01, 0.35, 16);
    const wandMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.6 });
    wand = new THREE.Mesh(wandGeometry, wandMaterial);
    wand.rotation.x = -Math.PI / 2;
    wand.position.z = -0.15; // Előretolás a kézben

    // Pálca hegye (fény kibocsátásához - Lumos)
    const tipGeometry = new THREE.SphereGeometry(0.01, 8, 8);
    const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.y = 0.175;
    wand.add(tip);

    controller1.add(wand);

    // Ablak átméretezés kezelése
    window.addEventListener('resize', onWindowResize);

    // Animációs ciklus elindítása
    renderer.setAnimationLoop(render);
}

// Varázslat kilövése (Stupefy / Expelliarmus piros lövedék)
function castSpell() {
    if (!wand) return;

    // Lövedék készítése
    const spellGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const spellMaterial = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const spell = new THREE.Mesh(spellGeometry, spellMaterial);

    // Megkeressük a pálca hegyének globális pozícióját és irányát
    const wandWorldPos = new THREE.Vector3();
    const wandWorldDir = new THREE.Vector3();
    
    wand.getWorldPosition(wandWorldPos);
    wand.getWorldDirection(wandWorldDir);

    spell.position.copy(wandWorldPos);
    scene.add(spell);

    // Sebesség vektor (pálca mutatási iránya alapján)
    const velocity = wandWorldDir.multiplyScalar(-0.3);

    // Lövedék mozgatása animációval
    const interval = setInterval(() => {
        spell.position.add(velocity);
        
        // Ha túl messzire ment, töröljük
        if (spell.position.distanceTo(wandWorldPos) > 20) {
            scene.remove(spell);
            spell.geometry.dispose();
            spell.material.dispose();
            clearInterval(interval);
        }
    }, 16);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    renderer.render(scene, camera);
}