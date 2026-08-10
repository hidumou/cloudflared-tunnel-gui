const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'assets', 'icon.png');
const dest = path.join(__dirname, '..', 'assets', 'icon.ico');

(async () => {
  try {
    const image = await Jimp.read(src);
    const sizes = [256, 128, 64, 48, 32, 16];
    const buffers = await Promise.all(sizes.map(async (s) => {
      const clone = image.clone();
      clone.contain(s, s, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
      clone.resize(s, s);
      return await clone.getBufferAsync(Jimp.MIME_PNG);
    }));

    // `png-to-ico` v3 is ESM; import dynamically and use its default export if present
    const pngToIcoMod = await import('png-to-ico');
    const pngToIco = pngToIcoMod.default || pngToIcoMod;

    const icoBuffer = await pngToIco(buffers);
    fs.writeFileSync(dest, icoBuffer);
    console.log('Wrote', dest);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
