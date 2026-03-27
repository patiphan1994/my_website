// --- 1. การตั้งค่าหน้ากระดาษ ---
const canvas = new fabric.Canvas('draftCanvas', {
    width: window.innerWidth,
    height: window.innerHeight,
    selection: true,
    preserveObjectStacking: true
});
canvas.absolutePan({ x: -window.innerWidth/2 + 200, y: -window.innerHeight/2 + 100 });

// --- 2. จัดการเมนูเครื่องมือ ---
let currentTool = 'select';
const toolBtns = document.querySelectorAll('.tool-btn');

toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        toolBtns.forEach(b => b.classList.remove('active'));
        const clickedBtn = e.currentTarget;
        clickedBtn.classList.add('active');
        
        currentTool = clickedBtn.getAttribute('data-tool');
        
        if(currentTool === 'pan') {
            canvas.selection = false;
            canvas.defaultCursor = 'grab';
        } else if (currentTool === 'select') {
            canvas.selection = true;
            canvas.defaultCursor = 'default';
        } else {
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.discardActiveObject().renderAll();
        }
    });
});

// --- 3. ตรรกะการวาดลงกระดาน ---
let isDrawingWall = false;
let tempLine = null;
let isPanning = false;
let lastPosX, lastPosY;

canvas.on('mouse:down', function(opt) {
    const evt = opt.e;
    
    // Pan (เลื่อนกระดาน)
    if (currentTool === 'pan' || evt.altKey) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        return;
    }

    const pointer = canvas.getPointer(opt.e);

    // วาดห้อง (Room)
    if (currentTool === 'room') {
        const rect = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 250, height: 200,
            fill: 'rgba(79, 70, 229, 0.15)', stroke: '#4f46e5', strokeWidth: 2,
            originX: 'center', originY: 'center', transparentCorners: false
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        document.querySelector('[data-tool="select"]').click(); // กลับโหมดเมาส์
    }

    // วาดกำแพง (Wall)
    if (currentTool === 'wall') {
        isDrawingWall = true;
        tempLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            strokeWidth: 15, fill: '#374151', stroke: '#374151',
            strokeLineCap: 'square', originX: 'center', originY: 'center',
            selectable: false, evented: false
        });
        canvas.add(tempLine);
    }
});

canvas.on('mouse:move', function(opt) {
    const pointer = canvas.getPointer(opt.e);
    const coordsDisplay = document.getElementById('coordsDisplay');
    if(coordsDisplay) coordsDisplay.innerText = `X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`;

    // เลื่อนกระดาน
    if (isPanning) {
        const e = opt.e;
        const vpt = this.viewportTransform;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        this.requestRenderAll();
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        document.getElementById('gridBg').style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
    }

    // ลากกำแพง
    if (isDrawingWall && tempLine) {
        if (opt.e.shiftKey) { // กด Shift เพื่อวาดเส้นตรง
            let dx = Math.abs(pointer.x - tempLine.x1);
            let dy = Math.abs(pointer.y - tempLine.y1);
            if (dx > dy) pointer.y = tempLine.y1; else pointer.x = tempLine.x1;
        }
        tempLine.set({ x2: pointer.x, y2: pointer.y });
        canvas.renderAll();
    }
});

canvas.on('mouse:up', function(opt) {
    if (isPanning) {
        this.setViewportTransform(this.viewportTransform);
        isPanning = false;
        if(currentTool === 'select') this.selection = true;
    }
    
    if (isDrawingWall) {
        isDrawingWall = false;
        tempLine.setCoords();
        tempLine.set({ selectable: true, evented: true });
        
        // ลบถ้าจิ้มพลาดเส้นสั้นไป
        if (Math.abs(tempLine.x1 - tempLine.x2) < 5 && Math.abs(tempLine.y1 - tempLine.y2) < 5) {
            canvas.remove(tempLine);
        } else {
            canvas.setActiveObject(tempLine);
            document.querySelector('[data-tool="select"]').click();
        }
    }
});

// ซูมกระดาน
canvas.on('mouse:wheel', function(opt) {
    let delta = opt.e.deltaY;
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** delta;
    if (zoom > 5) zoom = 5;
    if (zoom < 0.1) zoom = 0.1;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    
    document.getElementById('zoomDisplay').innerText = `${Math.round(zoom * 100)}%`;
    document.getElementById('gridBg').style.backgroundSize = `${50 * zoom}px ${50 * zoom}px`;
    document.getElementById('gridBg').style.backgroundPosition = `${canvas.viewportTransform[4]}px ${canvas.viewportTransform[5]}px`;
    
    opt.e.preventDefault();
    opt.e.stopPropagation();
});

// --- 4. จัดการ Properties Panel ---
const propsPanel = document.getElementById('propsPanel');

function showProps() {
    const obj = canvas.getActiveObject();
    if(!obj) return;
    
    propsPanel.classList.add('active');
    document.getElementById('propX').value = Math.round(obj.left);
    document.getElementById('propY').value = Math.round(obj.top);
    document.getElementById('propW').value = Math.round(obj.width * obj.scaleX);
    document.getElementById('propH').value = Math.round(obj.height * obj.scaleY);
    document.getElementById('propA').value = Math.round(obj.angle);
}

canvas.on('selection:created', showProps);
canvas.on('selection:updated', showProps);
canvas.on('object:modified', showProps);
canvas.on('selection:cleared', () => { propsPanel.classList.remove('active'); });

// พิมพ์แก้ตัวเลขแล้วโมเดลเปลี่ยนตาม
document.querySelectorAll('#propsPanel input').forEach(input => {
    input.addEventListener('input', () => {
        const obj = canvas.getActiveObject();
        if(!obj) return;
        
        const newX = parseFloat(document.getElementById('propX').value) || 0;
        const newY = parseFloat(document.getElementById('propY').value) || 0;
        const newW = parseFloat(document.getElementById('propW').value) || 10;
        const newH = parseFloat(document.getElementById('propH').value) || 10;
        const newA = parseFloat(document.getElementById('propA').value) || 0;

        obj.set({
            left: newX, top: newY, angle: newA,
            width: newW / obj.scaleX, height: newH / obj.scaleY
        });
        obj.setCoords();
        canvas.requestRenderAll();
    });
});

// ปุ่มลบ
document.getElementById('btnDelete').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj) { canvas.remove(obj); propsPanel.classList.remove('active'); }
});

// ย่อขยายหน้าจอ
window.addEventListener('resize', () => {
    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
});
