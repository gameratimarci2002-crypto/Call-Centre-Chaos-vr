import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller1, controller2;
let wand, wandTip;

init();

function init() {
    // 1. Szcéna & Éjszakai Roxforti Atmoszféra
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.03);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 1.6, 0);

    // 2. Fények
    const ambientLight = new THREE.AmbientLight(0x405080, 1.5);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x99bbff, 2);
    moonLight.position.set(10, 20, -10);
    scene.add(moonLight);

    // 3. Renderer & WebXR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // 4. Roxfort Térkép / 3D Modell Betöltése (.glb)
    // Megjegyzés: Tegyél egy 'hogwarts.glb' modellt a projekted mappájába, ha van sajátod!
    const loader = new GLTFLoader();
    loader.load(
        './hogwarts.glb', 
        (gltf) => {
            const hogwartsMap = gltf.scene;
            hogwartsMap.position.set(0, 0, 0);
            hogwartsMap.scale.set(1, 1, 1);
            scene.add(hogwartsMap);
        },
        undefined,
        (error) => {
            console.log('Saját GLB modell nem található, alapértelmezett Roxforti terem generálása...');
            createFallbackHogwartsEnvironment();
        }
    );

    // 5. VR Kontrollerek
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', castSpell);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    // 6. Varázspálca és a Pálca Hegye (Wand Tip)
    const wandGroup = new THREE.Group();

    // Pálca teste (35 cm hosszú)
    const wandGeometry = new THREE.CylinderGeometry(0.004, 0.008, 0.35, 16);
    const wandMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.5 });
    const wandMesh = new THREE.Mesh(wandGeometry, wandMaterial);
    
    // Elforgatjuk és előretoljuk, hogy a kontroller előre mutasson
    wandMesh.rotation.x = Math.PI / 2;
    wandMesh.position.z = -0.175;
    wandGroup.add(wandMesh);

    // Pálca hegye (Pontosan a pálca csúcsán: z = -0.35)
    wandTip = new THREE.Object3D();
    wandTip.position.set(0, 0, -0.35);
    wandGroup.add(wandTip);

    // Varázsfény a pálca hegyén (Lumos effekt)
    const tipLightGeometry = new THREE.SphereGeometry(0.01, 8, 8);
    const tipLightMaterial = new THREE.MeshBasicMaterial({ color: 0x88ffff });
    const tipMesh = new THREE.Mesh(tipLightGeometry, tipLightMaterial);
    wandTip.add(tipMesh);

    controller1.add(wandGroup);

    window.addEventListener('resize', onWindowResize);
    renderer.setAnimationLoop(render);
}

// 7. Varázslat kilövése PONTOSAN a pálca hegyéből
function castSpell() {
    if (!wandTip) return;

    // Megkeressük a pálca hegyének PONTOS világpozícióját
    const spellOrigin = new THREE.Vector3();
    wandTip.getWorldPosition(spellOrigin);

    // Meghatározzuk a pálca mutatási irányát
    const spellDirection = new THREE.Vector3();
    wandTip.getWorldDirection(spellDirection);
    // A Three.js z-tengely korrekció miatt megfordítjuk az irányt
    spellDirection.negate();

    // Lövedék létrehozása (Piros stílusú Stupefy/Expelliarmus)
    const spellGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const spellMaterial = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const spell = new THREE.Mesh(spellGeometry, spellMaterial);

    // Fényforrás a varázslat köré
    const spellLight = new THREE.PointLight(0xff1133, 3, 5);
    spell.add(spellLight);

    spell.position.copy(spellOrigin);
    scene.add(spell);

    // Lövedék repülési animációja
    const speed = 0.4;
    const interval = setInterval(() => {
        spell.position.addScaledVector(spellDirection, speed);
        
        // Ha 30 méternél messzebb repült, töröljük a memóriából
        if (spell.position.distanceTo(spellOrigin) > 30) {
            scene.remove(spell);
            spell.geometry.dispose();
            spell.material.dispose();
            clearInterval(interval);
        }
    }, 16);
}

// Roxfort Terem Környezet (ha nincs külső hogwarts.glb fájlod)
function createFallbackHogwartsEnvironment() {
    // Padló
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Gótikus Oszlopok
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 8, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.8 });

    for (let x of [-5, 5]) {
        for (let z of [-10, -5, 0, 5, 10]) {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(x, 4, z);
            scene.add(pillar);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    renderer.render(scene, camera);
}