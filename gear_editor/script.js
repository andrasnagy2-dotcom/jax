document.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const sidebar = document.getElementById('sidebar');

    if (!sidebar) {
        console.error("Gear editor HTML elements not found. Stopping script.");
        return;
    }

    canvas.width = window.innerWidth - sidebar.offsetWidth;
    canvas.height = window.innerHeight;

    let gears = [];
    let selectedGear = null;
    let isDragging = false;
    let dragStartX, dragStartY;

    function createGear(x, y, diameter, teeth) {
        return {
            x,
            y,
            diameter,
            teeth,
            rotation: 0,
            speed: 0,
            connectedTo: null,
        };
    }

    function drawGear(gear) {
        const { x, y, teeth, diameter, rotation } = gear;
        const pressureAngle = 20 * Math.PI / 180;

        const module = diameter / teeth;
        const pitchRadius = diameter / 2;
        const baseRadius = pitchRadius * Math.cos(pressureAngle);
        const addendumRadius = pitchRadius + module;
        const dedendumRadius = pitchRadius - 1.25 * module;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.beginPath();

        function getInvolutePoint(baseRadius, angle) {
            const x = baseRadius * (Math.cos(angle) + angle * Math.sin(angle));
            const y = baseRadius * (Math.sin(angle) - angle * Math.cos(angle));
            return { x, y };
        }

        const maxInvoluteAngle = Math.sqrt(Math.pow(addendumRadius / baseRadius, 2) - 1);

        const halfToothThicknessAngle = (Math.PI / (2 * teeth));
        const invAlpha = Math.tan(pressureAngle) - pressureAngle;
        const baseAngleOffset = halfToothThicknessAngle + invAlpha;

        const startAngleOnRoot = -baseAngleOffset;
        ctx.moveTo(dedendumRadius * Math.cos(startAngleOnRoot), dedendumRadius * Math.sin(startAngleOnRoot));

        for (let i = 0; i < teeth; i++) {
            const toothAngle = (i / teeth) * 2 * Math.PI;

            const startOfToothAngle = toothAngle - baseAngleOffset;
            const endOfToothAngle = toothAngle + baseAngleOffset;
            const startOfNextToothAngle = toothAngle + (2 * Math.PI / teeth) - baseAngleOffset;

            const involuteStartPoint = getInvolutePoint(baseRadius, 0);
            let p_x = involuteStartPoint.x * Math.cos(startOfToothAngle) - involuteStartPoint.y * Math.sin(startOfToothAngle);
            let p_y = involuteStartPoint.x * Math.sin(startOfToothAngle) + involuteStartPoint.y * Math.cos(startOfToothAngle);
            ctx.lineTo(p_x, p_y);

            for (let angle = 0.05; angle <= maxInvoluteAngle; angle += 0.05) {
                const point = getInvolutePoint(baseRadius, angle);
                p_x = point.x * Math.cos(startOfToothAngle) - point.y * Math.sin(startOfToothAngle);
                p_y = point.x * Math.sin(startOfToothAngle) + point.y * Math.cos(startOfToothAngle);
                ctx.lineTo(p_x, p_y);
            }

            const lastInvolutePoint = getInvolutePoint(baseRadius, maxInvoluteAngle);
            const topArcStartAngle = startOfToothAngle + Math.atan2(lastInvolutePoint.y, lastInvolutePoint.x);
            const topArcEndAngle = endOfToothAngle - Math.atan2(lastInvolutePoint.y, lastInvolutePoint.x);
            ctx.arc(0, 0, addendumRadius, topArcStartAngle, topArcEndAngle, false);

            for (let angle = maxInvoluteAngle; angle >= 0; angle -= 0.05) {
                const point = getInvolutePoint(baseRadius, angle);
                p_x = point.x * Math.cos(endOfToothAngle) - (-point.y) * Math.sin(endOfToothAngle);
                p_y = point.x * Math.sin(endOfToothAngle) + (-point.y) * Math.cos(endOfToothAngle);
                ctx.lineTo(p_x, p_y);
            }

            ctx.arc(0, 0, dedendumRadius, endOfToothAngle, startOfNextToothAngle, false);
        }

        ctx.closePath();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(addendumRadius - module / 2, 0, module / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    function update() {
        if (document.getElementById('animate').checked) {
            gears.forEach(gear => {
                if (gear.connectedTo) {
                    const driver = gear.connectedTo;
                    const baseRotation = -driver.rotation * (driver.teeth / gear.teeth);
                    const phaseShift = Math.PI / gear.teeth;
                    gear.rotation = baseRotation + phaseShift;
                } else {
                    gear.rotation += 0.01;
                }
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        gears.forEach(drawGear);
    }

    function animate() {
        update();
        draw();
        requestAnimationFrame(animate);
    }

    function init() {
        const gear1 = createGear(canvas.width / 2 - 75, canvas.height / 2, 100, 20);

        const gear2Teeth = 10;
        const gear2Diameter = 50;

        const radius1 = gear1.diameter / 2;
        const radius2 = gear2Diameter / 2;
        const distance = radius1 + radius2;
        const gear2X = gear1.x + distance;

        const gear2 = createGear(gear2X, canvas.height / 2, gear2Diameter, gear2Teeth);
        gear2.connectedTo = gear1;

        gears.push(gear1, gear2);
        selectedGear = gear1;
        updateUI();
        animate();
    }

    function updateUI() {
        if (selectedGear) {
            document.getElementById('teeth').value = selectedGear.teeth;
            document.getElementById('diameter').value = selectedGear.diameter;
        }
    }

    document.getElementById('teeth').addEventListener('input', (e) => {
        if (selectedGear) {
            selectedGear.teeth = parseInt(e.target.value, 10);
        }
    });

    document.getElementById('diameter').addEventListener('input', (e) => {
        if (selectedGear) {
            selectedGear.diameter = parseInt(e.target.value, 10);
            gears.forEach(g => {
                if (g.connectedTo === selectedGear) {
                    const radius1 = selectedGear.diameter / 2;
                    const radius2 = g.diameter / 2;
                    const distance = radius1 + radius2;
                    g.x = selectedGear.x + distance;
                }
            });
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        for (let i = gears.length - 1; i >= 0; i--) {
            const gear = gears[i];
            const dx = mouseX - gear.x;
            const dy = mouseY - gear.y;
            if (Math.sqrt(dx * dx + dy * dy) < gear.diameter / 2) {
                selectedGear = gear;
                isDragging = true;
                dragStartX = mouseX - gear.x;
                dragStartY = mouseY - gear.y;
                updateUI();
                return;
            }
        }
        selectedGear = null;
        isDragging = false;
        updateUI();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectedGear) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            selectedGear.x = mouseX - dragStartX;
            selectedGear.y = mouseY - dragStartY;
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.getElementById('export-svg').addEventListener('click', () => {
        const svgData = exportSVG();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        downloadLink.download = 'gears.svg';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });

    function exportSVG() {
        let svgString = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
        gears.forEach(gear => {
            const { x, y, teeth, diameter, rotation } = gear;
            const pressureAngle = 20 * Math.PI / 180;
            const module = diameter / teeth;
            const pitchRadius = diameter / 2;
            const baseRadius = pitchRadius * Math.cos(pressureAngle);
            const addendumRadius = pitchRadius + module;
            const dedendumRadius = pitchRadius - 1.25 * module;

            function getInvolutePoint(baseRadius, angle) {
                const x = baseRadius * (Math.cos(angle) + angle * Math.sin(angle));
                const y = baseRadius * (Math.sin(angle) - angle * Math.cos(angle));
                return { x, y };
            }

            const maxInvoluteAngle = Math.sqrt(Math.pow(addendumRadius / baseRadius, 2) - 1);
            let pathData = '';
            for (let i = 0; i < teeth; i++) {
                const toothAngle = (i / teeth) * 2 * Math.PI;
                const s = Math.sin(toothAngle);
                const c = Math.cos(toothAngle);
                const halfToothThicknessAngle = (Math.PI / (2 * teeth));
                const invAlpha = Math.tan(pressureAngle) - pressureAngle;
                const baseAngleOffset = halfToothThicknessAngle + invAlpha;
                let points = [];
                for (let angle = 0; angle <= maxInvoluteAngle; angle += 0.05) {
                    points.push(getInvolutePoint(baseRadius, angle));
                }
                points.forEach((p, index) => {
                    const rotatedX = p.x * Math.cos(-baseAngleOffset) - p.y * Math.sin(-baseAngleOffset);
                    const rotatedY = p.x * Math.sin(-baseAngleOffset) + p.y * Math.cos(-baseAngleOffset);
                    const finalX = rotatedX * c - rotatedY * s;
                    const finalY = rotatedX * s + rotatedY * c;
                    if (pathData === '') pathData += `M ${finalX} ${finalY} `;
                    else pathData += `L ${finalX} ${finalY} `;
                });
                const lastPoint = points[points.length - 1];
                const rotatedX = lastPoint.x * Math.cos(-baseAngleOffset) - lastPoint.y * Math.sin(-baseAngleOffset);
                pathData += `A ${addendumRadius} ${addendumRadius} 0 0 1 `;
                points.reverse().forEach(p => {
                    const rotatedX = p.x * Math.cos(baseAngleOffset) - (-p.y) * Math.sin(baseAngleOffset);
                    const rotatedY = p.x * Math.sin(baseAngleOffset) + (-p.y) * Math.cos(baseAngleOffset);
                    const finalX = rotatedX * c - rotatedY * s;
                    const finalY = rotatedX * s + rotatedY * c;
                    pathData += `L ${finalX} ${finalY} `;
                });
                const nextToothAngle = ((i + 1) / teeth) * 2 * Math.PI;
                const s_next = Math.sin(nextToothAngle);
                const c_next = Math.cos(nextToothAngle);
                const p_next = getInvolutePoint(baseRadius, 0);
                const rotatedX_next = p_next.x * Math.cos(-baseAngleOffset) - p_next.y * Math.sin(-baseAngleOffset);
                const rotatedY_next = p_next.x * Math.sin(-baseAngleOffset) + p_next.y * Math.cos(-baseAngleOffset);
                const finalX_next = rotatedX_next * c_next - rotatedY_next * s_next;
                const finalY_next = rotatedX_next * s_next + rotatedY_next * c_next;
                pathData += `A ${dedendumRadius} ${dedendumRadius} 0 0 0 ${finalX_next} ${finalY_next} `;
            }
            svgString += `<g transform="translate(${x}, ${y}) rotate(${rotation * 180 / Math.PI})">`;
            svgString += `<path d="${pathData} Z" fill="none" stroke="#333" stroke-width="1"/>`;
            svgString += `<circle cx="${addendumRadius - module / 2}" cy="0" r="${module / 4}" fill="red" />`;
            svgString += `<circle cx="0" cy="0" r="8" fill="white" stroke="#333" stroke-width="1" />`;
            svgString += `</g>`;
        });
        svgString += `</svg>`;
        return svgString;
    }

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth - sidebar.offsetWidth;
        canvas.height = window.innerHeight;
    });

    init();
});
