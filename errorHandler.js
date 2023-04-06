const { mongoose } = require("mongoose");

handleErr = (err, req, res, next) => {
    if (err.pokeErrCode) res.status(err.pokeErrCode).json({ err: err.message });
    else res.status(500).json({ err: err.message });

    console.log("###", err.message, "###");
};

module.exports = { handleErr };