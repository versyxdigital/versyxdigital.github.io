/* -------------------------- helpers -------------------------- */
const ric = window.requestIdleCallback || (fn => requestAnimationFrame(() => fn({ timeRemaining: () => 0 })));

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('image-connectors');
    if (!svg) return;
    
    // endpoints
    const targets = Array.from(document.querySelectorAll('.connector-target'));
    
    // ---- config ----
    const elbowRadius   = 60;
    const pxPerSec      = 400;
    const randomColors  = true;
    const EDGE_PROGRESS = 0.10;
    const EDGE_TIME_FRACTION = 0.05;
    
    // Keep SVG in *document* space (absolute at 0,0)
    svg.style.position = 'absolute';
    svg.style.left = '0px';
    svg.style.top  = '0px';
    svg.style.pointerEvents = 'none';
    svg.setAttribute('preserveAspectRatio', 'none');
    
    function sizeSvgToDocument() {
        const w = Math.max(
            document.documentElement.scrollWidth,
            document.documentElement.clientWidth,
            document.body?.scrollWidth || 0
        );
        const h = Math.max(
            document.documentElement.scrollHeight,
            document.documentElement.clientHeight,
            document.body?.scrollHeight || 0
        );
        svg.setAttribute('width',  String(w));
        svg.setAttribute('height', String(h));
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.style.width  = w + 'px';
        svg.style.height = h + 'px';
    }
    
    function randomColor() {
        const hue = (Math.random() * 360) | 0;
        return `hsl(${hue}, 80%, 60%)`;
    }
    
    async function waitForConnectorTargetsLoaded() {
        const imgs = targets.filter(el => el.tagName === 'IMG');
        if (!imgs.length) return;
        await Promise.allSettled(imgs.map(img => {
            if (img.complete && img.naturalWidth > 0) return;
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
        }));
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
        
        return `M${startX},${startY}L${startX},${v1Y}Q${startX},${hY} ${h1X},${hY}L${h2X},${hY}Q${endX},${hY} ${endX},${hY + rY}L${endX},${endY}`;
    }
    
    // cache of built connector elements
    const connectors = []; // { path, anim, pulseR, pulseA, from, to, lastD, lastLen }
    
    function ensureGlowFilter() {
        if (svg.querySelector('#glow-dot')) return;
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
    
    function buildOnce() {
        sizeSvgToDocument();
        ensureGlowFilter();
        
        for (let idx = 0; idx < targets.length - 1; idx++) {
            const from = targets[idx];
            const to   = targets[idx + 1];
            
            const r1 = from.getBoundingClientRect();
            const r2 = to.getBoundingClientRect();
            
            const startX = r1.left + r1.width / 2 + window.scrollX;
            const startY = r1.bottom + window.scrollY;
            const endX   = r2.left + r2.width / 2 + window.scrollX;
            const endY   = r2.top + window.scrollY;
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const id   = `connector-${idx}`;
            path.setAttribute('id', id);
            path.setAttribute('class', 'connector-line');
            
            const d = steppedRoundedPath(startX, startY, endX, endY, elbowRadius);
            path.setAttribute('d', d);
            svg.appendChild(path);
            
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('class', 'connector-dot');
            dot.setAttribute('r', '5');
            if (randomColors) dot.setAttribute('fill', randomColor());
            dot.setAttribute('filter', 'url(#glow-dot)');
            svg.appendChild(dot);
            
            const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
            anim.setAttribute('repeatCount', 'indefinite');
            anim.setAttribute('rotate', '0');
            anim.setAttribute('calcMode', 'spline');
            
            const kp0 = 0, kp1 = EDGE_PROGRESS, kp2 = 1 - EDGE_PROGRESS, kp3 = 1;
            const kt0 = 0, kt1 = EDGE_TIME_FRACTION, kt2 = 1 - EDGE_TIME_FRACTION, kt3 = 1;
            anim.setAttribute('keyPoints', `${kp0};${kp1};${kp2};${kp3}`);
            anim.setAttribute('keyTimes',  `${kt0};${kt1};${kt2};${kt3}`);
            anim.setAttribute('keySplines', ['0.1 0 0.9 1','0.25 0 0.75 1','0.1 0 0.9 1'].join(';'));
            
            const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
            mpath.setAttribute('href', `#${id}`);
            mpath.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',`#${id}`);
            anim.appendChild(mpath);
            dot.appendChild(anim);
            
            const len = path.getTotalLength();
            const duration = Math.max(0.8, len / pxPerSec) + 's';
            anim.setAttribute('dur', duration);
            
            const keyTimes   = '0;0.0;0.97;1';
            const keySplines = '0.2 0 0.6 1;0 0 1 1;0.3 0 1 1';
            
            const pulseR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseR.setAttribute('attributeName','r');
            pulseR.setAttribute('dur', duration);
            pulseR.setAttribute('repeatCount','indefinite');
            pulseR.setAttribute('calcMode','spline');
            pulseR.setAttribute('keyTimes', keyTimes);
            pulseR.setAttribute('keySplines', keySplines);
            pulseR.setAttribute('values', '5;5;5;6');
            dot.appendChild(pulseR);
            
            const pulseA = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseA.setAttribute('attributeName','fill-opacity');
            pulseA.setAttribute('dur', duration);
            pulseA.setAttribute('repeatCount','indefinite');
            pulseA.setAttribute('calcMode','spline');
            pulseA.setAttribute('keyTimes', keyTimes);
            pulseA.setAttribute('keySplines', keySplines);
            pulseA.setAttribute('values', '0.7;0.7;0.7;0.9');
            dot.appendChild(pulseA);
            
            connectors.push({ path, anim, pulseR, pulseA, from, to, lastD: d, lastLen: len });
        }
    }
    
    // rAF-throttled update; recompute only when geometry actually changes
    let rafPending = false;
    function updateAll() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            
            sizeSvgToDocument();
            
            for (let i = 0; i < connectors.length; i++) {
                const conn = connectors[i];
                const { path, anim, pulseR, pulseA, from, to } = conn;
                
                const r1 = from.getBoundingClientRect();
                const r2 = to.getBoundingClientRect();
                const startX = r1.left + r1.width / 2 + window.scrollX;
                const startY = r1.bottom + window.scrollY;
                const endX   = r2.left + r2.width / 2 + window.scrollX;
                const endY   = r2.top + window.scrollY;
                
                const d = steppedRoundedPath(startX, startY, endX, endY, elbowRadius);
                if (d === conn.lastD) continue; // no geometry change
                
                path.setAttribute('d', d);
                conn.lastD = d;
                
                // Only pay the cost of getTotalLength() when d changed
                const len = path.getTotalLength();
                if (!conn.lastLen || Math.abs(len - conn.lastLen) > 0.5) { // px threshold
                    conn.lastLen = len;
                    const dur = Math.max(0.8, len / pxPerSec) + 's';
                    if (anim.getAttribute('dur') !== dur) {
                        anim.setAttribute('dur', dur);
                        pulseR.setAttribute('dur', dur);
                        pulseA.setAttribute('dur', dur);
                    }
                }
            }
        });
    }
    
    // Resize observers
    const roTargets = new ResizeObserver(updateAll);
    targets.forEach(t => roTargets.observe(t));
    
    // Observe document/body size growth instead of a broad MutationObserver
    const roDoc = new ResizeObserver(updateAll);
    roDoc.observe(document.documentElement);
    roDoc.observe(document.body);
    
    window.addEventListener('resize', updateAll, { passive: true });
    window.addEventListener('orientationchange', updateAll, { passive: true });
    
    // Pause SVG SMIL animations when hidden or reduced-motion prefers
    function handleVisibilityOrMotion() {
        if (!svg.pauseAnimations || !svg.unpauseAnimations) return;
        if (document.hidden || prefersReducedMotion()) svg.pauseAnimations();
        else svg.unpauseAnimations();
    }
    document.addEventListener('visibilitychange', handleVisibilityOrMotion, { passive: true });
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        mq.addEventListener('change', handleVisibilityOrMotion);
    }
    
    waitForConnectorTargetsLoaded().then(() => {
        requestAnimationFrame(() => {
            buildOnce();
            updateAll();
            // run one more update when the browser is idle, after layout settles
            ric(() => { updateAll(); handleVisibilityOrMotion(); });
        });
    });
});



// -------------------- BINARY CANVAS --------------------
(() => {
    const root = document.getElementById('static-binary-grid');
    if (!root) return; // <— guard
    const canvas = root.querySelector('.binary-canvas');
    if (!canvas) return; // <— guard
    const ctx = canvas.getContext('2d', { alpha: true });
    
    // tunables unchanged...
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    
    let cols = 0, rows = 0;
    let cellW = 0, cellH = 0, ascent = 0;
    let buf;
    let rafId = 0;
    let lastMs = 0;
    let lastCanvasW = 0, lastCanvasH = 0; // <— track actual size to skip redundant work
    
    function measureFont() {
        const style = getComputedStyle(root);
        // keep your fixed 12px choice; if you want it responsive, swap 12px for style.fontSize
        const font = `${style.fontWeight} 12px / ${style.lineHeight} ${style.fontFamily}`;
        ctx.font = font;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        const m = ctx.measureText('M');
        const metrics = ctx.measureText('Hg');
        const emH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
        || parseFloat(style.lineHeight) || m.actualBoundingBoxAscent * 2 || 16;
        cellW = Math.ceil(m.width);
        cellH = Math.ceil(emH);
        ascent = metrics.actualBoundingBoxAscent || Math.ceil(emH * 0.8);
    }
    
    function resize() {
        const rect = root.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.max(1, Math.floor(rect.width  * dpr));
        const ch = Math.max(1, Math.floor(rect.height * dpr));
        
        // skip if no effective change
        if (cw === lastCanvasW && ch === lastCanvasH) return; // <— early exit
        lastCanvasW = cw; lastCanvasH = ch;
        
        canvas.width  = cw;
        canvas.height = ch;
        canvas.style.width  = `${Math.floor(rect.width)}px`;
        canvas.style.height = `${Math.floor(rect.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        measureFont();
        
        cols = Math.max(1, Math.floor(rect.width / (cellW * 2)));
        rows = Math.max(1, Math.floor(rect.height / cellH) + 1);
        
        buf = new Uint16Array(cols * rows);
        for (let i = 0; i < buf.length; i++) buf[i] = 65 + ((Math.random() * 26) | 0);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    function tick() {
        if (!buf) return;
        const flips = Math.max(100, Math.floor(cols * rows * 0.02));
        for (let i = 0; i < flips; i++) {
            const idx = (Math.random() * buf.length) | 0;
            buf[idx] = 65 + ((Math.random() * 26) | 0);
        }
    }
    
    function render(ms) {
        const t = ms * 0.003; // speed
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const chunkX = 8, chunkY = 2;
        ctx.fillStyle = getComputedStyle(root).color || 'rgba(255,255,255,1)';
        
        const base = 0.15, range = 0.80, gamma = 1.6;
        for (let r0 = 0; r0 < rows; r0 += chunkY) {
            const maxR = Math.min(rows, r0 + chunkY);
            for (let c0 = 0; c0 < cols; c0 += chunkX) {
                const digitCount = Math.min(chunkX, cols - c0);
                const phase = (c0 * 0.55 / chunkX) + (r0 * 0.55 / chunkY) + t;
                const u = (Math.sin(phase) + 1) * 0.5;
                const v = Math.pow(u, gamma);
                ctx.globalAlpha = base + range * v;
                
                for (let rr = r0; rr < maxR; rr++) {
                    const y = rr * cellH + ascent;
                    for (let cc = 0; cc < digitCount; cc++) {
                        const col = c0 + cc;
                        const idx = rr * cols + col;
                        const px = col * (cellW * 2);
                        ctx.fillText(String.fromCharCode(buf[idx]), px, y);
                    }
                }
            }
        }
        ctx.globalAlpha = 1;
    }
    
    function loop(ts) {
        // reduced-motion: render once, then idle
        if (prefersReducedMotion()) {
            if (!lastMs) render(ts);
            rafId = requestAnimationFrame(loop);
            return;
        }
        // tab hidden: skip work (visibility handler cancels anyway)
        if (document.hidden) {
            rafId = requestAnimationFrame(loop);
            return;
        }
        if (ts - lastMs >= frameInterval) {
            lastMs = ts;
            tick();
            render(ts);
        }
        rafId = requestAnimationFrame(loop);
    }
    
    let resizeTO;
    function onResize() {
        clearTimeout(resizeTO);
        resizeTO = setTimeout(() => {
            cancelAnimationFrame(rafId);
            resize();
            lastMs = 0;
            rafId = requestAnimationFrame(loop);
        }, 100);
    }
    
    addEventListener('resize', onResize, { passive: true });
    addEventListener('orientationchange', onResize, { passive: true });
    
    // pause/resume on tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(rafId);
        } else {
            lastMs = 0;
            rafId = requestAnimationFrame(loop);
        }
    }, { passive: true });
    
    // initial
    resize();
    rafId = requestAnimationFrame(loop);
})();
