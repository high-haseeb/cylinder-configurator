import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import LinearDimension from "./src/LinerDimension.js";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { CustomOutlinePass } from "./src/outlinePass.js";
import FindSurfaces from "./src/FindSurfaces.js";

let composer;

let scene, camera, renderer, cylinder, controls;
let radiusDim, heightDim;
let radiusNode, heightNode;
let radius = 1; 
let height = 1;

// let box;

function createCylinder(radius, height) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
  const material = new THREE.MeshPhongMaterial({ color: document.getElementById("favcolor").value });

  cylinder = new THREE.Mesh(geometry, material);
  cylinder.geometry.computeBoundingBox();
  scene.add(cylinder);

  // box = new THREE.BoxHelper(cylinder, 'lime'); scene.add(box);
  createDimensions();
}
let radiusDim_from, radiusDim_to, heightDim_from, heightDim_to;

function createDimensions() {
  var bbox = cylinder.geometry.boundingBox;

  radiusDim = new LinearDimension(document.body, renderer, camera);
  heightDim = new LinearDimension(document.body, renderer, camera);

  radiusDim_from = new THREE.Vector3(bbox.min.x, height / 2, bbox.min.z + radius);
  radiusDim_to = new THREE.Vector3(bbox.max.x, height / 2, bbox.min.z + radius);

  heightDim_from = new THREE.Vector3(radius, bbox.min.y, bbox.min.z + radius);
  heightDim_to = new THREE.Vector3(radius, bbox.max.y, bbox.min.z + radius);

  radiusNode = radiusDim.create(radiusDim_from, radiusDim_to, new THREE.Vector3(0, 1, 0));
  heightNode = heightDim.create(heightDim_from, heightDim_to, new THREE.Vector3(1, 0, 0));

  scene.add(radiusNode, heightNode);
}

// Spring animation function
function springAnimation(end, setFunction = (e) => console.log("please give a set function"), stiffness = 0.2, damping = 0.5) {
  let position = 0;
  let velocity = 0;

  function animate() {
    const force = -stiffness * (position - end);
    const dampingForce = -damping * velocity;
    const acceleration = force + dampingForce;

    velocity += acceleration;
    position += velocity;

    setFunction(position);

    if (Math.abs(position - end) > 0.001) {
      requestAnimationFrame(animate);
    }
  }

  animate();
}

document.getElementById("submitBtn").addEventListener("click", (e) => {
  e.preventDefault();
  const radius = parseFloat(document.getElementById("radius").value);
  const height = parseFloat(document.getElementById("height").value);

  springAnimation(radius, (e) => {
    cylinder.scale.setX(e);
    cylinder.scale.setZ(e);
    radiusDim.updatePos(
      new THREE.Vector3(radiusDim_from.x * e, height / 2, radiusDim_from.z * e),
      new THREE.Vector3(radiusDim_to.x * e, height / 2, radiusDim_to.z * e),
    );
    heightDim.updatePos(
      new THREE.Vector3(e, heightDim_from.y * height, heightDim_from.z),
      new THREE.Vector3(e, heightDim_to.y * height, heightDim_to.z),
    );
  });

  springAnimation(height, (e) => {
    cylinder.scale.setY(e);
    heightDim.updatePos(
      new THREE.Vector3(radius, heightDim_from.y * e, heightDim_from.z),
      new THREE.Vector3(radius, heightDim_to.y * e, heightDim_to.z),
    );
    radiusDim.updatePos(
      new THREE.Vector3(radiusDim_from.x * radius, e / 2, radiusDim_from.z * radius),
      new THREE.Vector3(radiusDim_to.x * radius, e / 2, radiusDim_to.z * radius),
    );
  });
});

document.getElementById("favcolor").addEventListener("change", (_e) => {
  cylinder.material.map = null;
  cylinder.material.color = new THREE.Color(document.getElementById("favcolor").value);
  cylinder.material.needsUpdate = true;
});

// Function to render the scene
function render() {
  requestAnimationFrame(render);
  // renderer.render(scene, camera);
  composer.render();
  radiusDim.update(camera);
  heightDim.update(camera);
  controls.update();
}

function lighting() {
  // Ambient light
  var ambientLight = new THREE.AmbientLight(0xffffff, 2);
  scene.add(ambientLight);

  // Directional light
  var directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(1, 1, 1).normalize();
  scene.add(directionalLight);

  // Point light
  var pointLight = new THREE.PointLight(0xffffff, 2, 100);
  pointLight.position.set(0, 10, 0);
  scene.add(pointLight);
}

// Initial setup
scene = new THREE.Scene();
scene.background = new THREE.Color("white");
lighting();

const Axes = () => {
  const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
  const origin = new THREE.Vector3(-1.4 * radius, -height/2, -1.4 * radius);
  const length = radius * 2.5;
  const colors = ['red' ,  'green' , 'blue'];

  dirs.map((dir, idx) => {
    scene.add(new THREE.ArrowHelper(dir, origin, length, colors[idx], 0.2, 0.2));
  })
};
Axes();

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
camera.position.y = 2;

renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.maxPolarAngle = Math.PI / 2;
controls.minPolarAngle = -Math.PI * 2;
controls.update();

// post processing
let surfaceFinder;
let customOutline;
function outline() {
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    depthTexture: new THREE.DepthTexture(),
    depthBuffer: true,
  });
  composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  // Outline pass.
  customOutline = new CustomOutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
  composer.addPass(customOutline);

  // Antialias pass.
  const effectFXAA = new ShaderPass(FXAAShader);
  effectFXAA.uniforms["resolution"].value.set(1 / window.innerWidth, 1 / window.innerHeight);
  composer.addPass(effectFXAA);
  surfaceFinder = new FindSurfaces();

  addSurfaceIdAttributeToMesh(cylinder);
}

function addSurfaceIdAttributeToMesh() {
  surfaceFinder.surfaceId = 0;

  scene.traverse((node) => {
    if (node.type == "Mesh") {
      const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(node);
      node.geometry.setAttribute("color", new THREE.BufferAttribute(colorsTypedArray, 4));
    }
  });
  customOutline.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);
}

createCylinder(radius, height);
outline();
render();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onWindowResize);

const transparentInput = document.getElementById("transparent");
transparentInput.addEventListener("change", (e) => {
  if (transparentInput.checked) {
    cylinder.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      opacity: 0.1,
      transparent: true,
      roughness: 0.2,
      metalness: 0.8,
      refractionRatio: 0.98,
    });
  } else {
    cylinder.material = new THREE.MeshPhongMaterial({ color: document.getElementById("favcolor").value });
  }
});

var textureLoader = new THREE.TextureLoader();
document.getElementById("textureInput").addEventListener("change", function(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(event) {
    var texture = textureLoader.load(event.target.result);
    cylinder.material.color = null;
    cylinder.material.map = texture;
    cylinder.material.needsUpdate = true;
  };
  reader.readAsDataURL(file);
});
