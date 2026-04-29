const { ImageKit } = require('@imagekit/nodejs');

function getImageKitClient() {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('IMAGEKIT_PRIVATE_KEY environment variable is missing.');
    }

    return new ImageKit({
        privateKey,
    });
}

async function uploadFile(file) {
    const ImageKitClient = getImageKitClient();

    const result = await ImageKitClient.files.upload({
        file,
        fileName: "music_" + Date.now(),
        folder: "spotify-clone/music",
    });

    return result;
}

module.exports = { uploadFile }