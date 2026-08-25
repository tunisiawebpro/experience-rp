const pointsLayer = document.querySelector(".floating-points");

if (pointsLayer) {
    const pointCount = 42;

    for (let index = 0; index < pointCount; index += 1) {
        const point = document.createElement("span");
        const size = Math.random() * 2.8 + 1.8;
        const duration = Math.random() * 12 + 18;
        const delay = Math.random() * -18;
        const drift = Math.random() * 90 - 45;

        point.className = "floating-point";
        point.style.left = `${Math.random() * 100}%`;
        point.style.width = `${size}px`;
        point.style.height = `${size}px`;
        point.style.setProperty("--point-duration", `${duration}s`);
        point.style.setProperty("--point-delay", `${delay}s`);
        point.style.setProperty("--point-drift", `${drift}px`);
        point.style.setProperty("--point-opacity", `${Math.random() * 0.22 + 0.58}`);

        pointsLayer.appendChild(point);
    }
}
