import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm'
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
renderer.setClearColor(0x000000, 0)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0.75, 0.8)
camera.lookAt(new THREE.Vector3(0, 0.65, 0))

scene.add(new THREE.AmbientLight(0xffffff, 0.6))
const sun = new THREE.DirectionalLight(0xffffff, 0.8)
sun.position.set(1, 2, 3)
scene.add(sun)

// ---------------------------------------------------------------------------
// VRM load
// ---------------------------------------------------------------------------

async function loadVrm(): Promise<VRM> {
  const buffer = await window.electron.loadVrm('Twig-dotter-ARKit.vrm')
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = await new Promise<{ userData: { vrm: VRM } }>((resolve, reject) =>
    loader.parse(buffer, '', resolve as (gltf: unknown) => void, reject)
  )
  const vrm = gltf.userData.vrm
  console.log(
    'VRM expressions:',
    vrm.expressionManager?.expressions.map((e) => e.expressionName)
  )
  return vrm
}

// ---------------------------------------------------------------------------
// MediaPipe face landmarker
// ---------------------------------------------------------------------------

async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  )
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    numFaces: 1
  })
}

// ---------------------------------------------------------------------------
// Webcam
// ---------------------------------------------------------------------------

async function openWebcam(): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.style.display = 'none'
  document.body.appendChild(video)
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  video.srcObject = stream
  await video.play()
  return video
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [vrm, faceLandmarker, video] = await Promise.all([
    loadVrm(),
    loadFaceLandmarker(),
    openWebcam()
  ])

  vrm.scene.rotation.y = Math.PI
  scene.add(vrm.scene)

  const clock = new THREE.Clock()
  let lastVideoTime = -1

  function animate(): void {
    requestAnimationFrame(animate)

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime
      const result = faceLandmarker.detectForVideo(video, Date.now())
      const shapes = result.faceBlendshapes?.[0]?.categories

      if (shapes) {
        const jawScore = shapes.find((s) => s.categoryName === 'jawOpen')?.score ?? 0
        const em = vrm.expressionManager
        if (em) {
          // ARKit VRMs expose 'jawOpen' as a custom expression; standard VRMs use 'aa'
          if (em.getValue('jawOpen') !== undefined) {
            em.setValue('jawOpen', jawScore)
          } else {
            em.setValue('aa', jawScore)
          }
          em.update()
        }
      }
    }

    vrm.update(clock.getDelta())
    renderer.render(scene, camera)
  }

  animate()
}

main().catch(console.error)
