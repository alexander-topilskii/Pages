    /* ======================= State & DOM refs ======================= */
    let data = null;
    let mappedPoints = [];
    const canvas = document.getElementById('chartCanvas');
    const container = document.getElementById('chartContainer');
    const tooltip = document.getElementById('tooltip');

    const jsonInput = document.getElementById('jsonInput');
    const btnLoad = document.getElementById('btnLoad');
    const btnExport = document.getElementById('btnExport');
    const fileInput = document.getElementById('fileInput');

    const notesList = document.getElementById('notesList');
    const resourcesList = document.getElementById('resourcesList');
    const selectedCard = document.getElementById('selectedCard');

    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnReset = document.getElementById('btnReset');

    const xAxisSelect = document.getElementById('xAxisSelect');
    const yAxisSelect = document.getElementById('yAxisSelect');

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
      if (!points || points.length === 0) {
        return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
      }
      const xs = points.map(p=>p.renderX), ys = points.map(p=>p.renderY);
      let minX = Math.min(...xs), maxX = Math.max(...xs);
      let minY = Math.min(...ys), maxY = Math.max(...ys);
      const padX = (maxX - minX) * 0.1 || 2;
      const padY = (maxY - minY) * 0.1 || 2;
      return { minX:minX-padX, maxX:maxX+padX, minY:minY-padY, maxY:maxY+padY };
    }

    /* ===== World<->Screen (с учётом авто-fit и пользовательского зума) ===== */
    function computeFit(){
      const rect = canvas.getBoundingClientRect();
      const W = rect.width - margin*2;
      const H = rect.height - margin*2;
      const w = worldBBox.maxX - worldBBox.minX;
      const h = worldBBox.maxY - worldBBox.minY;
      const sx = w === 0 ? 1 : W / w;
      const sy = h === 0 ? 1 : H / h;
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
      ctx.fillStyle = '#f7f9fc';
      ctx.fillRect(0,0,rect.width,rect.height);

      const [vw_minX, vw_maxY] = screenToWorld(0, 0);
      const [vw_maxX, vw_minY] = screenToWorld(rect.width, rect.height);
      const xStep = niceTick((vw_maxX - vw_minX) / 10);
      const yStep = niceTick((vw_maxY - vw_minY) / 8);

      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let x = Math.ceil(vw_minX / xStep) * xStep; x <= vw_maxX; x += xStep){
        const [sx,] = worldToScreen(x, 0);
        ctx.moveTo(sx, 0); ctx.lineTo(sx, rect.height);
      }
      for(let y = Math.ceil(vw_minY / yStep) * yStep; y <= vw_maxY; y += yStep){
        const [, sy] = worldToScreen(0, y);
        ctx.moveTo(0, sy); ctx.lineTo(rect.width, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis').trim();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let [x_zero_x, x_zero_y] = worldToScreen(0,0);
      ctx.moveTo(0, x_zero_y); ctx.lineTo(rect.width, x_zero_y);
      ctx.moveTo(x_zero_x, 0); ctx.lineTo(x_zero_x, rect.height);
      ctx.stroke();

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
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

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      ctx.font = '12px system-ui, sans-serif';
      const xAxis = data.axes[xAxisSelect.value];
      const yAxis = data.axes[yAxisSelect.value];
      ctx.textAlign = 'right';
      ctx.fillText(xAxis.label, rect.width - 15, x_zero_y + 18);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(yAxis.label, x_zero_x + 8, 15);
    }
    function drawPoints() {
      const R = R_WORLD * fit.s * user.s;
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const detectedClusters = new Map();

      for (let p of mappedPoints) {
        const key = `${p.renderX},${p.renderY}`;
        if (!detectedClusters.has(key)) detectedClusters.set(key, []);
        detectedClusters.get(key).push(p);
      }

      for (const [coords, points] of detectedClusters.entries()) {
        const [baseX, baseY] = coords.split(',').map(Number);

        if (points.length > 1) {
          const [centerX, centerY] = worldToScreen(baseX, baseY);
          const adjustedRadius = Math.max(1, R * 0.35);
          const stackSeparation = adjustedRadius * 2.5;
          const totalStackHeight = stackSeparation * (points.length - 1);
          const startY = centerY - totalStackHeight / 2;
          const clusterCircleRadius = (totalStackHeight / 2) + (adjustedRadius * 2);

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

            ctx.save();
            const normalizedSize = Math.max(0, Math.min(100, p.size || 0)) / 100;
            const red = Math.round(normalizedSize * 255);
            const blue = Math.round((1 - normalizedSize) * 255);
            const fillColor = `rgb(${red}, 0, ${blue})`;

            const highlightX = pointX - adjustedRadius * 0.25;
            const highlightY = pointY - adjustedRadius * 0.25;
            const gradient = ctx.createRadialGradient(highlightX, highlightY, 0, pointX, pointY, adjustedRadius);
            const lighterColor = `rgb(${Math.min(255, red + 90)}, ${Math.min(255, 0 + 90)}, ${Math.min(255, blue + 90)})`;
            gradient.addColorStop(0, lighterColor);
            gradient.addColorStop(1, fillColor);
            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.arc(pointX, pointY, adjustedRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const labelX = pointX + clusterCircleRadius + 5;
            const labelY = pointY;
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = ink;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.title, labelX, labelY);
          });
        } else {
          const p = points[0];
          const [sx, sy] = worldToScreen(p.renderX, p.renderY);
          ctx.save();
          const normalizedSize = Math.max(0, Math.min(100, p.size || 0)) / 100;
          const red = Math.round(normalizedSize * 255);
          const blue = Math.round((1 - normalizedSize) * 255);
          const fillColor = `rgb(${red}, 0, ${blue})`;

          const radius = Math.max(2, Math.abs(R));
          const highlightX = sx - radius * 0.25;
          const highlightY = sy - radius * 0.25;
          const gradient = ctx.createRadialGradient(highlightX, highlightY, 0, sx, sy, radius);
          const lighterColor = `rgb(${Math.min(255, red + 90)}, ${Math.min(255, 0 + 90)}, ${Math.min(255, blue + 90)})`;
          gradient.addColorStop(0, lighterColor);
          gradient.addColorStop(1, fillColor);
          ctx.fillStyle = gradient;

          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

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
      const xVal = p.analytics[xAxisSelect.value];
      const yVal = p.analytics[yAxisSelect.value];
      return `
        <div style="font-weight:600; margin-bottom:4px;">${safe(p.title)}</div>
        <div style="font-size: .9em; color: var(--muted); margin-bottom: 8px;">
          ${data.axes[xAxisSelect.value].label}: ${xVal} <br>
          ${data.axes[yAxisSelect.value].label}: ${yVal}
        </div>
        <button class="tooltip-show-btn" onclick="document.getElementById('selectedCard').scrollIntoView({behavior: 'smooth'})">Показать</button>
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
      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const R = R_WORLD * fit.s * user.s;

      const detectedClusters = new Map();
      for (let p of mappedPoints) {
        const key = `${p.renderX},${p.renderY}`;
        if (!detectedClusters.has(key)) detectedClusters.set(key, []);
        detectedClusters.get(key).push(p);
      }

      const clusterEntries = Array.from(detectedClusters.entries()).reverse();

      for (const [coords, points] of clusterEntries) {
        const [baseX, baseY] = coords.split(',').map(Number);

        if (points.length > 1) {
            const [centerX, centerY] = worldToScreen(baseX, baseY);
            const adjustedRadius = Math.max(1, R * 0.35);
            const stackSeparation = adjustedRadius * 2.5;

            for (let i = points.length - 1; i >= 0; i--) {
                const p = points[i];
                const totalStackHeight = stackSeparation * (points.length - 1);
                const startY = centerY - totalStackHeight / 2;
                const pointY = startY + i * stackSeparation;
                const pointX = centerX;

                const dx = clickX - pointX;
                const dy = clickY - pointY;
                const hitRadius = adjustedRadius + 4; 
                if (dx*dx + dy*dy <= hitRadius*hitRadius) return p;
            }
        } else {
          const p = points[0];
          const [px, py] = worldToScreen(p.renderX, p.renderY);
          const dx = clickX - px;
          const dy = clickY - py;
          const hitRadius = Math.max(6, Math.abs(R)) + 4;
          if (dx*dx + dy*dy <= hitRadius*hitRadius) return p;
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
        user.tx += e.clientX - last.x;
        user.ty += e.clientY - last.y;
        last = {x:e.clientX, y:e.clientY};
        render();
      } else {
        const p = pointAt(e.clientX, e.clientY);
        hoverPoint = p;
        if(p) showTooltip(p, e.clientX, e.clientY); else hideTooltip();
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = Math.pow(1.15, -Math.sign(e.deltaY));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newS = user.s * factor;
      const k = newS / user.s;
      user.tx = mx - k*(mx - user.tx);
      user.ty = my - k*(my - user.ty);
      user.s = newS;
      render();
    },{passive:false});

    let touchState = { mode:null, p1:null, p2:null, startDist:0, startS:1, startTx:0, startTy:0, startMid:null };
    canvas.addEventListener('touchstart', e => {
      if(e.touches.length === 1){
        touchState.mode = 'drag';
        touchState.p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
      } else if(e.touches.length === 2){
        touchState.mode = 'pinch';
        const p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        const p2 = { x:e.touches[1].clientX, y:e.touches[1].clientY };
        touchState.startDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        touchState.startS = user.s;
        touchState.startTx = user.tx;
        touchState.startTy = user.ty;
        touchState.startMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      }
    }, {passive:true});
    canvas.addEventListener('touchmove', e => {
      if(touchState.mode === 'drag' && e.touches.length === 1){
        const p = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        user.tx += p.x - touchState.p1.x;
        user.ty += p.y - touchState.p1.y;
        touchState.p1 = p;
        render();
      } else if(touchState.mode === 'pinch' && e.touches.length === 2){
        const rect = canvas.getBoundingClientRect();
        const p1 = { x:e.touches[0].clientX, y:e.touches[0].clientY };
        const p2 = { x:e.touches[1].clientX, y:e.touches[1].clientY };
        const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const currentMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const scale = newDist / (touchState.startDist || newDist);
        const newS = touchState.startS * scale;
        const k = newS / touchState.startS;
        const panDx = currentMid.x - touchState.startMid.x;
        const panDy = currentMid.y - touchState.startMid.y;
        const mx = touchState.startMid.x - rect.left;
        const my = touchState.startMid.y - rect.top;
        user.s = newS;
        user.tx = mx - k * (mx - touchState.startTx) + panDx;
        user.ty = my - k * (my - touchState.startTy) + panDy;
        render();
      }
    },{passive:true});
    window.addEventListener('touchend', ()=> { touchState.mode = null; }, {passive:true});

    btnZoomIn.addEventListener('click', ()=> zoomBy(1.25));
    btnZoomOut.addEventListener('click', ()=> zoomBy(1/1.25));
    btnReset.addEventListener('click', ()=> { processAndRender(); });
    function zoomBy(factor){
      const rect = canvas.getBoundingClientRect();
      const mx = rect.width/2, my = rect.height/2;
      const newS = user.s * factor;
      const k = newS / user.s;
      user.tx = mx - k*(mx - user.tx);
      user.ty = my - k*(my - user.ty);
      user.s = newS;
      render();
    }

    /* =========================== Click select =========================== */
    canvas.addEventListener('click', e => {
      const p = pointAt(e.clientX, e.clientY);
      if(!p){
        tooltipFixed = false;
        tooltip.classList.remove('is-fixed');
        hideTooltip();
        selectedCard.hidden = true;
        selectedCard.innerHTML = '';
        return;
      }
      tooltipFixed = true;
      tooltip.classList.add('is-fixed');
      tooltip.innerHTML = tooltipHTML(p);
      tooltip.hidden = false;
      moveTooltipTo(e.clientX, e.clientY);
      renderSelection(p);
    });
    function renderSelection(p){
      let againstHtml = '';
      if (p.against && Array.isArray(p.against.key_points) && p.against.key_points.length > 0) {
        againstHtml = `
          <div class="row">
            <strong>Контраргументы:</strong>
            <ul>
              ${p.against.key_points.map(kp => `
                <li>
                  ${safe(kp.short_description)}
                  ${kp.url ? ` <a href="${safe(kp.url)}" target="_blank" rel="noopener">↗</a>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }

      selectedCard.hidden = false;
      selectedCard.innerHTML = `
        <h2>Selected</h2>
        <h3>${safe(p.title)}</h3>
        ${p.year?`<div class="row"><strong>Год:</strong> ${safe(p.year)}</div>`:''}
        ${p.type?`<div class="row"><strong>Тип:</strong> ${safe(p.type)}</div>`:''}
        ${p.description?`<div class="row">${safe(p.description)}</div>`:''}
        ${Array.isArray(p.key_takeaways)&&p.key_takeaways.length?`<div class="row"><strong>Ключевые выводы:</strong><ul>${p.key_takeaways.map(k=>`<li>${safe(k)}</li>`).join('')}</ul></div>`:''}
        ${againstHtml}
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

    /* =================== Data Mapping and Setup =================== */
    function getNumericValue(axisKey, point) {
      const axis = data.axes[axisKey];
      const value = point.analytics[axisKey];
      if (axis.type === 'numerical') {
        return value || 0;
      }
      if (axis.type === 'categorical') {
        const mapping = axis.values.find(v => v.key === value);
        return mapping ? mapping.numeric : -1;
      }
      return 0;
    }

    function mapPoints(xAxisKey, yAxisKey) {
        return (data.points || []).map(p => ({
            ...p,
            renderX: getNumericValue(xAxisKey, p),
            renderY: getNumericValue(yAxisKey, p),
        }));
    }

    function populateAxisSelectors() {
        const axes = Object.keys(data.axes);
        xAxisSelect.innerHTML = '';
        yAxisSelect.innerHTML = '';
        axes.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = data.axes[key].label;
            xAxisSelect.appendChild(option.cloneNode(true));
            yAxisSelect.appendChild(option);
        });
        xAxisSelect.value = 'achievability';
        yAxisSelect.value = 'optimism';
    }

    function processAndRender() {
        const xAxisKey = xAxisSelect.value;
        const yAxisKey = yAxisSelect.value;
        mappedPoints = mapPoints(xAxisKey, yAxisKey);
        worldBBox = getWorldBBox(mappedPoints);
        computeFit();
        render();
    }

    function setupUI() {
        document.getElementById('pageTitle').textContent = data.title || 'Карта';
        populateAxisSelectors();
        renderNotesAndResources();
        xAxisSelect.addEventListener('change', processAndRender);
        yAxisSelect.addEventListener('change', processAndRender);
    }

    function renderNotesAndResources(){
      notesList.innerHTML = (data.notes || []).map(n => `<li>${safe(n)}</li>`).join('');
      const items = (data.points || []).filter(p => p.url).map(p => ({title:p.title, url:p.url, type:p.type, year:p.year}));
      const uniq = Object.values(items.reduce((acc, it) => (acc[it.url] ??= it, acc), {}));
      uniq.sort((a,b) => (a.title||'').localeCompare(b.title||''));
      resourcesList.innerHTML = uniq.map(it => `<li><a href="${safe(it.url)}" target="_blank" rel="noopener">${safe(it.title)} (${it.year})</a></li>`).join('');
    }

    /* ======================= Load / Export JSON ======================= */
    btnLoad.addEventListener('click', () => {
      try{
        const parsed = JSON.parse(jsonInput.value);
        if(!parsed.points || !parsed.axes) throw new Error('В JSON отсутствует массив points или объект axes');
        data = parsed;
        setupUI();
        processAndRender();
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
          if(!parsed.points || !parsed.axes) throw new Error('В JSON отсутствует массив points или объект axes');
          data = parsed;
          jsonInput.value = JSON.stringify(data, null, 2);
          setupUI();
          processAndRender();
        }catch(err){ alert('Ошибка разбора файла: ' + err.message); }
      };
      reader.readAsText(f);
    });

    /* ======================== Init ======================== */
    async function init(){
      try{
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        data = await response.json();
      }catch(e){
        console.error("Failed to load data:", e);
        data = { title:'Карта (ошибка загрузки)', axes: {}, points:[] };
      }
      jsonInput.value = JSON.stringify(data, null, 2);
      setupUI();
      processAndRender();
    }
    window.addEventListener('resize', () => { computeFit(); render(); });
    init();
