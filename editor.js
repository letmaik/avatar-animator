import { SVG, Circle } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.panzoom.js'
import '@svgdotjs/svg.draggable.js'
import dat from 'dat.gui';
import "babel-polyfill";

import {FileUtils} from './utils/fileUtils';

try {
  var { ipcRenderer } = window.require('electron');
} catch(e) {
  // not running inside electron
  var ipcRenderer = null;
}

const guiState = {
  paint: {
    tool: 'none',
    color: '#ffffff'
  },
  display: {
    labels: true,
  },
};

// https://stackoverflow.com/a/31023470
function createArrayWithLimitedLength(length) {
  var array = new Array();

  array.push = function () {
      if (this.length >= length) {
          this.shift();
      }
      return Array.prototype.push.apply(this,arguments);
  }

  return array;
}

const undoCount = 100;
const undoHistory = createArrayWithLimitedLength(undoCount);

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui() {
  const gui = new dat.GUI({width: 200});
  gui.open();

  let paint = gui.addFolder('Paint');
  paint.add(guiState.paint, 'tool', ['none', 'color'])
  paint.addColor(guiState.paint, 'color');
  paint.open();

  let display = gui.addFolder('Display');
  display.add(guiState.display, 'labels');
  display.open();
}

function storeUndo() {
  const svgContainer = document.getElementById('svg');
  const svg = svgContainer.innerHTML;
  undoHistory.push(svg);
}

async function undo() {
  if (undoHistory.length == 1)
    return
  undoHistory.pop()
  const svg = undoHistory[undoHistory.length - 1];
  await parseSVG(svg, true);
  sendUpdatedAvatar();
}

export async function bindPage() {
  setupGui();

  document.querySelector('#undo button').addEventListener('click', undo)

  document.querySelector('#export button').addEventListener('click', () => {
    let svgContainer = document.getElementById('svg');
    let svg = svgContainer.innerHTML;
    var data = new Blob([svg], {type: 'text/svg'});
    var elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(data);
    elem.download = 'avatar.svg';
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
    window.URL.revokeObjectURL(url);
  })
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
FileUtils.setDragDropHandler((data, filename) => {
  if (filename.endsWith('.svg')) {
    parseSVG(data);
  }
});

function sendUpdatedAvatar() {
  if (!ipcRenderer)
    return;
  const svgContainer = document.getElementById('svg')
  const svg = svgContainer.innerHTML;
  ipcRenderer.send('avatar', {
    svg: svg
  });
}

async function parseSVG(target, inUndo) {
  let svgContainer = document.getElementById('svg')

  // panning changes the viewbox, need to keep the current one
  let originalViewbox = null;
  if (inUndo) {
    const svgEl = svgContainer.children[0]
    originalViewbox = svgEl.getAttribute('viewBox')
  }

  svgContainer.innerHTML = target
  let svgEl = svgContainer.children[0]

  if (inUndo) {
    svgEl.setAttribute('viewBox', originalViewbox)
  }
  
  if (!inUndo)
    storeUndo();
  
  let svg = SVG(svgEl)
  svg.panZoom({
    zoomFactor: 0.5
  })
  let skeleton = svg.findOne('[id^=skeleton]')
  let illustration = svg.findOne('[id^=illustration]')

  skeleton.each(function(i, children) {
    // hide bones
    if (!(this instanceof Circle)) {
      this.hide()
      return;
    }
    // highlight keypoints and make draggable
    this.fill({ color: '#f06' })
    this.draggable()

    // show keypoint IDs as tooltips
    this.on('mouseover', evt => {
      if (!guiState.display.labels)
        return;
      let tooltip = document.getElementById("tooltip");
      tooltip.innerHTML = this.node.id;
      tooltip.style.display = "block";
      tooltip.style.left = evt.pageX + 10 + 'px';
      tooltip.style.top = evt.pageY + 10 + 'px';
    })
    this.on('mouseout', () => {
      let tooltip = document.getElementById("tooltip");
      tooltip.style.display = "none";
    })

    // TODO draw bones dynamically

    // move matching illustration keypoint(s) if existing
    // TODO does this even make sense? seems there is sometimes an intentional offset
    this.on('dragmove.namespace', function (e) {
      if (!this.node.id)
        return
      illustration.find(`[id^=${this.node.id}]`).move(this.x(), this.y())
    })
    this.on('dragend.namespace', () => {
      sendUpdatedAvatar();
      storeUndo();
    })
  })

  illustration.each(function(i, children) {
    if (this.node.id)
      return // ignore keypoints
    this.click(function() {
      if (guiState.paint.tool === 'none') {
        return
      }
      if (guiState.paint.tool === 'color') {
        this.node.style.fill = guiState.paint.color
      }
      sendUpdatedAvatar();
      storeUndo();
    })
  }, true)
}

function registerMessageHandler() {
  if (!ipcRenderer)
    return;
  ipcRenderer.on('avatar', (event, obj) => {
    parseSVG(obj.svg)
  })
}
    
bindPage();
registerMessageHandler();