// --- 1. การตั้งค่าหน้ากระดาษ (Fabric.js) ---
const canvas = new fabric.Canvas('draftCanvas', {
    width: window.innerWidth,
    height: window.innerHeight,
    selection: true,
    preserveObjectStacking: true
});

canvas.absolutePan({ x: -window.innerWidth/2, y: -window.innerHeight/2 });

// --- 2. ตัวแปรสถานะเครื่องมือ ---
let currentTool = 'select';
let isDrawing = false;
let tempObj = null;

// --- 3. จัดการปุ่ม Toolbar ด้านซ้าย ---
const toolBtns = document.querySelectorAll('.tool-btn');
toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // อัปเดต UI ปุ่ม
        toolBtns.forEach(b => b.classList.remove('active'));
        const clickedBtn = e.currentTarget;
        clickedBtn.classList.add('active');
        
        // เซ็ตเครื่องมือปัจจุบัน
        currentTool = clickedBtn.getAttribute('data-tool');
        
        // จัดการสถานะเคอร์เซอร์เมาส์บนกระดาน
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

// --- 4. ตรรกะการวาดลงกระดาน (เมาส์ทำงาน) ---
canvas.on('mouse:down', function(opt) {
    if (currentTool === 'pan' || opt.e.altKey) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = opt.e.clientX;
        this.lastPosY = opt.e.clientY;
    }
    
    // โค้ดทดสอบ: กดวาดห้อง (Room) ทันทีที่คลิก
    if (currentTool === 'room') {
        const pointer = canvas.getPointer(opt.e);
        const rect = new fabric.Rect({
            left: pointer.x, top: pointer.y, width: 200, height: 150,
            fill: 'rgba(79, 70, 229, 0.1)', stroke: '#4f46e5', strokeWidth: 2,
            originX: 'center', originY: 'center'
        });
        canvas.add(rect);
        // วาดเสร็จเด้งกลับไปหน้า Select อัตโนมัติ
        document.querySelector('[data-tool="select"]').click();
        canvas.setActiveObject(rect);
    }
});

canvas.on('mouse:move', function(opt) {
    // ระบบแสดงพิกัดเมาส์ด้านล่าง
    const pointer = canvas.getPointer(opt.e);
    document.getElementById('coordsDisplay').innerText = `X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`;

    // ระบบ Pan กระดาน
    if (this.isDragging) {
        var e = opt.e;
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
        document.getElementById('gridBg').style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
    }
});

canvas.on('mouse:up', function(opt) {
    this.setViewportTransform(this.viewportTransform);
    this.isDragging = false;
    if(currentTool === 'select') this.selection = true;
});

// ระบบ Zoom กระดาน
canvas.on('mouse:wheel', function(opt) {
    var delta = opt.e.deltaY;
    var zoom = canvas.getZoom();
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

// --- 5. จัดการหน้าต่าง Properties ขวามือ ---
const propsPanel = document.getElementById('propsPanel');

canvas.on('selection:created', showProps);
canvas.on('selection:updated', showProps);
canvas.on('object:modified', showProps);
canvas.on('selection:cleared', () => { propsPanel.classList.remove('active'); });

function showProps() {
    const obj = canvas.getActiveObject();
    if(!obj) return;
    
    // เปิดแผงควบคุม
    propsPanel.classList.add('active');
    
    // ดึงค่ามาใส่ช่อง Input
    document.getElementById('propX').value = Math.round(obj.left);
    document.getElementById('propY').value = Math.round(obj.top);
    document.getElementById('propW').value = Math.round(obj.width * obj.scaleX);
    document.getElementById('propH').value = Math.round(obj.height * obj.scaleY);
    document.getElementById('propA').value = Math.round(obj.angle);
}

// อัปเดตวัตถุเมื่อพิมพ์แก้ตัวเลข
document.querySelectorAll('#propsPanel input').forEach(input => {
    input.addEventListener('change', () => {
        const obj = canvas.getActiveObject();
        if(!obj) return;
        
        obj.set({
            left: parseFloat(document.getElementById('propX').value),
            top: parseFloat(document.getElementById('propY').value),
            angle: parseFloat(document.getElementById('propA').value),
            width: parseFloat(document.getElementById('propW').value) / obj.scaleX,
            height: parseFloat(document.getElementById('propH').value) / obj.scaleY
        });
        obj.setCoords();
        canvas.requestRenderAll();
    });
});

// ปุ่ม Delete
document.getElementById('btnDelete').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if(obj) {
        canvas.remove(obj);
        propsPanel.classList.remove('active');
    }
});

// จัดการขนาดจอ
window.addEventListener('resize', () => {
    canvas.setWidth(window.innerWidth);
    canvas.setHeight(window.innerHeight);
});
