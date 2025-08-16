(function(){
  // ====== Math helpers (2D + z=0 for cross products) ======
  const V = {
    add: (a,b)=>[a[0]+b[0], a[1]+b[1]],
    sub: (a,b)=>[a[0]-b[0], a[1]-b[1]],
    mul: (a,s)=>[a[0]*s, a[1]*s],
    dot: (a,b)=>a[0]*b[0]+a[1]*b[1],
    len: a=>Math.hypot(a[0],a[1]),
  };
  const crossZ = (w, r)=>[ -w*r[1], w*r[0] ]; // ω×r for 2D with ω along +z
  const crossZOnVec = (w, v)=>[ -w*v[1], w*v[0] ];
  const doubleCross = (w, r)=> crossZ(w, crossZ(w, r));
  const rot = (ang, r)=>{ const c=Math.cos(ang), s=Math.sin(ang); return [c*r[0]-s*r[1], s*r[0]+c*r[1]]; };

  // ====== Scene setup ======
  const cvI = document.getElementById('cvInert');
  const cvR = document.getElementById('cvRot');
  const gI = cvI.getContext('2d');
  const gR = cvR.getContext('2d');
  const tSlider = document.getElementById('t');
  const tVal = document.getElementById('tVal');
  const omegaInput = document.getElementById('omega');
  const speedInput = document.getElementById('speed');
  const eqInert = document.getElementById('eqInert');
  const eqRot = document.getElementById('eqRot');

  const centerI = [cvI.width/2, cvI.height/2];
  const centerR = [cvR.width/2, cvR.height/2];

  // Initial conditions (in inertial frame)
  let r0 = [-140, -60];
  let v0Dir = [1, 0.6]; // direction; will be normalized and scaled by |v0|

  // For drawing history
  const pathI = []; // inertial positions
  const pathR = []; // rotating positions

  function fmt(v){ return Array.isArray(v) ? `(${v[0].toFixed(2)}, ${v[1].toFixed(2)})` : (typeof v==='number'? v.toFixed(3):String(v)); }

  // ====== Panning (per-canvas) ======
  function makePan(canvas){
    const state = { pan:[0,0], dragging:false, last:[0,0] };
    const onDown = (e)=>{ state.dragging=true; canvas.classList.add('dragging'); state.last=[e.offsetX,e.offsetY]; };
    const onMove = (e)=>{
      if(!state.dragging) return; const dx=e.offsetX-state.last[0], dy=e.offsetY-state.last[1];
      state.pan[0]+=dx; state.pan[1]+=dy; state.last=[e.offsetX,e.offsetY]; update(); };
    const onUp = ()=>{ state.dragging=false; canvas.classList.remove('dragging'); };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return state;
  }
  const panI = makePan(cvI);
  const panR = makePan(cvR);
  document.getElementById('resetI').onclick = ()=>{ panI.pan=[0,0]; update(); };
  document.getElementById('resetR').onclick = ()=>{ panR.pan=[0,0]; update(); };

  function drawGrid(g, center, pan, opts={}){
    const { step=40, minor=8 } = opts;
    g.save();
    g.clearRect(0,0,g.canvas.width,g.canvas.height);
    g.translate(center[0] + pan[0], center[1] + pan[1]);

    // minor grid
    g.beginPath(); g.lineWidth=1; g.globalAlpha=0.15;
    for(let x=-2000; x<=2000; x+=step/minor){ g.moveTo(x,-2000); g.lineTo(x,2000);}    
    for(let y=-2000; y<=2000; y+=step/minor){ g.moveTo(-2000,y); g.lineTo(2000,y);} 
    g.strokeStyle="#bcd3ff"; g.stroke();

    // main grid
    g.beginPath(); g.globalAlpha=0.25; g.lineWidth=1.5;
    for(let x=-2000; x<=2000; x+=step){ g.moveTo(x,-2000); g.lineTo(x,2000);}    
    for(let y=-2000; y<=2000; y+=step){ g.moveTo(-2000,y); g.lineTo(2000,y);} 
    g.strokeStyle="#6aa6ff"; g.stroke();

    // axes
    g.globalAlpha=1; g.lineWidth=2.0; g.beginPath();
    g.moveTo(-2000,0); g.lineTo(2000,0);
    g.moveTo(0,-2000); g.lineTo(0,2000);
    g.strokeStyle="#ff9f6a"; g.stroke();
    g.restore();
  }

  function drawParticle(g, center, pan, r, color){
    g.save();
    g.translate(center[0] + pan[0], center[1] + pan[1]);
    g.beginPath(); g.arc(r[0], -r[1], 5, 0, Math.PI*2); g.fillStyle=color; g.fill();
    g.restore();
  }

  function drawPath(g, center, pan, arr, color){
    if(arr.length<2) return; g.save(); g.translate(center[0] + pan[0], center[1] + pan[1]);
    g.beginPath(); g.moveTo(arr[0][0], -arr[0][1]);
    for(let i=1;i<arr.length;i++){ g.lineTo(arr[i][0], -arr[i][1]); }
    g.lineWidth=2; g.globalAlpha=0.85; g.strokeStyle=color; g.stroke(); g.restore();
  }

  function eqVec(name, v){
    return `<span class="vec">${name}</span> = <span class="num">(${Number(v[0]).toFixed(2)}, ${Number(v[1]).toFixed(2)})</span>`;
  }

  function update(){
    const t = parseFloat(tSlider.value);
    tVal.textContent = t.toFixed(2);
    const w = parseFloat(omegaInput.value);
    const vMag = parseFloat(speedInput.value);

    // normalize direction
    const L = Math.hypot(v0Dir[0], v0Dir[1]);
    const v0 = [v0Dir[0]/L * vMag, v0Dir[1]/L * vMag];

    // --- Inertial positions/velocities/accelerations ---
    const rI = V.add(r0, V.mul(v0, t)); // uniform motion
    const vI = v0;
    const aI = [0,0];

    // --- Rotating frame values (ω const) ---
    const angle = -w*t; // map inertial -> rotating coordinates
    const rR = rot(angle, rI);
    const vR = rot(angle, V.sub(vI, crossZ(w, rI))); // v' = R(-wt)(v - ω×r)
    const aR = rot(angle, V.sub( V.sub(aI, V.mul(crossZOnVec(w, vI), 2)), doubleCross(w, rI) )); // a' = R(-ωt)(a - 2ω×v - ω×(ω×r))

    // RHS check: a_inert from rotating values
    const aI_fromRot = rot(-angle, V.add( aR, V.add( V.mul(crossZOnVec(w, vR), 2), doubleCross(w, rR) )));

    // store paths
    const idx = Math.round(t*60);
    pathI[idx] = rI; pathR[idx] = rR;

    // --- Draw ---
    drawGrid(gI, centerI, panI.pan);
    drawPath(gI, centerI, panI.pan, pathI.filter(Boolean), '#9be370');
    drawParticle(gI, centerI, panI.pan, rI, '#c2ffd6');

    drawGrid(gR, centerR, panR.pan);
    drawPath(gR, centerR, panR.pan, pathR.filter(Boolean), '#ffd68c');
    drawParticle(gR, centerR, panR.pan, rR, '#fff0c2');

    // --- Equations (readable HTML) ---
    eqInert.innerHTML = `
      <div class="mathline"><b>a</b><sub>инерц</sub> = R(ωt) · ( <b>a</b>' + 2 ω × <b>v</b>' + ω × (ω × <b>r</b>') )</div>
      <div class="mathline small">ω = (0,0,<span class="num">${w.toFixed(2)}</span>), t = <span class="num">${t.toFixed(2)}</span></div>
      <div class="mathline small">${eqVec("r'", rR)}; ${eqVec("v'", vR)}; ${eqVec("a'", aR)}</div>
      <div class="mathline small">⇒ <b>a</b><sub>инерц</sub> (расч) = ${eqVec("", aI_fromRot).replace('<span class="vec"></span> = ','')}</div>
    `;

    eqRot.innerHTML = `
      <div class="mathline"><b>a</b>' = R(−ωt) · ( <b>a</b><sub>инерц</sub> − 2 ω × <b>v</b><sub>инерц</sub> − ω × (ω × <b>r</b><sub>инерц</sub>) )</div>
      <div class="mathline small">${eqVec("r<sub>инерц</sub>", rI)}; ${eqVec("v<sub>инерц</sub>", vI)}; ${eqVec("a<sub>инерц</sub>", aI)}</div>
      <div class="mathline small">⇒ <b>a</b>' = ${eqVec("", aR).replace('<span class="vec"></span> = ','')}</div>
    `;
  }

  // interactions
  for (const el of [tSlider, omegaInput, speedInput]){
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  }

  // Reset paths when ω or speed change
  function resetPaths(){ pathI.length = 0; pathR.length = 0; }
  omegaInput.addEventListener('change', resetPaths);
  speedInput.addEventListener('change', resetPaths);

  update();
})();
