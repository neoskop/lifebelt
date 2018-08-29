const imageToAscii = require("image-to-ascii");

imageToAscii("logo.png", {
    stringify: false,
    pixels: " .,:;i1tfLCG08@#",
    colored: false,
    white_bg: false,
    size: {
        width: 50
    }
}, (err, converted) => {
    console.log(err || converted);
});