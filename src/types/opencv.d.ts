declare module 'opencv.js' {
  export class Mat {
    data: Uint8Array;
    cols: number;
    rows: number;
    delete(): void;
    clone(): Mat;
  }

  export class MatVector {
    size(): number;
    delete(): void;
  }

  export class Point {
    x: number;
    y: number;
    constructor(x: number, y: number);
  }

  export class Size {
    width: number;
    height: number;
    constructor(width: number, height: number);
  }

  export interface Rect {
    angle: number;
  }

  export const COLOR_RGBA2GRAY: number;
  export const ADAPTIVE_THRESH_GAUSSIAN_C: number;
  export const THRESH_BINARY: number;

  export function matFromImageData(imageData: ImageData): Mat;
  export function cvtColor(src: Mat, dst: Mat, code: number): void;
  export function adaptiveThreshold(src: Mat, dst: Mat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): void;
  export function medianBlur(src: Mat, dst: Mat, ksize: number): void;
  export function findNonZero(src: Mat, dst: MatVector): void;
  export function minAreaRect(points: MatVector): Rect;
  export function getRotationMatrix2D(center: Point, angle: number, scale: number): Mat;
  export function warpAffine(src: Mat, dst: Mat, M: Mat, dsize: Size): void;
} 