import { SVG } from '@svgdotjs/svg.js';
import '@svgdotjs/svg.draggable.js'
import dat from 'dat.gui';
import "babel-polyfill";


import {FileUtils} from './utils/fileUtils';

import * as girlSVG from './resources/illustration/girl.svg';
import * as boySVG from './resources/illustration/boy.svg';
import * as abstractSVG from './resources/illustration/abstract.svg';
import * as blathersSVG from './resources/illustration/blathers.svg';
import * as tomNookSVG from './resources/illustration/tom-nook.svg';

try {
  var { ipcRenderer } = window.require('electron');
} catch(e) {
  // not running inside electron
  var ipcRenderer = null;
}


const avatarSvgs = {
  'girl': girlSVG.default,
  'boy': boySVG.default,
  'abstract': abstractSVG.default,
  'blathers': blathersSVG.default,
  'tom-nook': tomNookSVG.default,
};


const guiState = {
  debug: {
    labels: false,
  },
};

/**
 * Sets up dat.gui controller on the top-right of the window
 */
function setupGui() {
  const gui = new dat.GUI({width: 200});
  gui.close();

  let debug = gui.addFolder('Debug');
  debug.add(guiState.debug, 'labels');
  debug.open();
}


export async function bindPage() {

  await parseSVG(Object.values(avatarSvgs)[0]);
  
  setupGui();
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
FileUtils.setDragDropHandler((data, filename) => {
  if (filename.endsWith('.svg')) {
    parseSVG(data);
  }
});

async function parseSVG(target) {
  
}
    
bindPage();
