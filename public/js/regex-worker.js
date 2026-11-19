/* Runs a user regex off the main thread so a catastrophic pattern cannot freeze the page. */
onmessage = function (e) {
  var d = e.data, ms = [], m, g = 0, gl = d.flags.indexOf("g") >= 0;
  var re = new RegExp(d.pat, gl ? d.flags : d.flags + "g");
  while ((m = re.exec(d.txt)) && g++ < 2000) {
    ms.push({ 0: m[0], index: m.index, gr: [].slice.call(m, 1), named: m.groups ? Object.assign({}, m.groups) : null });
    if (m[0] === "") re.lastIndex++;
    if (!gl) break;
  }
  var rout = null;
  if (d.rp !== "") { try { rout = d.txt.replace(new RegExp(d.pat, d.flags), d.rp); } catch (x) {} }
  postMessage({ ms: ms, guard: g, rout: rout });
};
