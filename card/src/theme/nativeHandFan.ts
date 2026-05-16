export type NativeHandFanPlatform = string;

export type NativeHandFanMetrics = {
  cardWidth: number;
  cardHeight: number;
  renderScale: number;
  maxAngle: number;
  centerScale: number;
  edgeScale: number;
  viewportPad: number;
  viewportHeight: number;
  stripAboveFan: number;
  stripHeight: number;
};

const BASE_CARD_WIDTH = 100;
const BASE_CARD_HEIGHT = 140;
const STRIP_ABOVE_FAN = 24;

export function getNativeHandFanMetrics(platform: NativeHandFanPlatform): NativeHandFanMetrics {
  const isAndroid = platform === 'android';
  const renderScale = isAndroid ? 0.88 : 1;
  const cardWidth = Math.round(BASE_CARD_WIDTH * renderScale);
  const cardHeight = Math.round(BASE_CARD_HEIGHT * renderScale);
  const centerScale = isAndroid ? 1.1 : 1.15;
  const edgeScale = isAndroid ? 0.78 : 0.82;
  const maxAngle = isAndroid ? 26 : 30;
  const viewportPad = isAndroid ? 52 : 55;
  const viewportHeight = Math.ceil(cardHeight * centerScale + viewportPad - 100);

  return {
    cardWidth,
    cardHeight,
    renderScale,
    maxAngle,
    centerScale,
    edgeScale,
    viewportPad,
    viewportHeight,
    stripAboveFan: STRIP_ABOVE_FAN,
    stripHeight: viewportHeight + STRIP_ABOVE_FAN,
  };
}
