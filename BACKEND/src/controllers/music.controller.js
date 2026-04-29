const musicModel = require("../models/music.model")
const albumModel = require("../models/album.model")
const { uploadFile } = require("../services/storage.service")

async function createMusic(req, res) {
    const decoded = req.user

    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    if (decoded.role !== "artist") {
        return res.status(403).json({ message: "You don't have access to create the music" })
    }

    const { title } = req.body
    const file = req.file

    if (!file) {
        return res.status(400).json({
            message: "Music file is required"
        })
    }

    const result = await uploadFile(file.buffer.toString("base64"))

    const music = new musicModel({
        url: result.url,
        title,
        artist: decoded.id
    })

    await music.save()

    res.status(201).json({
        message: "Music created successfully",
        music: {
            id: music._id,
            title: music.title,
            url: music.url,
            artist: music.artist
        }
    })
}

async function createAlbum(req, res) {
    const decoded = req.user

    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    if (decoded.role !== "artist") {
        return res.status(403).json({ message: "You don't have access to create the album" })
    }

    const { title, musics } = req.body

    if (!title) {
        return res.status(400).json({
            message: "Album title is required"
        })
    }

    const album = new albumModel({
        title,
        artist: decoded.id,
        musics: musics || []
    })

    await album.save()

    res.status(201).json({
        message: "Album created successfully",
        album: {
            id: album._id,
            title: album.title,
            artist: album.artist,
            musics: album.musics
        }
    })
}

async function getAllMusics(req, res) {
    const musics = await musicModel
        .find()
        .populate("artist", "username email")

    res.status(200).json({
        message: "Musics fetched successfully",
        musics: musics,
    })
}

async function getAllAlbums(req, res) {
    const albums = await albumModel
        .find()
        .select("title artist")
        .populate("artist", "username email")

    res.status(200).json({
        message: "Albums fetched successfully",
        albums: albums,
    })
}

async function getAlbumById(req, res) {
    const albumId = req.params.albumId

    const album = await albumModel
        .findById(albumId)
        .populate("artist", "username email")
        .populate("musics")

    if (!album) {
        return res.status(404).json({ message: "Album not found" })
    }

    return res.status(200).json({
        message: "Album fetched successfully",
        album: album,
    })
}

module.exports = { createMusic, createAlbum, getAllMusics, getAllAlbums, getAlbumById }