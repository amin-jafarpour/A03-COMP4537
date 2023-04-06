const mongoose = require("mongoose")
const https = require('https');
const ProgressBar = require('progress');

// const pokemonSchema = new mongoose.Schema({
//     id: { type: Number, unique: true, required: true },
//     name: {
//         type: Object,
//         required: true,
//         validate: {
//             validator: names => names != undefined && names.english.length <= 20,
//             message: names => `${names.english} English name must be at mox 20 chars long`
//         }
//     },
//     base: {
//         type: Object
//     },
//     type: {
//         type: [String],
//         enum: ["Normal",
//             "Fire",
//             "Water",
//             "Grass",
//             "Electric",
//             "Ice",
//             "Fighting",
//             "Poison",
//             "Ground",
//             "Flying",
//             "Psychic",
//             "Bug",
//             "Rock",
//             "Ghost",
//             "Dark",
//             "Dragon",
//             "Steel",
//             "Fairy"
//         ]

//     }
// });


// const pokeSchema = new mongoose.Schema({
//     "id": {
//         type: Number,
//         unique: [true, "You cannot have two pokemons with the same id"]
//     },
//     "name": {
//         "english": {
//             type: String,
//             required: true,
//             maxLength: [20, "Name should be less than 20 characters long"]
//         },
//         "japanese": String,
//         "chinese": String,
//         "french": String
//     },
//     "type": [String], /////////////////////*******fetch type dynacmically */
//     "base": {
//         "HP": Number,
//         "Attack": Number,
//         "Defense": Number,
//         'Speed Attack': Number,
//         'Speed Defense': Number,
//         "Speed": Number
//     }
// })




//const populatePokemons = (pokeSchema)
const populatePokemons = (schema) => {
    return new Promise((resolve, reject) => {
        pokeModel = mongoose.model('pokemons', schema); // unicorns is the name of the collection in db
        https.get("https://raw.githubusercontent.com/fanzeyi/pokemon.json/master/pokedex.json", function(res) {
            var chunks = "";
            res.on("data", (chunk) => {
                chunks += chunk;
            });
            res.on("end", async() => {
                const arr = JSON.parse(chunks);
                var bar = new ProgressBar('## inserting :pokeName [:bar]  :percent :etas ', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: arr.length
                });
                Promise.all(arr.map(element => {
                        return new Promise((resolve, reject) => {
                            element["base"]["Speed Attack"] = element["base"]["Sp. Attack"];
                            delete element["base"]["Sp. Attack"];
                            element["base"]["Speed Defense"] = element["base"]["Sp. Defense"];
                            delete element["base"]["Sp. Defense"];
                            pokeModel.findOneAndUpdate(element, {}, { upsert: true, new: true }, async(err, result) => {
                                if (err) console.log(err);
                                setTimeout(() => {
                                    bar.tick({ "pokeName": element.name.english });
                                    resolve();
                                }, Math.random() * 2000);
                            });
                        })
                    })).then(() => {
                        resolve(pokeModel)
                    })
                    .catch(err => reject(err)) //rm
            });
        })
    })
}


module.exports = { populatePokemons }