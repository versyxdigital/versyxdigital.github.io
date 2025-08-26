document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('image-connectors');
    const targets = Array.from(document.querySelectorAll('.connector-target'));
    
    // --- configuration ---
    const elbowRadius = 60;      // max corner roundness
    const pxPerSec    = 400;     // base speed for each dot
    const randomColors = true;   // randomize each dot's color
    
    function randomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 80%, 60%)`;
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
    
    // Build once. Store references so we can update durations on resize without tearing down animations.
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
            
            // Base path
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
            
            // Motion with smoother snap: spline timing + keyPoints, no rotation
            // Smooth zip-through-bends: linear mid, ease only at ends
            const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
            anim.setAttribute('repeatCount', 'indefinite');
            anim.setAttribute('rotate', '0');          // avoid heading snaps at elbows
            anim.setAttribute('calcMode', 'spline');

            // Keying only at the ends.
            // 0–3%: ease-out from start
            // 3–97%: linear (zip through bends)
            // 97–100%: quick snap-in
            const keyTimes   = '0;0.03;0.97;1';
            const keySplines = [
            '0.2 0 0.6 1',  // start ease-out
            '0 0 1 1',      // linear mid (zip)
            '0.3 0 1 1'     // fast snap at end
            ].join(';');

            // Keep spatial progress aligned with temporal progress
            anim.setAttribute('keyTimes', keyTimes);
            anim.setAttribute('keySplines', keySplines);
            anim.setAttribute('keyPoints', '0;0.03;0.97;1');

            const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
            mpath.setAttribute('href', `#${pathId}`);
            mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`);
            anim.appendChild(mpath);
            dot.appendChild(anim);

            // Constant px/s
            const len = path.getTotalLength();
            const duration = Math.max(0.8, len / pxPerSec);
            anim.setAttribute('dur', `${duration}s`);

            // Subtle snap cue so it doesn’t read as a stutter
            const pulseR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseR.setAttribute('attributeName', 'r');
            pulseR.setAttribute('dur', `${duration}s`);
            pulseR.setAttribute('repeatCount', 'indefinite');
            pulseR.setAttribute('calcMode', 'spline');
            pulseR.setAttribute('keyTimes', keyTimes);
            pulseR.setAttribute('keySplines', keySplines);
            pulseR.setAttribute('values', '5;5;5;6'); // small pop at 100%
            dot.appendChild(pulseR);

            const pulseA = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            pulseA.setAttribute('attributeName', 'fill-opacity');
            pulseA.setAttribute('dur', `${duration}s`);
            pulseA.setAttribute('repeatCount', 'indefinite');
            pulseA.setAttribute('calcMode', 'spline');
            pulseA.setAttribute('keyTimes', keyTimes);
            pulseA.setAttribute('keySplines', keySplines);
            pulseA.setAttribute('values', '0.7;0.7;0.7;0.9');
            dot.appendChild(pulseA);
                        
            connectors.push({ path, anim, pulseR, pulseA });
        });
    }
    
    // Update geometry on resize without destroying nodes
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
                // No need to restart; updates take effect on the next cycle.
            });
        });
    }
    
    // Build and wire
    buildOnce();
    window.addEventListener('resize', updateOnResize);
    // No scroll handler: coordinates already include scroll offsets.
});