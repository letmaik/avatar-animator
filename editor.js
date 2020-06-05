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
  debug: {
    labels: true,
  },
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui() {
  const gui = new dat.GUI({width: 200});
  gui.open();

  let debug = gui.addFolder('Debug');
  debug.add(guiState.debug, 'labels');
  debug.open();
}


export async function bindPage() {
  setupGui();

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

async function parseSVG(target) {
  let svgContainer = document.getElementById('svg')
  svgContainer.innerHTML = target
  let svgEl = svgContainer.children[0]

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
      if (!guiState.debug.labels)
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
    if (ipcRenderer) {
      this.on('dragend.namespace', function(e) {
          ipcRenderer.send('avatar', {
            svg: svgContainer.innerHTML
          });
      })
    }
  })
}

function registerMessageHandler() {
  if (!ipcRenderer)
    return;
  ipcRenderer.on('avatar', (event, obj) => {
    console.log(obj)
    parseSVG(obj.svg)
  })
}
    
bindPage();
registerMessageHandler();