export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

const bottomMargin = 28;

export function computeBottomOverlayBounds(input: { displayWorkArea: Rectangle; overlaySize: Size }): Rectangle {
  const width = Math.min(input.overlaySize.width, input.displayWorkArea.width);
  const height = Math.min(input.overlaySize.height, input.displayWorkArea.height);
  const x = Math.round(input.displayWorkArea.x + (input.displayWorkArea.width - width) / 2);
  const y = Math.round(input.displayWorkArea.y + input.displayWorkArea.height - height - bottomMargin);

  return {
    x: clamp(x, input.displayWorkArea.x, input.displayWorkArea.x + input.displayWorkArea.width - width),
    y: clamp(y, input.displayWorkArea.y, input.displayWorkArea.y + input.displayWorkArea.height - height),
    width,
    height
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
