const mongoose = require('mongoose');

const monitorSchema = new mongoose.Schema({
    timeStamp: {
        type: Date,
        required: true
    },
    username: {
        type: String,
        required: false
    },
    endpoint: {
        type: String,
        required: true
    },
    errorType: {
        type: Number,
        required: true
    }
});

const Monitor = mongoose.model('Monitor', monitorSchema);

module.exports = Monitor;