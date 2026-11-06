import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller1, controller2;
let wandMesh;

init();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.03);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 1.6, 0);

    // Fények
    const ambientLight = new THREE.AmbientLight(0x405080, 1.5);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x99bbff, 2);
    moonLight.position.set(10, 20, -10);
    scene.add(moonLight);

    // Renderer & WebXR
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // Roxfort Térkép betöltő
    const loader = new GLTFLoader();
    loader.load(
        './hogwarts.glb', 
        (gltf) => { scene.add(gltf.scene); },
        undefined,
        () => { createFallbackHogwartsEnvironment(); }
    );

    // VR Kontrollerek
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', castSpell);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    scene.add(controller2);

    // PÁLCA ÉPÍTÉSE (Pontos hosszal és elhelyezéssel)
    // 35 cm hosszú pálca
    const wandGeometry = new THREE.CylinderGeometry(0.004, 0.008, 0.35, 16);
    // Eltoljuk a geometriát, hogy a pálca alja legyen az origóban (0,0,0)
    wandGeometry.translate(0, 0.175, 0);
    
    const wandMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.5 });
    wandMesh = new THREE.Mesh(wandGeometry, wandMaterial);
    
    // Elforgatjuk, hogy a kontroller kinyújtott mutatóujja/irányába nézzen
    wandMesh.rotation.x = -Math.PI / 2;

    // Lumos fénygömb a pálca Hegyén (y = 0.35 méter)
    const tipGeometry = new THREE.SphereGeometry(0.012, 16, 16);
    const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const wandTipMesh = new THREE.Mesh(tipGeometry, tipMaterial);
    wandTipMesh.name = "wandTip";
    wandTipMesh.position.set(0, 0.35, 0); // Pálca csúcsa
    wandMesh.add(wandTipMesh);

    controller1.add(wandMesh);

    window.addEventListener('resize', onWindowResize);
    renderer.setAnimationLoop(render);
}

function castSpell() {
    if (!wandMesh) return;

    const tipMesh = wandMesh.getObjectByName("wandTip");
    if (!tipMesh) return;

    // 1. Kiszámoljuk a pálca hegyének PONTOS pozícióját a 3D térben
    const spellOrigin = new THREE.Vector3();
    tipMesh.getWorldPosition(spellOrigin);

    // 2. Kiszámoljuk a pálca PONTOS mutatási irányát
    const spellDirection = new THREE.Vector3();
    // A kontroller/pálca előre mutató iránya a VR-ban a negatív Z tengely
    wandMesh.getWorldDirection(spellDirection);
    spellDirection.negate(); 

    // Varázslövedék létrehozása
    const spellGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const spellMaterial = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const spell = new THREE.Mesh(spellGeometry, spellMaterial);
    
    const spellLight = new THREE.PointLight(0xff0044, 4, 4);
    spell.add(spellLight);

    spell.position.copy(spellOrigin);
    scene.add(spell);

    // Lövedék kilövése
    const speed = 0.5;
    const interval = setInterval(() => {
        spell.position.addScaledVector(spellDirection, speed);

        if (spell.position.distanceTo(spellOrigin) > 30) {
            scene.remove(spell);
            spell.geometry.dispose();
            spell.material.dispose();
            clearInterval(interval);
        }
    }, 16);
}

function createFallbackHogwartsEnvironment() {
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

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