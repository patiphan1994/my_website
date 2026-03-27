// ==========================================
// 3DNP CAD ENGINE (AutoCAD Mechanics)
// ==========================================

// --- 1. การตั้งค่าหน้ากระดาษ ---
const canvas = new fabric.Canvas('draftCanvas', {
    width: document.getElementById('canvas-wrapper').clientWidth,
    height: document.getElementById('canvas-wrapper').clientHeight,
    selection: true,
    preserveObjectStacking: true,
    fireRightClick: true, // เปิดใช้งานคลิกขวาแบบ AutoCAD
    stopContextMenu: true // ปิดเมนูคลิกขวาของเบราว์เซอร์
});
canvas.absolutePan({ x: -window.innerWidth/2, y: -window.innerHeight/2 });

// จำลองพื้นหลังตารางแบบจุด (Grid)
const gridPattern = new fabric.Pattern({
    source: function() {
        const patCanvas = document.createElement('canvas');
        patCanvas.width = 40; patCanvas.height = 40;
        const ctx = patCanvas.getContext('2d');
        ctx.fillStyle = '#D1D5DB';
        ctx.beginPath(); ctx.arc(20, 20, 1.5, 0, Math.PI * 2); ctx.fill();
        return patCanvas;
    }(),
    repeat: 'repeat'
});
canvas.backgroundColor = gridPattern;
canvas.renderAll();

// --- 2. ตัวแปรระบบ ---
let currentTool = 'select';
let isDrawing = false;
let activeLine = null; // เส้นที่กำลังลาก (Preview)
let isPanning = false;
let lastPosX, lastPosY;

// --- 3. จัดการ Toolbar สลับเครื่องมือ ---
const toolBtns = document.querySelectorAll('.floating-toolbar .tool-btn');
toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        toolBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.getAttribute('data-tool');
        
        // ยกเลิกคำสั่งเดิมก่อนเปลี่ยนเครื่องมือ
        endCADCommand();

        if(currentTool === 'pan') { 
            canvas.selection = false; canvas.defaultCursor = 'grab'; 
        } else if(currentTool === 'select') { 
            canvas.selection = true; canvas.defaultCursor = 'default'; 
        } else { 
            canvas.selection = false; canvas.defaultCursor = 'crosshair'; 
            canvas.discardActiveObject().renderAll(); 
        }
    });
});

// ฟังก์ชันจบคำสั่ง (เหมือนกด ESC ในแคด)
function endCADCommand() {
    if (isDrawing) {
        isDrawing = false;
        // ลบเส้นพรีวิวที่ยาว 0 ออก (เส้นติ่ง)
        if (activeLine && activeLine.x1 === activeLine.x2 && activeLine.y1 === activeLine.y2) {
            canvas.remove(activeLine);
        } else if (activeLine) {
            activeLine.set({ selectable: true, evented: true });
        }
        activeLine = null;
    }
}

// ผูกปุ่ม ESC บนคีย์บอร์ด
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        endCADCommand();
        // เด้งกลับไปที่เมาส์ Select
        document.querySelector('[data-tool="select"]').click();
    }
});

// --- 4. ENGINE การวาดสไตล์ AutoCAD ---
canvas.on('mouse:down', function(opt) {
    const evt = opt.e;
    
    // คลิกขวา (Right Click) = จบคำสั่งเหมือน AutoCAD
    if (evt.button === 2) {
        endCADCommand();
        document.querySelector('[data-tool="select"]').click();
        return;
    }

    // Pan กระดาน (กดลูกกลิ้ง หรือกด Alt ค้าง)
    if (currentTool === 'pan' || evt.button === 1 || evt.altKey) { 
        isPanning = true; 
        lastPosX = evt.clientX; lastPosY = evt.clientY;
        canvas.defaultCursor = 'grabbing';
        return;
    }

    const pointer = canvas.getPointer(opt.e);
    let x = pointer.x;
    let y = pointer.y;

    // การวาดกำแพง (ต่อเนื่องแบบ Polyline)
    if (currentTool === 'wall' || currentTool === 'line') {
        const thickness = currentTool === 'wall' ? 15 : 2;
        const color = currentTool === 'wall' ? '#111827' : '#4f46e5';

        if (!isDrawing) {
            // คลิกจุดที่ 1 (เริ่มวาด)
            isDrawing = true;
            activeLine = new fabric.Line([x, y, x, y], {
                strokeWidth: thickness, stroke: color, fill: color,
                strokeLineCap: 'square', originX: 'center', originY: 'center',
                selectable: false, evented: false
            });
            canvas.add(activeLine);
        } else {
            // คลิกจุดที่ 2 (วางเส้นแรก และเริ่มเส้นที่สองจากจุดเดิม)
            activeLine.set({ selectable: true, evented: true }); // ปลดล็อกเส้นเก่า
            activeLine.setCoords();
            
            // สร้างเส้นใหม่มาต่อตูดทันที
            activeLine = new fabric.Line([x, y, x, y], {
                strokeWidth: thickness, stroke: color, fill: color,
                strokeLineCap: 'square', originX: 'center', originY: 'center',
                selectable: false, evented: false
            });
            canvas.add(activeLine);
        }
    }
});

canvas.on('mouse:move', function(opt) {
    const pointer = canvas.getPointer(opt.e);
    let x = pointer.x;
    let y = pointer.y;

    // Pan กระดาน
    if (isPanning) {
        const vpt = this.viewportTransform;
        vpt[4] += opt.e.clientX - lastPosX; vpt[5] += opt.e.clientY - lastPosY;
        this.requestRenderAll(); 
        lastPosX = opt.e.clientX; lastPosY = opt.e.clientY;
        return;
    }

    // ลากเส้นตามเมาส์ (Preview)
    if (isDrawing && activeLine) {
        // ระบบ Ortho แบบ AutoCAD (กด Shift ล็อคแกน)
        if (opt.e.shiftKey) {
            let dx = Math.abs(x - activeLine.x1);
            let dy = Math.abs(y - activeLine.y1);
            if (dx > dy) { y = activeLine.y1; } else { x = activeLine.x1; }
        }
        activeLine.set({ x2: x, y2: y });
        canvas.renderAll();
    }
});

canvas.on('mouse:up', function(opt) {
    if (isPanning) {
        isPanning = false;
        if(currentTool === 'select') canvas.defaultCursor = 'default';
        else canvas.defaultCursor = 'crosshair';
    }
});

// --- 5. ระบบซูม (Scroll Wheel) ---
canvas.on('mouse:wheel', function(opt) {
    let zoom = canvas.getZoom();
    zoom *= 0.999 ** opt.e.deltaY;
    if (zoom > 10) zoom = 10; if (zoom < 0.05) zoom = 0.05;
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    opt.e.preventDefault(); opt.e.stopPropagation();
});

// --- 6. Resize ---
window.addEventListener('resize', () => {
    canvas.setWidth(document.getElementById('canvas-wrapper').clientWidth);
    canvas.setHeight(document.getElementById('canvas-wrapper').clientHeight);
});
