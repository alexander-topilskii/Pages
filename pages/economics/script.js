let canvas = document.getElementById('chart');
let ctx = canvas.getContext('2d');
let tooltip = document.getElementById('tooltip');

let jsonData = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStart = {x:0, y:0};

// Resize canvas
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  draw();
}
window.addEventListener('resize', resizeCanvas);

// Load JSON
fetch('data.json')
  .then(res => res.json())
  .then(data => {
    jsonData = data;
    document.getElementById('title').innerText = data.title;
    document.getElementById('description').innerText = data.description;
    let notesList = document.getElementById('notes');
    data.notes.forEach(n => {
      let li = document.createElement('li');
      li.innerText = n;
      notesList.appendChild(li);
    });
    let resourcesList = document.getElementById('resources');
    data.points.forEach(p => {
      let li = document.createElement('li');
      let a = document.createElement('a');
      a.href = p.url;
      a.innerText = p.title;
      a.target = "_blank";
      li.appendChild(a);
      resourcesList.appendChild(li);
    });
    resizeCanvas();
  });

// Draw function
function draw() {
  if (!jsonData) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  let centerX = canvas.width / 2;
  let centerY = canvas.height / 2;
  ctx.translate(centerX, centerY);

  jsonData.points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x*5, -p.y*20, p.size*3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(100,150,250,0.6)';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(p.title, p.x*5, -p.y*20);
  });

  ctx.restore();
}

// Events
canvas.addEventListener('mousedown', e => {
  isDragging = true;
  dragStart.x = e.clientX - offsetX;
  dragStart.y = e.clientY - offsetY;
});
canvas.addEventListener('mouseup', () => { isDragging = false; });
canvas.addEventListener('mouseout', () => { isDragging = false; });
canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    offsetX = e.clientX - dragStart.x;
    offsetY = e.clientY - dragStart.y;
    draw();
  } else {
    showTooltip(e);
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  scale *= (e.deltaY > 0) ? 0.9 : 1.1;
  draw();
});

// Tooltip
function showTooltip(e) {
  if (!jsonData) return;
  let rect = canvas.getBoundingClientRect();
  let x = (e.clientX - rect.left - offsetX - canvas.width/2)/scale;
  let y = (e.clientY - rect.top - offsetY - canvas.height/2)/scale;
  y = -y;

  let found = null;
  jsonData.points.forEach(p => {
    let dx = x - p.x*5;
    let dy = y - p.y*20;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < p.size*3) {
      found = p;
    }
  });

  if (found) {
    tooltip.classList.remove('hidden');
    tooltip.style.left = e.pageX + 10 + 'px';
    tooltip.style.top = e.pageY + 10 + 'px';
    tooltip.innerHTML = `<strong>${found.title}</strong><br>${found.description}<br><a href='${found.url}' target='_blank'>Источник</a>`;
  } else {
    tooltip.classList.add('hidden');
  }
}
