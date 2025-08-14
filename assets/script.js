document.addEventListener("DOMContentLoaded", () => {
    if (window.particlesJS) {
        particlesJS.load("particles-js", "assets/particles-2.json", function () {
            console.log("particles.js config loaded");
        });
    }

    const quotesEl = document.getElementById("quote");
    if (quotesEl) {
        const quotes = [
            "Simplicity is the ultimate sophistication.",
            "What you seek is seeking you.",
            "Do what you can, with what you have, where you are.",
            "In the middle of difficulty lies opportunity.",
            "Act as if what you do makes a difference. It does.",
            "Not all those who wander are lost.",
            "Happiness depends upon ourselves."
        ];
        quotesEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    }

    document.addEventListener('click', function (e) {
        const img = e.target.closest('img[data-bs-target="#imageModal"]');
        if (!img) return;
        const modalImg = document.getElementById('imageModalImg');
        if (modalImg) {
            modalImg.src = img.getAttribute('data-full') || img.src;
            modalImg.alt = img.alt || '';
        }
    });
});
