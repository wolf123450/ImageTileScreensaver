import { describe, it, expect } from 'vitest';
import { replaceImageInCell } from './image-utils';

describe('replaceImageInCell', () => {
  it('does nothing with empty image array', () => {
    const cell = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'existing.jpg';
    cell.appendChild(img);

    replaceImageInCell(cell, [], 'cover');
    // Should still have just the original image
    expect(cell.querySelectorAll('img').length).toBe(1);
  });

  it('does nothing if cell has no img', () => {
    const cell = document.createElement('div');
    replaceImageInCell(cell, ['new.jpg'], 'cover');
    expect(cell.querySelectorAll('img').length).toBe(0);
  });

  it('adds a new image element to the cell', () => {
    const cell = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'old.jpg';
    cell.appendChild(img);

    replaceImageInCell(cell, ['new1.jpg', 'new2.jpg'], 'contain');

    const images = cell.querySelectorAll('img');
    expect(images.length).toBe(2); // old + new
    const newImg = images[1];
    expect(newImg.style.objectFit).toBe('contain');
    expect(newImg.style.position).toBe('absolute');
  });

  it('picks a different image when multiple available', () => {
    const cell = document.createElement('div');
    const img = document.createElement('img');
    img.src = 'http://localhost/only.jpg';
    cell.appendChild(img);

    replaceImageInCell(cell, ['http://localhost/only.jpg', 'http://localhost/other.jpg'], 'cover');

    const newImg = cell.querySelectorAll('img')[1];
    expect(newImg.src).toBe('http://localhost/other.jpg');
  });
});
