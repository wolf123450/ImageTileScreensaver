/**
 * Replace an image in a cell with a fade transition.
 * Shared by GridPattern and MosaicPattern.
 */
export function replaceImageInCell(
    cell: HTMLDivElement,
    imageUrls: string[],
    imageFitStyle: string,
): void {
    if (imageUrls.length === 0) return;

    const img = cell.querySelector('img') as HTMLImageElement | null;
    if (!img) return;

    const currentSrc = img.src;
    let newImageSrc = currentSrc;

    // Pick a different image
    let attempts = 0;
    while (newImageSrc === currentSrc && imageUrls.length > 1 && attempts < 10) {
        newImageSrc = imageUrls[Math.floor(Math.random() * imageUrls.length)];
        attempts++;
    }

    const newImg = document.createElement('img');
    newImg.src = newImageSrc;
    newImg.style.width = '100%';
    newImg.style.height = '100%';
    newImg.style.objectFit = imageFitStyle;
    newImg.style.opacity = '0';
    newImg.style.position = 'absolute';
    newImg.style.top = '0';
    newImg.style.left = '0';
    newImg.style.transition = 'opacity 0.5s ease-in-out';

    cell.appendChild(newImg);

    // Trigger reflow then fade in
    requestAnimationFrame(() => {
        newImg.style.opacity = '1';
    });

    // Remove old image after transition
    setTimeout(() => {
        img.style.opacity = '0';
        setTimeout(() => {
            if (img.parentNode === cell) {
                cell.removeChild(img);
            }
        }, 500);
    }, 0);
}
