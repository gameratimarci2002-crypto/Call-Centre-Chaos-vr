import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller1, controller2;
let controllerGrip1, controllerGrip2;

let wandGroup, wandTipMesh;
let isWandInHand = false;
let activeHand = null; // Melyik kézben van a pálca

// Öv / Dereka pozíció
const beltHolster = new THREE.Group();

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

    // 3D Roxfort Vár betöltése
    const loader = new GLTFLoader();
    loader.load(
        './hogwarts.glb', 
        (gltf) => { scene.add(gltf.scene); },
        undefined,
        () => { createFallbackHogwartsEnvironment(); }
    );

    // --- KÉZ ÉS KONTROLLER ARCHITEKTÚRA ---
    const controllerModelFactory = new XRControllerModelFactory();

    // Bal kéz
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onTriggerDown);
    controller1.addEventListener('squeezestart', () => tryToggleWand(controller1));
    scene.add(controller1);

    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    // Jobb kéz
    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onTriggerDown);
    controller2.addEventListener('squeezestart', () => tryToggleWand(controller2));
    scene.add(controller2);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    // Vizualizáljuk a kezeket egyszerű 3D gömbként / kézfejként
    createHandVisual(controller1);
    createHandVisual(controller2);

    // --- VARÁZSPÁLCA ÉPÍTÉSE ---
    wandGroup = new THREE.Group();

    // Pálca fa teste (35 cm)
    const wandGeo = new THREE.CylinderGeometry(0.005, 0.01, 0.35, 16);
    wandGeo.translate(0, 0.175, 0); // Origó a markolat alján
    const wandMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.5 });
    const wandMesh = new THREE.Mesh(wandGeo, wandMat);
    wandMesh.rotation.x = -Math.PI / 2; // Előre mutat
    wandGroup.add(wandMesh);

    // Lumos pont a pálca leghegyén
    const tipGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    wandTipMesh = new THREE.Mesh(tipGeo, tipMat);
    wandTipMesh.position.set(0, 0, -0.35); // A kinyújtott pálca hegye
    wandGroup.add(wandTipMesh);

    // --- ÖV (HOLSTER) BEÁLLÍTÁSA A DEREKON ---
    scene.add(beltHolster);
    
    // Öv látható vizuális eleme (bőrtáska / pálcatartó hüvely a deréknál)
    const holsterGeo = new THREE.CylinderGeometry(0.02, 0.01, 0.2, 12);
    const holsterMat = new THREE.MeshStandardMaterial({ color: 0x1a0d00 });
    const holsterMesh = new THREE.Mesh(holsterGeo, holsterMat);
    holsterMesh.rotation.z = Math.PI / 6; // Enyhén ferdén áll az övön
    beltHolster.add(holsterMesh);

    // Betesszük a pálcát az övbe alapértelmezetten
    putWandInHolster();

    window.addEventListener('resize', onWindowResize);
    renderer.setAnimationLoop(render);
}

// Egyszerű 3D kézfej generálás a kontrollerekre
function createHandVisual(controller) {
    const handGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const handMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 });
    const handMesh = new THREE.Mesh(handGeo, handMat);
    controller.add(handMesh);
}

// Pálca áthelyezése az övre
function putWandInHolster() {
    isWandInHand = false;
    activeHand = null;
    beltHolster.add(wandGroup);
    wandGroup.position.set(0, 0.05, 0);
    wandGroup.rotation.set(0, 0, Math.PI / 6);
}

// Pálca felvétele vagy visszatétele (Grip / Squeeze gombra)
function tryToggleWand(controller) {
    const handPos = new THREE.Vector3();
    controller.getWorldPosition(handPos);

    const holsterPos = new THREE.Vector3();
    beltHolster.getWorldPosition(holsterPos);

    if (!isWandInHand) {
        // Ha a kéz a derék közelében van (< 35 cm), felvesszük a pálcát
        if (handPos.distanceTo(holsterPos) < 0.35) {
            isWandInHand = true;
            activeHand = controller;
            controller.add(wandGroup);
            wandGroup.position.set(0, 0, 0);
            wandGroup.rotation.set(0, 0, 0);
        }
    } else if (activeHand === controller) {
        // Ha a pálcát tartó kéz a derékhoz nyúl, visszatesszük az övre
        if (handPos.distanceTo(holsterPos) < 0.35) {
            putWandInHolster();
        }
    }
}

// Varázslás Trigger gombra
function onTriggerDown(event) {
    const controller = event.target;
    
    // Csak akkor tudunk varázsolni, ha a pálca a megnyomott kézben van
    if (!isWandInHand || activeHand !== controller) return;

    castSpell();
}

function castSpell() {
    // 1. Pálca hegyének globális pozíciója
    const spellOrigin = new THREE.Vector3();
    wandTipMesh.getWorldPosition(spellOrigin);

    // 2. Varázslat iránya (pálca mutatási iránya)
    const spellDirection = new THREE.Vector3();
    wandGroup.getWorldDirection(spellDirection);
    spellDirection.negate();

    // Lövedék (Stupefy / Reducto)
    const spellGeo = new THREE.SphereGeometry(0.035, 16, 16);
    const spellMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const spell = new THREE.Mesh(spellGeo, spellMat);
    
    const spellLight = new THREE.PointLight(0xff0044, 4, 5);
    spell.add(spellLight);

    spell.position.copy(spellOrigin);
    scene.add(spell);

    // Repülés animációja
    const speed = 0.5;
    const interval = setInterval(() => {
        spell.position.addScaledVector(spellDirection, speed);

        if (spell.position.distanceTo(spellOrigin) > 35) {
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
    // Frissítjük a derék/öv pozícióját a kamera (játékos feje) alapján
    if (renderer.xr.isPresenting) {
        const xrCamera = renderer.xr.getCamera();
        const headPos = new THREE.Vector3();
        xrCamera.getWorldPosition(headPos);

        // Az öv pozíciója a fej alatt 60 cm-re van, a fej forgatását követve
        beltHolster.position.set(headPos.x, headPos.y - 0.6, headPos.z);
        beltHolster.rotation.y = xrCamera.rotation.y;
    }

    renderer.render(scene, camera);
}