/* map-symbols.js - the live map's own marker drawings (grave symbols and the cemetery marks),
   so the editor shows exactly the same icons. Copied from index.html: if a symbol changes there, copy it here too.
   Use: MapSymbols.register(map, graveInkColor)   adds images named like the live map's ("grave-circle-dot-vet", "access-mark-private", ...)
*/
(function () {
  "use strict";
  let GRAVE_INK = "#3f3528";
const GRAVE_ICON_SIZE = 34;   // icon canvas, CSS px
const GRAVE_SCALE = 1;        // raise (for example 1.4) to make every map marker bigger

function drawGraveSymbol(ctx, cx, cy, opts) {

    const square = opts.shape === "square";
    const half = square ? 5.5 : 6;
    const ring = half + 2.75;

    function outline(r) {
        ctx.beginPath();
        if (square) { ctx.rect(cx - r, cy - r, r * 2, r * 2); }
        else { ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    }

    ctx.lineJoin = "miter";
    ctx.setLineDash([]);

    if (opts.veteran) {
        outline(ring);
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.strokeStyle = GRAVE_INK; ctx.lineWidth = 1.5; ctx.stroke();
    }

    outline(half);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = opts.faded ? "#cfcabe" : GRAVE_INK; ctx.fill();   // faded = legend modifier examples

    if (opts.dot) {
        outline(2.4);
        ctx.fillStyle = "#ffffff"; ctx.fill();
    }

    if (opts.pioneer) {
        const top = opts.veteran ? ring + 1.75 : half + 1;
        const baseY = cy - top - 5.5;
        const tipY = cy - top - 0.5;

        ctx.beginPath();
        ctx.moveTo(cx - 3.5, baseY);
        ctx.lineTo(cx + 3.5, baseY);
        ctx.lineTo(cx, tipY);
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = GRAVE_INK; ctx.fill();
    }
}

function makeGraveCanvas(opts, pixelScale) {
    const px = Math.round(GRAVE_ICON_SIZE * pixelScale);
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    ctx.scale(pixelScale, pixelScale);
    drawGraveSymbol(ctx, GRAVE_ICON_SIZE / 2, GRAVE_ICON_SIZE / 2, opts);
    return canvas;
}

function makeGraveSymbol(opts) {
    const canvas = makeGraveCanvas(opts, 2 * GRAVE_SCALE);
    const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: imageData.data };
}

// Legend icon: same drawing code, returned as an <img> tag.
function makeAccessMark(kind) {

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    const c = size / 2;
    const r = 12;

    function tracePath() {
        ctx.beginPath();

        if (kind === "inaccessible") {
            ctx.moveTo(c - r, c - r); ctx.lineTo(c + r, c + r);
            ctx.moveTo(c + r, c - r); ctx.lineTo(c - r, c + r);
        }
        else if (kind === "private") {
            ctx.moveTo(c - r, c - r); ctx.lineTo(c + r, c + r);
        }
        else if (kind === "waves") {            // relocated because of water: one wave across the middle
            ctx.moveTo(c - r, c);
            ctx.bezierCurveTo(c - r / 2, c - 9, c - r / 2, c + 9, c, c);
            ctx.bezierCurveTo(c + r / 2, c - 9, c + r / 2, c + 9, c + r, c);
        }
        else if (kind === "arrow") {            // relocated for any other reason
            ctx.moveTo(c - r, c); ctx.lineTo(c + r, c);
            ctx.moveTo(c + r - 8, c - 8); ctx.lineTo(c + r, c); ctx.lineTo(c + r - 8, c + 8);
        }
        else {
            ctx.moveTo(c - r, c); ctx.lineTo(c + r, c);
        }
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = 12;
    tracePath();
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7.5;
    tracePath();
    ctx.stroke();

    return {
        width: size,
        height: size,
        data: ctx.getImageData(0, 0, size, size).data
    };
}


  function register(map, ink) {
    if (ink) GRAVE_INK = ink;
    ["circle", "square"].forEach(shape => [false, true].forEach(dot => [false, true].forEach(veteran => [false, true].forEach(pioneer => {
      const name = "grave-" + shape + (dot ? "-dot" : "") + (veteran ? "-vet" : "") + (pioneer ? "-pio" : "");
      if (!map.hasImage(name)) map.addImage(name, makeGraveSymbol({ shape, dot, veteran, pioneer }), { pixelRatio: 2 });
    }))));
    ["inaccessible", "private", "permission", "waves", "arrow"].forEach(kind => { const n = "access-mark-" + kind; if (!map.hasImage(n)) map.addImage(n, makeAccessMark(kind), { pixelRatio: 2 }); });
  }
  window.MapSymbols = { register };
})();
