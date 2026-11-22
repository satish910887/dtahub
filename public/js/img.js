/* DTAhub image and file helpers: thin global aliases over DTAcore (dta-core.js). Kept so every tool script keeps working. */
(function () {
  var C = window.DTAcore;
  window.pickImage = function (inp, cb) {
    inp.addEventListener("change", function () {
      var f = inp.files[0]; if (!f) return;
      C.files.loadImage(f).then(function (r) { cb(r.im, f); });
    });
  };
  window.renderImg = C.img.render;
  window.extOf = C.files.extOf;
  window.sizeOf = C.files.sizeOf;
  window.saveBlob = C.files.saveBlob;
  window.baseName = C.files.baseName;
})();
