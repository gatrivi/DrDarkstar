export class AssetLoader {
  constructor() {
    this.images = new Map();
  }

  async image(name, src) {
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      await image.decode();
      this.images.set(name, image);
      return image;
    } catch {
      return null;
    }
  }

  get(name) {
    return this.images.get(name) ?? null;
  }
}
