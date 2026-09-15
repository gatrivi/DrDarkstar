// Authored source outlines separate touching silhouettes in the generated atlas.
// Coordinates are in the original 1254px sheet, not a regular tile grid.
const SHAPES = {
  oak: [[0,0],[338,0],[338,106],[371,132],[397,211],[376,256],[344,276],[344,335],[400,432],[0,432]],
  fork: [[346,0],[639,0],[639,108],[695,123],[695,248],[624,272],[610,425],[406,425],[399,298],[362,249],[393,213],[349,147]],
  ancient: [[640,0],[990,0],[990,432],[633,432],[661,357],[707,281],[702,237],[691,112],[640,106]],
  distant: [[976,49],[1254,49],[1254,425],[998,425],[977,279]],
  trunk: [[76,436],[240,436],[240,725],[76,725]],
  junction: [[286,432],[599,432],[598,563],[552,623],[521,724],[363,724],[363,617],[286,566]],
  roots: [[553,446],[836,446],[857,506],[886,552],[873,596],[913,661],[959,724],[553,724]],
  canopy: [[877,470],[1254,470],[1254,725],[958,725],[956,671],[910,627],[877,581]],
  fern: [[9,740],[347,740],[347,984],[9,984]],
  fungi: [[361,757],[644,757],[644,978],[361,978]],
  vines: [[654,735],[883,735],[883,1017],[815,1017],[815,1047],[731,1047],[731,1019],[654,1019]],
  curtain: [[920,735],[1250,735],[1250,1010],[920,1010]],
  log: [[9,993],[395,993],[395,1240],[9,1240]],
  arch: [[397,984],[640,984],[640,1144],[693,1244],[373,1244],[397,1183]],
  ledge: [[654,1050],[935,1050],[935,1148],[893,1254],[654,1254]],
  ground: [[914,1090],[1254,1090],[1254,1236],[914,1236]],
};

export function prepareFoliage(image) {
  return Object.fromEntries(Object.entries(SHAPES).map(([name, points]) => {
    const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
    const w = Math.max(...points.map(p => p[0])) - x, h = Math.max(...points.map(p => p[1])) - y;
    const sheet = document.createElement('canvas'); sheet.width = w; sheet.height = h;
    const g = sheet.getContext('2d'); g.imageSmoothingEnabled = false;
    g.beginPath(); points.forEach(([px, py], i) => i ? g.lineTo(px-x, py-y) : g.moveTo(px-x, py-y));
    g.closePath(); g.clip(); g.drawImage(image, 0, 0, image.width, image.height, -x, -y, 1254, 1254);
    return [name, sheet];
  }));
}

// Bounds are authored in world space; foliage never creates invisible collisions.
export const SCENERY = [
  ['oak',-75,79,400,433], ['fork',348,104,346,408], ['ancient',943,99,344,413],
  ['oak',1515,147,337,365], ['fork',2020,80,367,432], ['ancient',2820,56,380,456],
  ['roots',727,350,233,162], ['arch',2101,331,207,181], ['arch',3235,294,251,218],
  ['trunk',91,21,111,225], ['junction',13,-45,228,213],
  ['canopy',-50,-7,426,249], ['canopy',653,140,328,192], ['canopy',2480,27,368,215],
  ['vines',576,27,108,147], ['vines',1375,83,106,144], ['vines',2425,44,119,162],
  ['curtain',744,336,214,176], ['curtain',1648,40,216,178], ['curtain',3100,67,234,193],
  ['fungi',192,460,94,52], ['fungi',1050,456,100,56], ['fungi',2162,450,112,62],
  ['fungi',3120,464,87,48],
];

export const GROUND_COVER = [
  ['fern',10,461,82,59], ['ground',249,480,101,44], ['fern',630,464,77,56],
  ['ground',995,484,108,46], ['fern',1430,464,84,60], ['ground',1712,480,117,50],
  ['fern',2030,456,91,66], ['ground',2226,484,104,45], ['fern',2560,466,80,58],
  ['ground',2860,485,110,47], ['fern',3170,456,93,67], ['ground',3420,482,96,42],
];
