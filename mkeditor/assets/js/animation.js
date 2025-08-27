document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('image-connectors');
    const targets = Array.from(document.querySelectorAll('.connector-target'));
    
    // ---- config ----
    const elbowRadius = 60;     // corner roundness cap
    const pxPerSec    = 400;    // constant base duration
    const randomColors = true;  // random dot color per connector
    
    // Speed profile knobs
    const EDGE_PROGRESS  = 0.10;  // how much of the path to "zip" at each end
    const EDGE_TIME_FRACTION = 0.05; // how much of the time to spend on each end zip
    
    function randomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 60%)`;
    }
    
    // Wait until all connector-target <img> elements are fully loaded/decoded
    async function waitForConnectorTargetsLoaded() {
        const imgs = targets.filter(el => el.tagName === 'IMG');
        if (imgs.length === 0) return Promise.resolve(); // nothing to wait for
        
        const promises = imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            if (typeof img.decode === 'function') {
                return img.decode().catch(() => new Promise(res => {
                    img.addEventListener('load', res, { once: true });
                    img.addEventListener('error', res, { once: true });
                }));
            }
            return new Promise(res => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
            });
        });
        
        await Promise.allSettled(promises);
    }
    
    function steppedRoundedPath(startX, startY, endX, endY, radius = 40) {
        const dx = Math.abs(endX - startX);
        const dy = Math.abs(endY - startY);
        const rX = Math.min(radius, dx / 2);
        const rY = Math.min(radius, dy / 2);
        
        const midY = startY + (endY - startY) / 2;
        const v1Y  = midY - rY;
        const hY   = midY;
        const goingRight = endX > startX;
        const h1X  = goingRight ? startX + rX : startX - rX;
        const h2X  = goingRight ? endX - rX   : endX + rX;
        
        return `
            M${startX},${startY}
            L${startX},${v1Y}
            Q${startX},${hY} ${h1X},${hY}
            L${h2X},${hY}
            Q${endX},${hY} ${endX},${hY + rY}
            L${endX},${endY}
        `;
    }
    
    // Build once, store refs for efficient updates on resize
    const connectors = []; // { path, anim, pulseR, pulseA }
    
    function buildOnce() {
        // Size SVG to document
        const docWidth  = document.documentElement.scrollWidth;
        const docHeight = document.documentElement.scrollHeight;
        svg.setAttribute('width',  docWidth);
        svg.setAttribute('height', docHeight);
        svg.setAttribute('viewBox', `0 0 ${docWidth} ${docHeight}`);
        svg.style.width  = docWidth + 'px';
        svg.style.height = docHeight + 'px';
        
        targets.forEach((el, idx) => {
            if (idx === targets.length - 1) return;
            
            const rect1 = el.getBoundingClientRect();
            const rect2 = targets[idx + 1].getBoundingClientRect();
            
            const startX = rect1.left + rect1.width / 2 + window.scrollX;
            const startY = rect1.bottom + window.scrollY;
            const endX   = rect2.left + rect2.width / 2 + window.scrollX;
            const endY   = rect2.top + window.scrollY;
            
            const d = steppedRoundedPath(startX, startY, endX, endY, elbowRadius);
            
            // Base connector path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const pathId = `connector-${idx}`;
            path.setAttribute('id', pathId);
            path.setAttribute('class', 'connector-line');
            path.setAttribute('d', d);
            svg.appendChild(path);
            
            // Glowing dot
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('class', 'connector-dot');
            dot.setAttribute('r', '5');
            if (randomColors) dot.setAttribute('fill', randomColor());
            svg.appendChild(dot);
            
            // AnimateMotion: "zip–slow–zip"
            const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
            anim.setAttribute('repeatCount', 'indefinite');
            anim.setAttribute('rotate', '0');          // avoid heading snaps at elbows
            anim.setAttribute('calcMode', 'spline');
            
            // --- New timing profile ---
            // Fast at start/end: spend small time to traverse large distance.
            // Slow in middle: spend most of the time on the middle portion.
            const kp0 = 0;
            const kp1 = EDGE_PROGRESS;          // e.g. 0.25
            const kp2 = 1 - EDGE_PROGRESS;      // e.g. 0.75
            const kp3 = 1;
            
            const kt0 = 0;
            const kt1 = EDGE_TIME_FRACTION;     // e.g. 0.06
            const kt2 = 1 - EDGE_TIME_FRACTION; // e.g. 0.94
            const kt3 = 1;
            
            // Map: time -> distance along path
            anim.setAttribute('keyPoints', `${kp0};${kp1};${kp2};${kp3}`);
            anim.setAttribute('keyTimes',  `${kt0};${kt1};${kt2};${kt3}`);
            
            // Easing per segment (cubic-bezier x1 y1 x2 y2):
            // 1) Snappy ease-out for launch, 2) gentle for middle cruise, 3) snappy ease-in for arrival.
            const keySplines = [
                '0.1 0 0.9 1',   // fast then settle
                '0.25 0 0.75 1', // smooth/neutral in the slow middle
                '0.1 0 0.9 1'    // settle into target quickly
            ].join(';');
            anim.setAttribute('keySplines', keySplines);
            // --------------------------
            
            const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
            mpath.setAttribute('href', `#${pathId}`);
            mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`);
            anim.appendChild(mpath);
            dot.appendChild(anim);
            
            // Duration from path length (base speed); profile above redistributes that time
            const len = path.getTotalLength();
            const duration = Math.max(0.8, len / pxPerSec);
            anim.setAttribute('dur', `${duration}s`);
            
            // Subtle snap cue at the end (unchanged)
            let keyTimes   = '0;0.0;0.97;1';
            const pulseR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseR.setAttribute('attributeName', 'r');
            pulseR.setAttribute('dur', `${duration}s`);
            pulseR.setAttribute('repeatCount', 'indefinite');
            pulseR.setAttribute('calcMode', 'spline');
            pulseR.setAttribute('keyTimes', keyTimes);
            pulseR.setAttribute('keySplines', '0.2 0 0.6 1;0 0 1 1;0.3 0 1 1');
            pulseR.setAttribute('values', '5;5;5;6');
            dot.appendChild(pulseR);
            
            const pulseA = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseA.setAttribute('attributeName', 'fill-opacity');
            pulseA.setAttribute('dur', `${duration}s`);
            pulseA.setAttribute('repeatCount', 'indefinite');
            pulseA.setAttribute('calcMode', 'spline');
            pulseA.setAttribute('keyTimes', keyTimes);
            pulseA.setAttribute('keySplines', '0.2 0 0.6 1;0 0 1 1;0.3 0 1 1');
            pulseA.setAttribute('values', '0.7;0.7;0.7;0.9');
            dot.appendChild(pulseA);
            
            connectors.push({ path, anim, pulseR, pulseA });
        });
    }
    
    // Resize: update only geometry/durations (keep animations intact)
    let rafPending = false;
    function updateOnResize() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            
            const docWidth  = document.documentElement.scrollWidth;
            const docHeight = document.documentElement.scrollHeight;
            svg.setAttribute('width',  docWidth);
            svg.setAttribute('height', docHeight);
            svg.setAttribute('viewBox', `0 0 ${docWidth} ${docHeight}`);
            svg.style.width  = docWidth + 'px';
            svg.style.height = docHeight + 'px';
            
            connectors.forEach((conn, idx) => {
                if (idx >= targets.length - 1) return;
                
                const rect1 = targets[idx].getBoundingClientRect();
                const rect2 = targets[idx + 1].getBoundingClientRect();
                
                const startX = rect1.left + rect1.width / 2 + window.scrollX;
                const startY = rect1.bottom + window.scrollY;
                const endX   = rect2.left + rect2.width / 2 + window.scrollX;
                const endY   = rect2.top + window.scrollY;
                
                const d = steppedRoundedPath(startX, startY, endX, endY, elbowRadius);
                conn.path.setAttribute('d', d);
                
                const len = conn.path.getTotalLength();
                const duration = Math.max(0.8, len / pxPerSec);
                conn.anim.setAttribute('dur', `${duration}s`);
                conn.pulseR.setAttribute('dur', `${duration}s`);
                conn.pulseA.setAttribute('dur', `${duration}s`);
            });
        });
    }
    
    // Initialize after all connector-target images are ready
    waitForConnectorTargetsLoaded().then(() => {
        // Ensure SVG has a glow filter (once)
        if (!svg.querySelector('#glow-dot')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.id = 'glow-dot';
            filter.setAttribute('x', '-50%');
            filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%');
            filter.setAttribute('height', '200%');
            const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            blur.setAttribute('in', 'SourceGraphic');
            blur.setAttribute('stdDeviation', '3');
            blur.setAttribute('result', 'blur');
            const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
            const node  = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
            node.setAttribute('in', 'blur');
            merge.appendChild(node);
            filter.appendChild(blur);
            filter.appendChild(merge);
            defs.appendChild(filter);
            svg.appendChild(defs);
        }
        
        buildOnce();
        window.addEventListener('resize', updateOnResize);
        // No scroll handler: coordinates already include scroll offsets.
    });
});

(() => {
    const el = document.querySelector('#static-binary-grid .binary-layer');
    const root = document.getElementById('static-binary-grid');

    function measureCell() {
        const probe = document.createElement('span');
        probe.textContent = '0';
        probe.style.visibility = 'hidden';
        probe.style.position = 'absolute';
        probe.style.font = getComputedStyle(el).font;
        document.body.appendChild(probe);
        const rect = probe.getBoundingClientRect();
        probe.remove();
        return { cw: rect.width, ch: parseFloat(getComputedStyle(el).lineHeight) || rect.height };
    }

    let cols = 0, rows = 0, buf = [];
    function resize() {
        const { cw, ch } = measureCell();
        const pad = 16;
        const width = root.clientWidth + pad;
        const height = root.clientHeight;

        const digitCols = Math.max(1, Math.floor(width / cw / 2));
        const digitRows = Math.max(1, Math.floor(height / ch) + 1);

        if (digitCols === cols && digitRows === rows) return;
        cols = digitCols; rows = digitRows;

        buf = new Array(rows);
        for (let r = 0; r < rows; r++) {
            const line = new Array(cols * 2 - 1);
            for (let c = 0; c < cols; c++) {
                line[c * 2] = Math.random() < 0.5 ? '0' : '1';
                if (c < cols - 1) line[c * 2 + 1] = ' ';
            }
            buf[r] = line;
        }
        render(0);
    }

    // Sinusoidal wave modifier
    function render(time) {
        const waveSpeed = 0.002; // smaller = slower waves
        const waveChunk = 6;     // chunk size (rows per phase step)
        let html = "";
        for (let r = 0; r < rows; r++) {
            // Compute opacity factor for this row (sinusoidal wave)
            const wave = Math.sin((r / waveChunk) + time * waveSpeed);
            const opacity = 0.05 + 1 * (wave + 1) / 2; // range ~0.3–0.65
            const rowStr = buf[r].join('');
            html += `<span style="opacity:${opacity.toFixed(2)}">${rowStr}</span>\n`;
        }
        el.innerHTML = html;
    }

    function tick() {
        if (!buf.length) return;
        const flipsPerFrame = Math.max(100, Math.floor(cols * rows * 0.02));
        for (let i = 0; i < flipsPerFrame; i++) {
            const r = (Math.random() * rows) | 0;
            const c = (Math.random() * cols) | 0;
            const idx = c * 2;
            const cur = buf[r][idx];
            buf[r][idx] = cur === '0' ? '1' : '0';
        }
    }

    let last = 0;
    function loop(ts) {
        if (ts - last > 22) { // ~45 fps cap
            tick();
            render(ts);
            last = ts;
        }
        raf = requestAnimationFrame(loop);
    }
    let raf = requestAnimationFrame(loop);

    let resizeTO;
    const onResize = () => {
        clearTimeout(resizeTO);
        resizeTO = setTimeout(resize, 50);
    };
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);

    resize();
})();
