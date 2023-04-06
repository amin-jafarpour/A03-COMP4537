const express = require("express");
const { asyncWrapper } = require("./asyncWrapper.js");
const dotenv = require("dotenv");
dotenv.config();
const userModel = require("./userModel.js");
const monitorModel = require("./monitorModel.js");
const { connectDB } = require("./connectDB.js");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
app.use(
    cors({
        exposedHeaders: ["auth-token-access", "auth-token-refresh"],
    })
);
const mongoose = require("mongoose");
const { populatePokemons } = require("./populatePokemons.js"); //use it*
const { getTypes } = require("./getTypes.js");
const { handleErr } = require("./errorHandler.js");
const morgan = require("morgan");
const util = require("./util.js");
/*


    */

const port = process.env.PORT || 8000;


// app.listen(process.env.authServerPORT, async(err) => {
//     if (err) throw new PokemonDbError(err);
//     else
//         console.log(
//             `Phew! Server is running on port: ${port}`
//         );
// });

const {
    PokemonBadRequest,
    PokemonBadRequestMissingID,
    PokemonBadRequestMissingAfter,
    PokemonDbError,
    PokemonNotFoundError,
    PokemonDuplicateError,
    PokemonNoSuchRouteError,
    PokemonAuthError,
} = require("./errors.js");

let pokeModel = null;

const start = asyncWrapper(async() => {
    console.log({ REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET, ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET, DB_STRING: process.env.DB_STRING })
    await connectDB({ drop: false });
    const doc = await userModel.findOne({ username: "admin" });
    if (!doc)
        await userModel.create({
            username: "admin",
            password: bcrypt.hashSync("admin", 10),
            role: "admin",
            email: "admin@admin.ca",
        });

    await connectDB({ drop: false });
    let pokeSchema = await getTypes();
    // await populatePokemons(pokeSchema)

    pokeModel = mongoose.model("pokemons", pokeSchema);

    app.listen(process.env.authServerPORT, async(err) => {
        if (err) throw new PokemonDbError(err);
        else
            console.log(
                `Phew! Server is running on port: ${port}`
            );
    });
});

start();
/////////////////////////////////
async function topUsersForEachEndpoint() {
    let query = {};
    try {
        query = await monitorModel
            .aggregate([{
                    $group: {
                        _id: { endpoint: "$endpoint", username: "$username" },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        "_id.endpoint": 1,
                        count: -1,
                    },
                },
                {
                    $group: {
                        _id: "$_id.endpoint",
                        usernames: {
                            $push: { username: "$_id.username", count: "$count" },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        endpoint: "$_id",
                        usernames: {
                            $slice: ["$usernames", 10],
                        },
                    },
                },
            ])
            .exec();
    } catch (err) {
        console.error(err.message);
        return {};
    }

    return query;
}

async function topUsersAfter(afterDay, beforeDay) {
    //afterDay format yyyy-mm-dd
    let query = {};
    try {
        query = await monitorModel
            .aggregate([{
                $match: {
                    timeStamp: {
                        $gte: util.convertToDate(afterDay),
                        $lte: util.convertToDate(beforeDay)
                    },
                },
            }, {
                $group: {
                    _id: "$username",
                    count: { $sum: 1 },
                },
            }, {
                $project: {
                    _id: 0,
                    username: "$_id",
                    count: 1,
                },
            }, ])
            .exec();
    } catch (err) {
        console.error(err.message);
        return {};
    }

    return query;
}

async function endpointError() {
    let query = {};
    try {
        query = await monitorModel
            .aggregate([{
                    $group: {
                        _id: { endpoint: "$endpoint", errorType: "$errorType" },
                        count: { $sum: 1 },
                    },
                },

                {
                    $group: {
                        _id: "$_id.endpoint",
                        errorTypes: { $push: "$_id.errorType" },
                    },
                },

                {
                    $project: {
                        _id: 0,
                        endpoint: "$_id",
                        errorTypes: { $setUnion: "$errorTypes" },
                    },
                },
            ])
            .exec();
    } catch (err) {
        console.error(err.message);
        return {};
    }

    return query;
}

async function errorsAfter(afterDay, beforeDay) {
    let query = {};
    try {
        query = await monitorModel.aggregate([{
                $match: {
                    timeStamp: {
                        $gte: util.convertToDate(afterDay),
                        $lte: util.convertToDate(beforeDay)
                    }
                }
            },
            {
                $group: {
                    _id: "$errorType",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    errorType: "$_id"
                }
            }
        ])

    } catch (err) {
        console.error(err.message);
        return {};
    }

    return query;
}

//////////////////////////





app.post(
    "/register",
    asyncWrapper(async(req, res) => {
        const { password, username, email, role } = req.body;
        if (!(password && username && email)) {
            throw new PokemonAuthError(
                "username, password, and email are required to register a new user"
            );
        }
        const existingUser = await userModel.find({ username: username });
        if (existingUser.length !== 0) {
            throw new PokemonAuthError(`${username} already exists`);
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const userWithHashedPassword = {
            username,
            email,
            role,
            password: hashedPassword,
        };

        const user = await userModel.create(userWithHashedPassword);
        res.json({ msg: `${username} has been registered` });
    })
);

app.post(
    "/login",
    asyncWrapper(async(req, res) => {
        const { username, password } = req.body;
        if (!(password && username)) {
            throw new PokemonAuthError(
                "password and username are required to log in"
            );
        }
        const user = await userModel.findOne({ username });
        if (!user) {
            throw new PokemonAuthError(`user ${username} does not exist`);
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            throw new PokemonAuthError("incorrect password");
        }

        const accessToken = jwt.sign({
                username: user.username,
                rand: Math.floor(Math.random() * 1000000000),
            },
            process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2 days" }
        );
        const refreshToken = jwt.sign({ username: user.username, rand: Math.floor(Math.random() * 1000000000) },
            process.env.REFRESH_TOKEN_SECRET
        );
        await userModel.findOneAndUpdate({ username }, {
            authTokenRefresh: { token: refreshToken, valid: true },
            authTokenAccess: { token: accessToken, valid: true },
        });
        res.header("auth-token-access", accessToken);
        res.header("auth-token-refresh", refreshToken);
        res.json({
            "auth-token-access": accessToken,
            "auth-token-refresh": refreshToken,
        });
    })
);

app.post(
    "/requestNewAccessToken",
    asyncWrapper(async(req, res) => {
        const refreshToken = req.header("auth-token-refresh");
        const accessToken = req.header("auth-token-access");
        if (!refreshToken) {
            throw new PokemonAuthError("refresh token required");
        }
        if (!accessToken) {
            throw new PokemonAuthError("access token required");
        }
        let decoded = null;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            throw new PokemonAuthError("invalid refresh token or tampered payload");
        }
        const user = await userModel.findOne({ username: decoded.username });
        if (!user) {
            throw new PokemonAuthError(
                "username token mismatch /requestNewAccessToke"
            );
        }
        if (!(
                user.authTokenRefresh.valid &&
                user.authTokenRefresh.token === refreshToken
            )) {
            throw new PokemonAuthError("invalid or expired refresh token");
        }
        let newAccessToken = jwt.sign({ username: user.username, rand: Math.floor(Math.random() * 1000000000) },
            process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2 days" }
        );
        await userModel.findOneAndUpdate({ username: user.username }, {
            authTokenAccess: { token: newAccessToken, valid: true },
        });

        res.header("auth-token-access", newAccessToken);
        res.json({
            "auth-token-access": newAccessToken,
            isAdmin: user.role === "admin",
        });
    })
);

app.get(
    "/logout",
    asyncWrapper(async(req, res) => {
        const refreshToken = req.header("auth-token-refresh");
        const accessToken = req.header("auth-token-access");
        if (!refreshToken) {
            throw new PokemonAuthError("refresh token required");
        }
        if (!accessToken) {
            throw new PokemonAuthError("access token required");
        }

        let decoded = null;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            throw new PokemonAuthError("invalid refresh token or tampered payload");
        }
        const user = await userModel.findOne({ username: decoded.username });
        if (!user) {
            throw new PokemonAuthError("username token mismatch /logout");
        }
        if (!(
                user.authTokenRefresh.valid &&
                user.authTokenRefresh.token === refreshToken
            )) {
            throw new PokemonAuthError("invalid or expired refresh token");
        }

        await userModel.findOneAndUpdate({ username: decoded.username }, {
            authTokenRefresh: { token: "", valid: false },
            authTokenAccess: { token: "", valid: false },
        });

        res.json({
            msg: "Logged out",
        });
    })
);

/*

 */

app.use(morgan(":method"));

const authUser = asyncWrapper(async(req, res, next) => {
    const accessToken = req.header("auth-token-access");

    if (!accessToken) {
        let record = {
            //^ISSUE
            timeStamp: new Date(),
            username: "",
            endpoint: req.originalUrl,
            errorType: 400,
        };
        await monitorModel.create(record);
        throw new PokemonAuthError(
            "No Token: Please provide the access token using the headers."
        );
    }

    let decoded = null;
    try {
        decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
        let record = {
            //^ISSUE
            timeStamp: new Date(),
            username: "",
            endpoint: req.originalUrl,
            errorType: 404,
        };
        await monitorModel.create(record);
        throw new PokemonAuthError("invalid access token or tampered payload");
    }
    const user = await userModel.findOne({ username: decoded.username });
    if (!user) {
        throw new PokemonAuthError("username token mismatch authUser func");
    }
    if (!(user.authTokenAccess.valid && user.authTokenAccess.token === accessToken)) {
        let record = {
            //^ISSUE
            timeStamp: new Date(),
            username: decoded.username,
            endpoint: req.originalUrl,
            errorType: 401,
        };
        await monitorModel.create(record);
        throw new PokemonAuthError("Invalid or expired access token.");
    }

    let record = {
        //^ISSUE
        timeStamp: new Date(),
        username: decoded.username,
        endpoint: req.originalUrl,
        errorType: 200,
    };
    await monitorModel.create(record);

    next();
});

const authAdmin = asyncWrapper(async(req, res, next) => {
    const payload = jwt.verify(
        req.header("auth-token-access"),
        process.env.ACCESS_TOKEN_SECRET
    );
    if (payload && payload.username) {
        const admin = await userModel.findOne({ username: payload.username });
        if (admin && admin.role === "admin") {
            return next();
        } else if (admin && admin.role !== "admin") {
            //^ISSUE
            let record = {
                timeStamp: new Date(),
                username: admin.username,
                endpoint: req.originalUrl,
                errorType: 403,
            };
            await monitorModel.create(record);
        }
    }

    throw new PokemonAuthError("Access denied");
});

app.use(authUser); // Boom! All routes below this line are protected

app.post("/api/v1/selection/pokemons", async(req, res) => {
    let { count, after, selection } = req.body;
    let query = {};
    if (!selection) {
        selection = {};
    }
    try {
        query = await pokeModel.find(selection);
    } catch (err) {
        console.log(err.message);
    }
    res.json(query);
});

app.get(
    "/api/v1/pokemons",
    asyncWrapper(async(req, res) => {
        if (!req.query["count"]) req.query["count"] = 10;
        if (!req.query["after"]) req.query["after"] = 0;

        const docs = await pokeModel
            .find({})
            .sort({ id: 1 })
            .skip(req.query["after"])
            .limit(req.query["count"]);
        res.json(docs);
    })
);

app.get(
    "/api/v1/pokemon",
    asyncWrapper(async(req, res) => {
        const { id } = req.query;
        const docs = await pokeModel.find({ id: id }); //danger *
        if (docs.length != 0) res.json(docs); //danger*
        else res.json({ errMsg: "Pokemon not found" });
    })
);

app.use(authAdmin);
app.post(
    "/api/v1/pokemon/",
    asyncWrapper(async(req, res) => {
        if (!req.body.id) throw new PokemonBadRequestMissingID();
        const poke = await pokeModel.find({ id: req.body.id });
        if (poke.length != 0) throw new PokemonDuplicateError();
        const pokeDoc = await pokeModel.create(req.body);
        res.json({
            msg: "Added Successfully",
        });
    })
);

app.delete(
    "/api/v1/pokemon",
    asyncWrapper(async(req, res) => {
        const docs = await pokeModel.findOneAndRemove({ id: req.query.id });
        if (docs)
            res.json({
                msg: "Deleted Successfully",
            });
        else throw new PokemonNotFoundError("");
    })
);

app.put(
    "/api/v1/pokemon/:id",
    asyncWrapper(async(req, res) => {
        const selection = { id: req.params.id };
        const update = req.body;
        const options = {
            new: true,
            runValidators: true,
            overwrite: true,
        };
        const doc = await pokeModel.findOneAndUpdate(selection, update, options);

        if (doc) {
            res.json({
                msg: "Updated Successfully",
                pokeInfo: doc,
            });
        } else {
            throw new PokemonNotFoundError("");
        }
    })
);

app.patch(
    "/api/v1/pokemon/:id",
    asyncWrapper(async(req, res) => {
        const selection = { id: req.params.id };
        const update = req.body;
        const options = {
            new: true,
            runValidators: true,
        };
        const doc = await pokeModel.findOneAndUpdate(selection, update, options);
        if (doc) {
            res.json({
                msg: "Updated Successfully",
                pokeInfo: doc,
            });
        } else {
            throw new PokemonNotFoundError("");
        }
    })
);

// topUsersForEachEndpoint()
// topUsersAfter(afterDay)
// endpointError()
// errorsAfter(afterDay)



app.post("/report", async(req, res) => {

    const { reportType, beforeDay, afterDay } = req.body;
    let query = {}
    if (reportType === 'topUsersForEachEndpoint') {
        query = await topUsersForEachEndpoint()
    } else if (reportType === 'topUsersAfter') {
        query = await topUsersAfter(afterDay, beforeDay)
    } else if (reportType === 'endpointError') {
        query = await endpointError()
    } else {
        query = await errorsAfter(afterDay, beforeDay)
    }

    res.json(query);
});


app.use(handleErr);