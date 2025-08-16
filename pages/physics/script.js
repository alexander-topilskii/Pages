(function(){
  // ====== Math helpers (2D + z=0) ======
  const V = {
    add: (a,b)=>[a[0]+b[0], a[1]+b[1]],
    sub: (a,b)=>[a[0]-b[0], a[1]-b[1]],
    mul: (a,s)=>[a[0]*s, a[1]*s],
  };
  const crossZ = (w, r)=>[ -w*r[1], w*r[0] ];          // ω×r
  const crossZOnVec = (w, v)=>[ -w*v[1], w*v[0] ];      // ω×v
  const doubleCross = (w, r)=> crossZ(w, crossZ(w, r)); // ω×(ω×r)
  const rot = (ang, r)=>{ const c=Math.cos(ang), s=Math.sin(ang); return [c*r[0]-s*r[1], s*r[0]+c*r[1]]; };

  // ====== DOM ======
  const cvI = document.getElementById('cvInert');
  const cvR = document.getElementById('cvRot');
  const gI = cvI.getContext('2d');
  const gR = cvR.getContext('2d');
  const tSlider = document.getElementById('t');
  const tInput  = document.getElementById('tInput');
  const tVal    = document.getElementById('tVal');
  const omegaInput = document.getElementById('omega');
  const speedInput = document.getElementById('speed');
  const scaleInput = document.getElementById('scale');
  const eqInert = document.getElementById('eqInert');
  const eqRot   = document.getElementById('eqRot');

  const centerI = [cvI.width/2, cvI.height/2];
  const centerR = [cvR.width/2, cvR.height/2];

  // ====== State ======
  let r0 = [-140, -60];
  let v0Dir = [1, 0.6];
  const pathI = [];
  const pathR = [];

  // Panning state per canvas
  function makePan(canvas){
    const state = { pan:[0,0], dragging:false, last:[0,0] };
    canvas.addEventListener('mousedown', e=>{ state.dragging=true; canvas.classList.add('dragging'); state.last=[e.offsetX,e.offsetY]; });
    canvas.addEventListener('mousemove', e=>{
      if(!state.dragging) return; const dx=e.offsetX-state.last[0], dy=e.offsetY-state.last[1];
      state.pan[0]+=dx; state.pan[1]+=dy; state.last=[e.offsetX,e.offsetY]; render();
    });
    window.addEventListener('mouseup', ()=>{ state.dragging=false; canvas.classList.remove('dragging'); });
    // wheel zoom (global scaleInput changed for simplicity)
    canvas.addEventListener('wheel', e=>{
      e.preventDefault();
      const factor = e.deltaY<0 ? 1.1 : 0.9;
      const newScale = Math.min(3, Math.max(0.4, parseFloat(scaleInput.value||'1')*factor));
      scaleInput.value = newScale.toFixed(2);
      render();
    }, {passive:false});
    return state;
  }
  const panI = makePan(cvI);
  const panR = makePan(cvR);

  document.getElementById('resetI').onclick = ()=>{ panI.pan=[0,0]; render(); };
  document.getElementById('resetR').onclick = ()=>{ panR.pan=[0,0]; render(); };

  // ====== Draw helpers ======
  function drawGrid(g, center, pan, scale){
    const step=40, minor=8;
    g.save();
    g.clearRect(0,0,g.canvas.width,g.canvas.height);
    g.translate(center[0] + pan[0], center[1] + pan[1]);
    g.scale(scale, scale);

    // minor
    g.beginPath(); g.globalAlpha=0.15; g.lineWidth=1/scale;
    for(let x=-2000; x<=2000; x+=step/minor){ g.moveTo(x,-2000); g.lineTo(x,2000);}    
    for(let y=-2000; y<=2000; y+=step/minor){ g.moveTo(-2000,y); g.lineTo(2000,y);} 
    g.strokeStyle="#bcd3ff"; g.stroke();

    // main
    g.beginPath(); g.globalAlpha=0.25; g.lineWidth=1.5/scale;
    for(let x=-2000; x<=2000; x+=step){ g.moveTo(x,-2000); g.lineTo(x,2000);}    
    for(let y=-2000; y<=2000; y+=step){ g.moveTo(-2000,y); g.lineTo(2000,y);} 
    g.strokeStyle="#6aa6ff"; g.stroke();

    // axes
    g.globalAlpha=1; g.lineWidth=2/scale; g.beginPath();
    g.moveTo(-2000,0); g.lineTo(2000,0);
    g.moveTo(0,-2000); g.lineTo(0,2000);
    g.strokeStyle="#ff9f6a"; g.stroke();
    g.restore();
  }

  function drawPath(g, center, pan, arr, color, scale){
    if(arr.length<2) return; g.save(); g.translate(center[0]+pan[0], center[1]+pan[1]); g.scale(scale, scale);
    g.beginPath(); g.moveTo(arr[0][0], -arr[0][1]);
    for(let i=1;i<arr.length;i++) g.lineTo(arr[i][0], -arr[i][1]);
    g.lineWidth=2/scale; g.globalAlpha=0.85; g.strokeStyle=color; g.stroke();
    g.restore();
  }
  function drawPoint(g, center, pan, r, color, scale){
    g.save(); g.translate(center[0]+pan[0], center[1]+pan[1]); g.scale(scale, scale);
    g.beginPath(); g.arc(r[0], -r[1], 5/scale, 0, Math.PI*2); g.fillStyle=color; g.fill();
    g.restore();
  }

  // ====== Render ======
  function render(){
    const t = parseFloat(tSlider.value);
    tInput.value = t.toFixed(2);
    tVal.textContent = t.toFixed(2);
    const w = parseFloat(omegaInput.value);
    const vMag = parseFloat(speedInput.value);
    const scale = Math.min(3, Math.max(0.4, parseFloat(scaleInput.value || '1')));
    scaleInput.value = scale.toFixed(2);

    const L = Math.hypot(v0Dir[0], v0Dir[1]);
    const v0 = [v0Dir[0]/L * vMag, v0Dir[1]/L * vMag];

    // Inertial
    const rI = V.add(r0, V.mul(v0, t));
    const vI = v0;
    const aI = [0,0];

    // Rotating (ω const)
    const angle = -w*t;
    const rR = rot(angle, rI);
    const vR = rot(angle, V.sub(vI, crossZ(w, rI)));
    const aR = rot(angle, V.sub( V.sub(aI, V.mul(crossZOnVec(w, vI), 2)), doubleCross(w, rI) ));

    const aI_fromRot = rot(-angle, V.add( aR, V.add( V.mul(crossZOnVec(w, vR), 2), doubleCross(w, rR) )));

    // paths
    const idx = Math.round(t*60);
    pathI[idx] = rI; pathR[idx] = rR;

    // draw
    drawGrid(gI, centerI, panI.pan, scale);
    drawPath(gI, centerI, panI.pan, pathI.filter(Boolean), '#9be370', scale);
    drawPoint(gI, centerI, panI.pan, rI, '#c2ffd6', scale);

    drawGrid(gR, centerR, panR.pan, scale);
    drawPath(gR, centerR, panR.pan, pathR.filter(Boolean), '#ffd68c', scale);
    drawPoint(gR, centerR, panR.pan, rR, '#fff0c2', scale);

    // equations (HTML)
    const fmt = (v)=>`<span class="num">(${v[0].toFixed(2)}, ${v[1].toFixed(2)})</span>`;

    eqInert.innerHTML = `
      <div class="mathline"><b>a</b><sub>инерц</sub> = R(ωt) · ( <b>a</b>' + 2 ω × <b>v</b>' + ω × (ω × <b>r</b>') )</div>
      <div class="mathline small">ω = (0,0,<span class="num">${w.toFixed(2)}</span>), t = <span class="num">${t.toFixed(2)}</span></div>
      <div class="mathline small"><b>r′</b> = ${fmt(rR)}; <b>v′</b> = ${fmt(vR)}; <b>a′</b> = ${fmt(aR)}</div>
      <div class="mathline small">⇒ <b>a</b><sub>инерц</sub> (расч) = ${fmt(aI_fromRot)}</div>
    `;

    eqRot.innerHTML = `
      <div class="mathline"><b>a</b>′ = R(−ωt) · ( <b>a</b><sub>инерц</sub> − 2 ω × <b>v</b><sub>инерц</sub> − ω × (ω × <b>r</b><sub>инерц</sub>) )</div>
      <div class="mathline small"><b>r</b><sub>инерц</sub> = ${fmt(rI)}; <b>v</b><sub>инерц</sub> = ${fmt(vI)}; <b>a</b><sub>инерц</sub> = ${fmt(aI)}</div>
      <div class="mathline small">⇒ <b>a</b>′ = ${fmt(aR)}</div>
    `;
  }

  // Events
  for (const el of [tSlider, omegaInput, speedInput, scaleInput]){
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }
  tInput.addEventListener('input', ()=>{
    const val = parseFloat(tInput.value||'0');
    tSlider.value = isFinite(val)? String(val) : '0';
    render();
  });

  render();
})();