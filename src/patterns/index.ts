export function generateGridPattern(rows: number, cols: number): number[][] {
    const pattern: number[][] = [];
    for (let i = 0; i < rows; i++) {
        const row: number[] = [];
        for (let j = 0; j < cols; j++) {
            row.push(i * cols + j);
        }
        pattern.push(row);
    }
    return pattern;
}

export function generateSpiralPattern(size: number): number[] {
    const pattern: number[] = [];
    const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    let row = 0, col = 0, dRow = 0, dCol = 1;

    for (let i = 0; i < size * size; i++) {
        pattern.push(row * size + col);
        visited[row][col] = true;

        if (visited[(row + dRow + size) % size][(col + dCol + size) % size]) {
            [dRow, dCol] = [dCol, -dRow]; // Change direction
        }

        row = (row + dRow + size) % size;
        col = (col + dCol + size) % size;
    }

    return pattern;
}

export function generateRandomPattern(count: number): number[] {
    const pattern: number[] = Array.from({ length: count }, (_, index) => index);
    for (let i = pattern.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pattern[i], pattern[j]] = [pattern[j], pattern[i]]; // Swap
    }
    return pattern;
}