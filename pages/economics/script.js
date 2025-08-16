    /* ======================= State & DOM refs ======================= */
    let data = null;
    const canvas = document.getElementById('chartCanvas');
    const container = document.getElementById('chartContainer');
    const tooltip = document.getElementById('tooltip');

    const jsonInput = document.getElementById('jsonInput');
    const btnLoad = document.getElementById('btnLoad');
    const btnExport = document.getElementById('btnExport');
    const fileInput = document.getElementById('fileInput');

    const notesList = document.getElementById('notesList');
    const resourcesList = document.getElementById('resourcesList');
    const commentView = document.getElementById('commentView');
    const selectedCard = document.getElementById('selectedCard');

    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnReset = document.getElementById('btnReset');

    /* =================== Canvas sizing & transforms ================== */
    const ctx = canvas.getContext('2d');
    let worldBBox = {minX:-10,maxX:10,minY:-10,maxY:10};
    const margin = 28; // внутренний отступ в px (экранных)
    let fit = { s:1, tx:0, ty:0 };   // world -> screen (авто)
    let user = { s:1, tx:0, ty:0 };  // screen -> screen (пан/зум)
    const R_WORLD = 0.3;               // фиксированный радиус (в мировых единицах, уменьшен)

    /* ============================= Utils ============================= */
    function safe(s){ return String(s ?? '').replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m])) }
    function niceTick(raw){
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw || 1)));
      const n = raw / pow10;
      let step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
      return step * pow10;
    }
    function getWorldBBox(points){
      const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
      let minX = Math.min(...xs), maxX = Math.max(...xs);
      let minY = Math.min(...ys), maxY = Math.max(...ys);
      const padX = (maxX - minX) * 0.1 || 10;
      const padY = (maxY - minY) * 0.1 || 10;
      return { minX:minX-padX, maxX:maxX+padX, minY:minY-padY, maxY:maxY+padY };
    }
    function intensityFromSize(size){ // -> [0.35, 1] (альфа яркости)
      const s = Math.max(1, Math.min(10, size || 5));
      return 0.35 + (s - 1) * (0.65 / 9);
    }

    /* ===== World<->Screen (с учётом авто-fit и пользовательского зума) ===== */
    function computeFit(){
      const rect = canvas.getBoundingClientRect();
      const W = rect.width - margin*2;
      const H = rect.height - margin*2;
      const w = worldBBox.maxX - worldBBox.minX;
      const h = worldBBox.maxY - worldBBox.minY;
      const sx = W / w;
      const sy = H / h;
      const s = Math.min(sx, sy);
      fit.s = s;
      // ось Y — вверх (мировая), но на экране вниз, поэтому инвертируем при отрисовке
      fit.tx = margin + (W - s*w)/2 - s*worldBBox.minX;
      fit.ty = rect.height - margin - (H - s*h)/2 + s*worldBBox.minY;
      // сброс пользовательского зума
      user = { s:1, tx:0, ty:0 };
    }
    function worldToScreen(x, y){
      // сначала авто-fit (с инверсией Y), затем пользовательский зум/пан
      let X = fit.s * x + fit.tx;
      let Y = -fit.s * y + fit.ty;
      X = user.s * X + user.tx;
      Y = user.s * Y + user.ty;
      return [X, Y];
    }
    function screenToWorld(Xs, Ys){
      // обратное преобразование для хитов/подписей
      let X = (Xs - user.tx) / user.s;
      let Y = (Ys - user.ty) / user.s;
      const x = (X - fit.tx) / fit.s;
      const y = - (Y - fit.ty) / fit.s;
      return [x, y];
    }

    /* ============================= Drawing ============================ */
    function setCanvasSize(){
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const rect = container.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr, dpr);
    }
    function drawGridAxes(){
      const rect = canvas.getBoundingClientRect();
      // фон
      ctx.fillStyle = '#f7f9fc'; // Light background
      ctx.fillRect(0,0,rect.width,rect.height);

      const [vw_minX, vw_maxY] = screenToWorld(0, 0);
      const [vw_maxX, vw_minY] = screenToWorld(rect.width, rect.height);

      // сетка
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#555555'; // Dark gridlines
      ctx.lineWidth = 1;
      ctx.beginPath();
      const xStep = niceTick((vw_maxX - vw_minX) / 10);
      const yStep = niceTick((vw_maxY - vw_minY) / 8);

      for(let x = Math.ceil(vw_minX / xStep) * xStep; x <= vw_maxX; x += xStep){
        const [x1,y1] = worldToScreen(x, vw_minY);
        const [x2,y2] = worldToScreen(x, vw_maxY);
        ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      }
      for(let y = Math.ceil(vw_minY / yStep) * yStep; y <= vw_maxY; y += yStep){
        const [x1,y1] = worldToScreen(vw_minX, y);
        const [x2,y2] = worldToScreen(vw_maxX, y);
        ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      }
      ctx.stroke();

      // оси X=0 и Y=0
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis').trim() || '#c2cff3';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let [ax1,ay1] = worldToScreen(vw_minX, 0);
      let [ax2,ay2] = worldToScreen(vw_maxX, 0);
      ctx.moveTo(ax1,ay1); ctx.lineTo(ax2,ay2);
      [ax1,ay1] = worldToScreen(0, vw_minY);
      [ax2,ay2] = worldToScreen(0, vw_maxY);
      ctx.moveTo(ax1,ay1); ctx.lineTo(ax2,ay2);
      ctx.stroke();

      // подписи тиков (крупные)
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#9aa7bd';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      for(let x = Math.ceil(vw_minX / xStep) * xStep; x <= vw_maxX; x += xStep){
        if (x === 0) continue;
        const [sx, sy] = worldToScreen(x, 0);
        ctx.fillText(String(x), sx+4, sy-4);
      }
      for(let y = Math.ceil(vw_minY / yStep) * yStep; y <= vw_maxY; y += yStep){
        if (y === 0) continue;
        const [sx, sy] = worldToScreen(0, y);
        ctx.fillText(String(y), sx+4, sy-4);
      }

      // подписи осей
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#e7ebf3';
      ctx.font = '12px system-ui, sans-serif';
      const xLabel = data.axes?.x?.label || 'X';
      const yLabel = data.axes?.y?.label || 'Y';

      const [, yZero] = worldToScreen(0, 0);
      ctx.textAlign = 'right';
      ctx.fillText(xLabel, rect.width - 15, yZero + 18);

      const [xZero, ] = worldToScreen(0, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(yLabel, xZero + 8, 15);
    }
    function drawPoints() {
      const R = R_WORLD * fit.s * user.s; // screen radius
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#e7ebf3';
      const detectedClusters = new Map();

      // Group points by identical coordinates
      for (let p of data.points || []) {
        const key = `${p.x},${p.y}`;
        if (!detectedClusters.has(key)) detectedClusters.set(key, []);
        detectedClusters.get(key).push(p);
      }

      // Handle and dynamically draw point clusters
      for (const [coords, points] of detectedClusters.entries()) {
        const [baseX, baseY] = coords.split(',').map(Number);

        if (points.length > 1) {
          const [centerX, centerY] = worldToScreen(baseX, baseY);

          const adjustedRadius = Math.max(1, R * 0.35); // Reduce size for stack visualization
          const stackSeparation = adjustedRadius * 2.5;
          const totalStackHeight = stackSeparation * (points.length - 1);
          const startY = centerY - totalStackHeight / 2;

          const clusterCircleRadius = (totalStackHeight / 2) + (adjustedRadius * 2);

          // Draw circle indicating stack presence
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.arc(centerX, centerY, clusterCircleRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          points.forEach((p, i) => {
            const pointY = startY + i * stackSeparation;
            const pointX = centerX;

            // Draw individual point
            ctx.save();
            const normalizedSize = Math.max(0, Math.min(100, p.size || 0)) / 100;
            const red = Math.round(normalizedSize * 255);
            const blue = Math.round((1 - normalizedSize) * 255);
            const fillColor = `rgb(${red}, 0, ${blue})`;
            ctx.fillStyle = fillColor;

            ctx.beginPath();
            if (p.type === "книга") {
                const side = adjustedRadius * 2;
                ctx.rect(pointX - side / 2, pointY - side / 2, side, side);
            } else {
                ctx.arc(pointX, pointY, adjustedRadius, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();

            // Position labels to avoid overlaps within stack
            const labelX = pointX + clusterCircleRadius + 5;
            const labelY = pointY;

            // Draw label
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = ink;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.title, labelX, labelY);
          });
        } else {
          // For standalone points
          const p = points[0];
          const [sx, sy] = worldToScreen(p.x, p.y);

          ctx.save();
          const normalizedSize = Math.max(0, Math.min(100, p.size || 0)) / 100;
          const red = Math.round(normalizedSize * 255);
          const blue = Math.round((1 - normalizedSize) * 255);
          const fillColor = `rgb(${red}, 0, ${blue})`;
          ctx.fillStyle = fillColor;

          ctx.beginPath();
          if (p.type === "книга") {
              const side = Math.max(2, Math.abs(R)) * 2;
              ctx.rect(sx - side / 2, sy - side / 2, side, side);
          } else {
              ctx.arc(sx, sy, Math.max(2, Math.abs(R)), 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.restore();

          // Draw label
          ctx.font = '12px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = ink;
          const dx = Math.max(2, Math.abs(R)) + 4;
          const dy = Math.max(2, Math.abs(R)) + 4;
          ctx.fillText(p.title, sx + dx, sy - dy);
        }
      }
    }
    function render(){
      setCanvasSize();
      drawGridAxes();
      drawPoints();
    }

    /* ============================ Tooltip ============================ */
    function tooltipHTML(p){
      return `
        <div style="font-weight:600; margin-bottom:4px;">${safe(p.title)}</div>
        ${p.year ? `<div><strong>Год:</strong> ${safe(p.year)}</div>` : ``}
        ${p.type ? `<div><strong>Тип:</strong> ${safe(p.type)}</div>` : ``}
        <div><strong>X:</strong> ${p.x}, <strong>Y:</strong> ${p.y}</div>
        ${p.description ? `<div style="margin-top:6px">${safe(p.description)}</div>` : ``}
        ${Array.isArray(p.key_takeaways)&&p.key_takeaways.length
            ? `<div style="margin-top:6px"><strong>Ключевые выводы:</strong><ul>${p.key_takeaways.map(k=>`<li>${safe(k)}</li>`).join('')}</ul></div>` : ``}
        ${p.url ? `<div style="margin-top:6px"><a href="${p.url}" target="_blank" rel="noopener">Открыть ресурс ↗</a></div>` : ``}
      `;
    }
    let tooltipFixed = false;
    let hoverPoint = null;

    function moveTooltipTo(clientX, clientY){
      const c = container.getBoundingClientRect();
      const pad = 12;
      const tw = tooltip.offsetWidth || 260;
      const th = tooltip.offsetHeight || 120;
      let x = clientX - c.left + 14;
      let y = clientY - c.top + 14;
      if(x + tw + pad > c.width) x = c.width - tw - pad;
      if(y + th + pad > c.height) y = c.height - th - pad;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
    function showTooltip(p, clientX, clientY){
      if(tooltipFixed) return;
      tooltip.innerHTML = tooltipHTML(p);
      tooltip.hidden = false;
      moveTooltipTo(clientX, clientY);
    }
    function hideTooltip(){
      if(tooltipFixed) return;
      tooltip.hidden = true;
    }

    /* ====================== Hit-testing for points ===================== */
    function pointAt(clientX, clientY){
      // screen coords relative to canvas CSS pixels
      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const R = R_WORLD * fit.s * user.s;

      // We need to check against the actual drawn positions.
      // Re-clustering is necessary here to mirror the drawing logic.
      const detectedClusters = new Map();
      for (let p of data.points || []) {
        const key = `${p.x},${p.y}`;
        if (!detectedClusters.has(key)) detectedClusters.set(key, []);
        detectedClusters.get(key).push(p);
      }

      // Iterate in reverse order of clusters to check top-most clusters first
      // (assuming map preserves insertion order, which it does)
      const clusterEntries = Array.from(detectedClusters.entries()).reverse();

      for (const [coords, points] of clusterEntries) {
        const [baseX, baseY] = coords.split(',').map(Number);

        if (points.length > 1) {
            const [centerX, centerY] = worldToScreen(baseX, baseY);
            const adjustedRadius = Math.max(1, R * 0.35);
            const stackSeparation = adjustedRadius * 2.5;
            const totalStackHeight = stackSeparation * (points.length - 1);
            const startY = centerY - totalStackHeight / 2;

            // Check points in reverse draw order (from top of stack to bottom on screen)
            for (let i = points.length - 1; i >= 0; i--) {
                const p = points[i];
                const pointY = startY + i * stackSeparation;
                const pointX = centerX;

                const dx = clickX - pointX;
                const dy = clickY - pointY;
                const hitRadius = adjustedRadius + 4; 
                if (dx*dx + dy*dy <= hitRadius*hitRadius) {
                    return p;
                }
            }
        } else {
          // Single point
          const p = points[0];
          const [px, py] = worldToScreen(p.x, p.y);
          const dx = clickX - px;
          const dy = clickY - py;
          const hitRadius = Math.max(6, Math.abs(R)) + 4;
          if (dx*dx + dy*dy <= hitRadius*hitRadius) {
            return p;
          }
        }
      }
      return null;
    }

    /* ========================= Pan & Zoom handlers ========================= */
    let isDragging = false;
    let last = {x:0, y:0};

    canvas.addEventListener('mousedown', e => { isDragging = true; last = {x:e.clientX, y:e.clientY}; });
    window.addEventListener('mouseup',   () => { isDragging = false; });
    window.addEventListener('mousemove', e => {
      if(isDragging){
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        last = {x:e.clientX, y:e.clientY};
        user.tx += dx;
        user.ty += dy;
        render();
      } else {
        const p = pointAt(e.clientX, e.clientY);
        hoverPoint = p;
        if(p) showTooltip(p, e.clientX, e.clientY); else hideTooltip();
      }
    });

    // Zoom with wheel
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = Math.pow(1.15, -Math.sign(e.deltaY)); // шаг ~15%
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const prevS = user.s;
      const isSmallScreen = rect.width < 600;
      const maxZoom = isSmallScreen ? 20 : 8;
      const newS = Math.max(0.2, Math.min(maxZoom, prevS * factor));
      const k = newS / prevS;

      // зум вокруг точки (mx,my)
      user.tx = mx - k*(mx - user.tx);
      user.ty = my - k*(my - user.ty);
      user.s = newS;

      render();
    },{passive:false});

    // Touch: drag & pinch
    let touchState = { mode:null, p1:null, p2:null, startDist:0, startS:1, startTx:0, startTy:0, startMid:null };
    canvas.addEventListener('touchstart', e => {
      if(e.touches.length === 1){
        touchState.mode = 'drag';
        touchState.p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
      } else if(e.touches.length === 2){
        touchState.mode = 'pinch';
        touchState.p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        touchState.p2 = { x:e.touches[1].clientX, y:e.touches[1].clientY };
        touchState.startDist = Math.hypot(touchState.p1.x - touchState.p2.x, touchState.p1.y - touchState.p2.y);
        touchState.startS = user.s;
        touchState.startTx = user.tx;
        touchState.startTy = user.ty;
        touchState.startMid = { 
            x: (touchState.p1.x + touchState.p2.x) / 2,
            y: (touchState.p1.y + touchState.p2.y) / 2
        };
      }
    }, {passive:true});
    canvas.addEventListener('touchmove', e => {
      if(touchState.mode === 'drag' && e.touches.length === 1){
        const p = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        const dx = p.x - touchState.p1.x;
        const dy = p.y - touchState.p1.y;
        touchState.p1 = p;
        user.tx += dx; user.ty += dy;
        render();
      } else if(touchState.mode === 'pinch' && e.touches.length === 2){
        const rect = canvas.getBoundingClientRect();
        // current state
        const p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        const p2 = { x:e.touches[1].clientX, y:e.touches[1].clientY };
        const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const currentMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        // Dynamic max zoom
        const isSmallScreen = rect.width < 600;
        const maxZoom = isSmallScreen ? 20 : 8;

        // Calculate new scale
        const scale = newDist / (touchState.startDist || newDist);
        const newS = Math.max(0.2, Math.min(maxZoom, touchState.startS * scale));
        const k = newS / touchState.startS;

        // Pan delta
        const panDx = currentMid.x - touchState.startMid.x;
        const panDy = currentMid.y - touchState.startMid.y;

        // Initial midpoint relative to canvas
        const mx = touchState.startMid.x - rect.left;
        const my = touchState.startMid.y - rect.top;

        // Apply new transform
        user.s = newS;
        user.tx = mx - k * (mx - touchState.startTx) + panDx;
        user.ty = my - k * (my - touchState.startTy) + panDy;

        render();
      }
    },{passive:true});
    window.addEventListener('touchend', ()=> { touchState.mode = null; }, {passive:true});

    // Buttons
    btnZoomIn.addEventListener('click', ()=> zoomBy(1.2));
    btnZoomOut.addEventListener('click', ()=> zoomBy(1/1.2));
    btnReset.addEventListener('click', ()=> { computeFit(); render(); });
    function zoomBy(factor){
      const rect = canvas.getBoundingClientRect();
      const mx = rect.width/2, my = rect.height/2;
      const prevS = user.s;
      const isSmallScreen = rect.width < 600;
      const maxZoom = isSmallScreen ? 20 : 8;
      const newS = Math.max(0.2, Math.min(maxZoom, prevS * factor));
      const k = newS / prevS;
      user.tx = mx - k*(mx - user.tx);
      user.ty = my - k*(my - user.ty);
      user.s = newS;
      render();
    }

    /* =========================== Click select =========================== */
    canvas.addEventListener('click', e => {
      const p = pointAt(e.clientX, e.clientY);
      if(!p){ tooltipFixed = false; hideTooltip(); selectedCard.hidden = true; selectedCard.innerHTML = ''; return; }
      tooltipFixed = true;
      tooltip.innerHTML = tooltipHTML(p);
      tooltip.hidden = false;
      moveTooltipTo(e.clientX, e.clientY);
      renderSelection(p);
    });
    function renderSelection(p){
      selectedCard.hidden = false;
      selectedCard.innerHTML = `
        <h2>Selected</h2>
        <h3>${safe(p.title)}</h3>
        ${p.year?`<div class="row"><strong>Год:</strong> ${safe(p.year)}</div>`:''}
        ${p.type?`<div class="row"><strong>Тип:</strong> ${safe(p.type)}</div>`:''}
        ${p.description?`<div class="row">${safe(p.description)}</div>`:''}
        ${Array.isArray(p.key_takeaways)&&p.key_takeaways.length?`<div class="row"><strong>Ключевые выводы:</strong><ul>${p.key_takeaways.map(k=>`<li>${safe(k)}</li>`).join('')}</ul></div>`:''}
        ${p.size !== undefined ? `
        <div class="row">
            <strong>Влияние:</strong> ${p.size}
            <span style="display: inline-block; width: 20px; height: 20px; background-color: ${
              (() => {
                  const normalizedSize = Math.max(0, Math.min(100, p.size || 0)) / 100;
                  const red = Math.round(normalizedSize * 255);
                  const blue = Math.round((1 - normalizedSize) * 255);
                  return `rgb(${red}, 0, ${blue})`;
              })()
            }; border-radius: 4px; margin-left: 8px;"></span>
        </div>
        ` : ''}
        ${p.url?`<div class="row"><a href="${p.url}" target="_blank" rel="noopener">Открыть ресурс ↗</a></div>`:''}
      `;
    }

    /* =================== Notes / Comment / Resources =================== */
    function renderNotesAndResources(){
      // Notes
      notesList.innerHTML = '';
      (data.notes || []).forEach(n => {
        const li = document.createElement('li');
        li.textContent = n;
        notesList.appendChild(li);
      });


      // Resources (уникальные URL)
      resourcesList.innerHTML = '';
      const items = [];
      (data.points || []).forEach(p => { if(p.url) items.push({title:p.title, url:p.url, type:p.type, year:p.year}); });
      const uniq = Object.values(items.reduce((acc, it) => (acc[it.url] ??= it, acc), {}));
      uniq.sort((a,b) => (a.title||'').localeCompare(b.title||''));
      uniq.forEach(it => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = it.title + (it.year?` (${it.year})`:``) + (it.type?` — ${it.type}`:``);
        li.appendChild(a);
        resourcesList.appendChild(li);
      });
    }

    /* ======================= Load / Export JSON ======================= */
    btnLoad.addEventListener('click', () => {
      try{
        const parsed = JSON.parse(jsonInput.value);
        if(!Array.isArray(parsed.points)) throw new Error('В JSON отсутствует массив points');
        data = parsed;
        applyData();
      }catch(err){
        alert('Ошибка разбора JSON: ' + err.message);
      }
    });
    btnExport.addEventListener('click', () => {
      try{
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ideas-map.json';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }catch(err){
        alert('Не удалось сформировать файл: ' + err.message);
      }
    });
    fileInput.addEventListener('change', e => {
      const f = e.target.files?.[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const parsed = JSON.parse(reader.result);
          if(!Array.isArray(parsed.points)) throw new Error('В JSON отсутствует массив points');
          // Умножаем все `size` на 10
          data = parsed;
          if (Array.isArray(data.points)) {
              data.points.forEach(p => {
                  if (typeof p.size === "number") {
                      p.size *= 10;
                  }
              });
          }
          jsonInput.value = JSON.stringify(data, null, 2);
          applyData();
        }catch(err){ alert('Ошибка разбора файла: ' + err.message); }
      };
      reader.readAsText(f);
    });

    /* ======================== Apply & Init ======================== */
    function applyData(){
      document.getElementById('pageTitle').textContent = data.title || 'Карта';
      worldBBox = getWorldBBox(data.points || [{x:0,y:0}]);
      computeFit();
      renderNotesAndResources();
      render();
      tooltipFixed = false; hideTooltip(); selectedCard.hidden = true; selectedCard.innerHTML = '';
    }
    async function init(){
      try{
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        data = await response.json();
      }catch(e){
        console.error("Failed to load data:", e);
        data = { title:'Карта (ошибка загрузки)', points:[] };
      }
      jsonInput.value = JSON.stringify(data, null, 2);
      applyData();
    }
    window.addEventListener('resize', () => { computeFit(); render(); });
    init();
