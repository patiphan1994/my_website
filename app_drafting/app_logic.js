// --- 1. ตั้งค่ากระดานวาด ---
const canvas = new fabric.Canvas('draftCanvas', {
    width: window.innerWidth,
    height: window.innerHeight,
    selection: true,
    preserveObjectStacking: true
});

canvas.absolutePan({ x: -100, y: -100 });
let currentTool = 'select';
let isDrawingWall = false;
let tempLine;

// --- 2. ระบบ ซูม และ เลื่อน (Pan/Zoom) ---
canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 5) zoom = 5;
    if (zoom < 0.2) zoom = 0.2;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    
    document.getElementById('gridBg').style.backgroundSize = `${100 * zoom}px ${100 * zoom}px`;
    document.getElementById('gridBg').style.backgroundPosition = `${canvas.viewportTransform[4]}px ${canvas.viewportTransform[5]}px`;
    opt.e.preventDefault();
    opt.e.stopPropagation();
});

let isPanning = false;
let lastPosX, lastPosY;

canvas.on('mouse:down', function(opt) {
    var evt = opt.e;
    
    // Pan Canvas
    if (currentTool === 'pan' || evt.altKey) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        return;
    }

    // วาดกำแพง
    if (currentTool === 'wall') {
        isDrawingWall = true;
        var pointer = canvas.getPointer(opt.e);
        var points = [pointer.x, pointer.y, pointer.x, pointer.y];
        tempLine = new fabric.Line(points, {
            strokeWidth: 15, fill: '#374151', stroke: '#374151',
            strokeLineCap: 'square', originX: 'center', originY: 'center',
            selectable: false, evented: false
        });
        canvas.add(tempLine);
    }
});

canvas.on('mouse:move', function(opt) {
    if (isPanning) {
        var e = opt.e;
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        this.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        document.getElementById('gridBg').style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
    }

    if (isDrawingWall && tempLine) {
        var pointer = canvas.getPointer(opt.e);
        if (opt.e.shiftKey) { // ล็อคแกน
            let dx = Math.abs(pointer.x - tempLine.x1);
            let dy = Math.abs(pointer.y - tempLine.y1);
            if (dx > dy) { pointer.y = tempLine.y1; } else { pointer.x = tempLine.x1; }
        }
        tempLine.set({ x2: pointer.x, y2: pointer.y });
        canvas.renderAll();
    }
});

canvas.on('mouse:up', function(opt) {
    if (isPanning) {
        this.setViewportTransform(this.viewportTransform);
        isPanning = false;
        if(currentTool === 'select') canvas.selection = true;
    }
    if (isDrawingWall) {
        isDrawingWall = false;
        tempLine.setCoords();
        tempLine.set({ selectable: true, evented: true });
        if (Math.abs(tempLine.x1 - tempLine.x2) < 5 && Math.abs(tempLine.y1 - tempLine.y2) < 5) {
            canvas.remove(tempLine); // ลบถ้าสั้นไป
        } else {
            setTool('select');
            canvas.setActiveObject(tempLine);
        }
    }
});

// --- 3. ระบบเครื่องมือ ---
window.setTool = function(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
    
    canvas.selection = (tool === 'select');
    canvas.forEachObject(o => o.selectable = (tool === 'select'));
    canvas.defaultCursor = (tool === 'pan') ? 'grab' : (tool === 'wall' ? 'crosshair' : 'default');
    
    if(tool !== 'select') canvas.discardActiveObject().renderAll();
};

window.addRoom = function() {
    setTool('select');
    var rect = new fabric.Rect({
        left: canvas.getVpCenter().x, top: canvas.getVpCenter().y,
        width: 400, height: 300, fill: 'rgba(79, 70, 229, 0.15)',
        stroke: '#4f46e5', strokeWidth: 2, strokeDashArray: [5, 5],
        originX: 'center', originY: 'center', transparentCorners: false
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
};

// --- 4. เมนูตั้งค่าด้านขวา ---
const panel = document.getElementById('propsPanel');
canvas.on('selection:created', showProperties);
canvas.on('selection:updated', showProperties);
canvas.on('object:modified', showProperties);
canvas.on('selection:cleared', () => panel.classList.remove('open'));

function showProperties() {
    const obj = canvas.getActiveObject();
    if(!obj) return;
    panel.classList.add('open');
    document.getElementById('propL').value = Math.round(obj.left);
    document.getElementById('propT').value = Math.round(obj.top);
    
    if (obj.type === 'line') {
        let length = Math.sqrt(Math.pow(obj.x2 - obj.x1, 2) + Math.pow(obj.y2 - obj.y1, 2));
        document.getElementById('propW').value = Math.round(length * obj.scaleX);
        document.getElementById('propH').value = Math.round(obj.strokeWidth * obj.scaleY);
        document.getElementById('propColor').value = obj.stroke;
    } else {
        document.getElementById('propW').value = Math.round(obj.width * obj.scaleX);
        document.getElementById('propH').value = Math.round(obj.height * obj.scaleY);
        let c = new fabric.Color(obj.fill).toHex();
        document.getElementById('propColor').value = '#' + c;
    }
}

window.updateObject = function() {
    const obj = canvas.getActiveObject();
    if(!obj) return;
    if (obj.type === 'line') {
        obj.set({ stroke: document.getElementById('propColor').value });
        obj.set({ strokeWidth: parseFloat(document.getElementById('propH').value) || 15 });
    } else {
        const newW = parseFloat(document.getElementById('propW').value) || 100;
        const newH = parseFloat(document.getElementById('propH').value) || 100;
        obj.set({ left: parseFloat(document.getElementById('propL').value), top: parseFloat(document.getElementById('propT').value), width: newW, height: newH, scaleX: 1, scaleY: 1 });
        let colorHex = document.getElementById('propColor').value;
        let colorRgb = new fabric.Color(colorHex).getSource();
        obj.set({ fill: `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.15)`, stroke: colorHex });
    }
    obj.setCoords();
    canvas.requestRenderAll();
};

window.deleteObject = function() {
    const obj = canvas.getActiveObject();
    if(obj) { canvas.remove(obj); panel.classList.remove('open'); }
};

window.addEventListener('resize', () => { canvas.setWidth(window.innerWidth); canvas.setHeight(window.innerHeight); });
