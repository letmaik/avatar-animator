/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as posenet_module from '@tensorflow-models/posenet';
import * as facemesh_module from '@tensorflow-models/facemesh';
import * as tf from '@tensorflow/tfjs';
import * as paper from 'paper';
import dat from 'dat.gui';
import Stats from 'stats.js';
import "babel-polyfill";

import {drawKeypoints, drawPoint, drawSkeleton, toggleLoadingUI, setStatusText} from './utils/demoUtils';
import {SVGUtils} from './utils/svgUtils'
import {PoseIllustration} from './illustrationGen/illustration';
import {Skeleton, facePartName2Index} from './illustrationGen/skeleton';
import {FileUtils} from './utils/fileUtils';

import * as girlSVG from './resources/illustration/girl.svg';
import * as boySVG from './resources/illustration/boy.svg';
import * as abstractSVG from './resources/illustration/abstract.svg';
import * as blathersSVG from './resources/illustration/blathers.svg';
import * as tomNookSVG from './resources/illustration/tom-nook.svg';

const { ipcRenderer } = window.require('electron')

const ratio = 9/16;

// Camera stream video element
let video;
let videoWidth = 320;
let videoHeight = videoWidth * ratio;
let switchingStreams = false;

// Canvas
let faceDetection = null;
let illustration = null;
let canvasScope;
let canvasWidth = 640;
let canvasHeight = canvasWidth * ratio;
let flippedCanvas = null;

// ML models
let facemesh;
let posenet;
let minPoseConfidence = 0.15;
let minPartConfidence = 0.1;
let nmsRadius = 30.0;

// Misc
const stats = new Stats();
const avatarSvgs = {
  'girl': girlSVG.default,
  'boy': boySVG.default,
  'abstract': abstractSVG.default,
  'blathers': blathersSVG.default,
  'tom-nook': tomNookSVG.default,
};

/**
 * Loads a the camera to be used in the demo
 *
 */
async function setupCamera() {
  const video = document.getElementById('video');
  video.width = videoWidth;
  video.height = videoHeight;

  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      facingMode: 'user',
      width: videoWidth,
      height: videoHeight,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function switchCamera(deviceId) {
  console.log('switching camera to', deviceId)
  switchingStreams = true;
  const video = document.getElementById('video');
  let stream = video.srcObject;
  stream.getTracks().forEach(track => {
    track.stop();
  });
  stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {
      deviceId: { exact: deviceId },
      width: videoWidth,
      height: videoHeight,
    },
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      console.log('switching cameras done')
      switchingStreams = false;
      video.play();
      resolve(video);
    };
  });
}

async function getCameras() {
  let devices = await navigator.mediaDevices.enumerateDevices()
  devices = devices.filter(device => device.kind == 'videoinput')
  const devicesMap = devices.reduce((obj, device) => {
    obj[device.label] = device.deviceId;
    return obj;
  }, {});
  console.log('Cameras: ', devicesMap)
  return devicesMap;
}

async function loadVideo() {
  const video = await setupCamera();
  video.play();

  return video;
}

function toggleCameraHidden(hidden) {
  const output = document.getElementById('output');
  output.style.display = hidden ? 'none' : '';
}

const defaultPoseNetArchitecture = 'MobileNetV1';
const defaultQuantBytes = 2;
const defaultMultiplier = 1.0;
const defaultStride = 16;
const defaultInputResolution = 200;

const guiState = {
  camera: {
    device: '',
    hidden: false
  },
  image: {
    avatar: Object.keys(avatarSvgs)[0],
    background: '#ffffff'
  },
  debug: {
    fps: false,
    detection: false,
    avatar: false,
  },
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui(cameras) {
  const gui = new dat.GUI({width: 200});
  gui.close();

  let camera = gui.addFolder('Camera')
  camera.add(guiState.camera, 'device', Object.keys(cameras)).onChange(() => switchCamera(cameras[guiState.camera.device]))
  camera.add(guiState.camera, 'hidden').onChange(() => toggleCameraHidden(guiState.camera.hidden))
  camera.open();

  let image = gui.addFolder('Image');
  image.add(guiState.image, 'avatar', Object.keys(avatarSvgs)).onChange(() => parseSVG(avatarSvgs[guiState.image.avatar]));
  image.addColor(guiState.image, 'background');
  image.open();

  let debug = gui.addFolder('Debug');
  debug.add(guiState.debug, 'fps').onChange(() => guiState.debug.fps ? setupFPS() : removeFPS());
  debug.add(guiState.debug, 'detection');
  debug.add(guiState.debug, 'avatar');
  debug.open();
}

/**
 * Sets up a frames per second panel on the top-left of the window
 */
function setupFPS() {
  stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById('main').appendChild(stats.dom);
}

function removeFPS() {
  document.getElementById('main').removeChild(stats.dom);
}

/**
 * Feeds an image to posenet to estimate poses - this is where the magic
 * happens. This function loops with a requestAnimationFrame method.
 */
function detectPoseInRealTime(video) {
  const canvas = document.getElementById('output');
  const keypointCanvas = document.getElementById('keypoints');
  const videoCtx = canvas.getContext('2d');
  const keypointCtx = keypointCanvas.getContext('2d');

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  keypointCanvas.width = videoWidth;
  keypointCanvas.height = videoHeight;

  async function poseDetectionFrame() {
    if (switchingStreams) {
      requestAnimationFrame(poseDetectionFrame);
      return;
    }

    // Begin monitoring code for frames per second
    if (guiState.debug.fps)
      stats.begin();

    let poses = [];
   
    videoCtx.clearRect(0, 0, videoWidth, videoHeight);
    // Draw video
    videoCtx.save();
    videoCtx.scale(-1, 1);
    videoCtx.translate(-videoWidth, 0);
    videoCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    videoCtx.restore();

    // Creates a tensor from an image
    const input = tf.browser.fromPixels(canvas);
    faceDetection = await facemesh.estimateFaces(input, false, false);
    let all_poses = await posenet.estimatePoses(video, {
      flipHorizontal: true,
      decodingMethod: 'multi-person',
      maxDetections: 1,
      scoreThreshold: minPartConfidence,
      nmsRadius: nmsRadius
    });

    poses = poses.concat(all_poses);
    input.dispose();

    keypointCtx.clearRect(0, 0, videoWidth, videoHeight);
    if (guiState.debug.detection && !guiState.camera.hidden) {
      poses.forEach(({score, keypoints}) => {
      if (score >= minPoseConfidence) {
          drawKeypoints(keypoints, minPartConfidence, keypointCtx);
          drawSkeleton(keypoints, minPartConfidence, keypointCtx);
        }
      });
      faceDetection.forEach(face => {
        Object.values(facePartName2Index).forEach(index => {
            let p = face.scaledMesh[index];
            drawPoint(keypointCtx, p[1], p[0], 2, 'red');
        });
      });
    }

    canvasScope.project.clear();

    // White background
    var rect = new canvasScope.Path.Rectangle(0, 0, canvasWidth, canvasHeight);
    rect.sendToBack();
    rect.fillColor = guiState.image.background;
    canvasScope.project.activeLayer.addChild(rect);

    if (poses.length >= 1 && illustration) {
      Skeleton.flipPose(poses[0]);

      if (faceDetection && faceDetection.length > 0) {
        let face = Skeleton.toFaceFrame(faceDetection[0]);
        illustration.updateSkeleton(poses[0], face);
      } else {
        illustration.updateSkeleton(poses[0], null);
      }
      illustration.draw(canvasScope, videoWidth, videoHeight);

      if (guiState.debug.avatar) {
        illustration.debugDraw(canvasScope);
        //illustration.debugDrawLabel(canvasScope);
      }
    }

    canvasScope.project.activeLayer.scale(
      canvasWidth / videoWidth, 
      canvasHeight / videoHeight, 
      new canvasScope.Point(0, 0));

    let illustrationCanvas = document.querySelector('.illustration-canvas');
    // Need to re-draw each frame on a flipped canvas because
    // the original canvas's transformation matrix is not applied
    // when using getImageData().
    let flippedCanvasContext = flippedCanvas.getContext('2d');
    flippedCanvasContext.drawImage(illustrationCanvas, 0, 0);
    let imageData = flippedCanvasContext.getImageData(
      0, 0, illustrationCanvas.width, illustrationCanvas.height);
    
    // TODO: ipc uses JSON and serializes buffers into base64, too inefficient?
    ipcRenderer.send('frame', {
      data: imageData.data, // RGBA Uint8ClampedArray
      width: imageData.width,
      height: imageData.height
    });

    // End monitoring code for frames per second
    if (guiState.debug.fps)
      stats.end();

    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

function setupCanvas() {
  canvasScope = paper.default;
  let canvas = document.querySelector('.illustration-canvas');;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvasScope.setup(canvas);
  // By default, paper.js adjusts the canvas size based on screen DPI.
  // Here we reset it again as we want exactly the size we requested
  // to avoid sending images that are too big.
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  // Need to re-draw each frame on a flipped canvas because
  // the original canvas's transformation matrix is not applied
  // when using getImageData().
  flippedCanvas = document.createElement('canvas');
  flippedCanvas.width = canvasWidth;
  flippedCanvas.height = canvasHeight;
  let flippedCanvasContext = flippedCanvas.getContext('2d');
  flippedCanvasContext.translate(canvasWidth, 0);
  flippedCanvasContext.scale(-1, 1);
}

/**
 * Kicks off the demo by loading the posenet model, finding and loading
 * available camera devices, and setting off the detectPoseInRealTime function.
 */
export async function bindPage() {
  setupCanvas();

  toggleLoadingUI(true);
  setStatusText('Loading PoseNet model...');
  posenet = await posenet_module.load({
    architecture: defaultPoseNetArchitecture,
    outputStride: defaultStride,
    inputResolution: defaultInputResolution,
    multiplier: defaultMultiplier,
    quantBytes: defaultQuantBytes
  });
  setStatusText('Loading FaceMesh model...');
  facemesh = await facemesh_module.load();

  setStatusText('Loading Avatar file...');
  let t0 = new Date();
  await parseSVG(Object.values(avatarSvgs)[0]);

  setStatusText('Setting up camera...');
  try {
    video = await loadVideo();
  } catch (e) {
    let info = document.getElementById('info');
    info.textContent = 'this device type is not supported yet, ' +
      'or this browser does not support video capture: ' + e.toString();
    info.style.display = 'block';
    throw e;
  }

  const cameras = await getCameras()

  setupGui(cameras);
  if (guiState.debug.fps)
    setupFPS();
  
  toggleLoadingUI(false);
  detectPoseInRealTime(video, posenet);
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
FileUtils.setDragDropHandler((result) => {parseSVG(result)});

async function parseSVG(target) {
  let svgScope = await SVGUtils.importSVG(target /* SVG string or file path */);
  let skeleton = new Skeleton(svgScope);
  illustration = new PoseIllustration(canvasScope);
  illustration.bindSkeleton(skeleton, svgScope);
}
    
bindPage();
