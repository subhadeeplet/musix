const mongoose = require('mongoose');


const musicSchema = new mongoose.Schema({
    url:{
        type:String,
        required:true,
    },
    title:{
        type:String,
        required:true,
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
})

const musicModel = mongoose.model("music", musicSchema)
module.exports = musicModel