const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
    title:{
        type:String,
        required:true,  
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    musics: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "music",
    }]
})

const albumModel = mongoose.model("album", albumSchema)
module.exports = albumModel