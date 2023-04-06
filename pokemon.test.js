const supertest = require("supertest");
// const { appAuth } = require("./auth");
// const { pokeServer } = require("./appServer");
const userModel = require("./userModel.js");
const { app } = require('./server.js');
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { getTypes } = require("./getTypes.js")
const jwt = require("jsonwebtoken");
const { connectDB } = require("./connectDB.js");
dotenv.config();
// const authServer = supertest(appAuth);
// const appServer = supertest(pokeServer);
const authServer = supertest(app);
const appServer = supertest(app);
let n = Math.floor(Math.random() * 100000);
describe("/register", () => {
    test("Testing New user creation", async() => {
        // await connectDB({ "drop": false }); //kill*********************
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        let res = await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            msg: `coco${n} has been registered`,
        });
        // jest.setTimeout(300000) //5min wait
    });

    test("Testing existing user creation", async() => {
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };
        let res = await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            err: `Poke API Error - Authentication Error: ${payload.username} already exists`
        });
    });

    test("Testing missing fields user creation", async() => {
        let payload = {
            username: `coco${n}`,
        };
        let res = await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: username, password, and email are required to register a new user",
        });
    });

    //res.text
    //JSON.parse()
    //res.header
    jest.setTimeout(300000); //5min wait
});
///////////////////////////////////////////////
describe("/login", () => {
    test("testing login missing fields", async() => {
        let payload = {
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: password and username are required to log in",
        });
    });

    test("Testing login invalid username", async() => {
        let payload = {
            username: `invalidUsername`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            err: `Poke API Error - Authentication Error: user ${payload.username} does not exist`,
        });
    });

    test("Testing login invalid password", async() => {
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "invalidPassword",
        };

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: incorrect password",
        });
    });

    test("Testing login valid credentials: token headers existence", async() => {
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        expect(res.headers["auth-token-refresh"]).toBeTruthy();
        expect(res.headers["auth-token-access"]).toBeTruthy();
    });

    test("Testing refresh token added to DB account after successful login", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
        let refreshToken = res.headers["auth-token-refresh"]
        const user = await userModel.findOne({ username: payload.username });
        expect(user).toBeTruthy();
        expect(user.authTokenRefresh).toStrictEqual({ token: refreshToken, valid: true });
    });

    jest.setTimeout(300000);
});

describe("/requestNewAccessToken", () => {
    test("Testing requestNewAccessToken missing refresh token header field throws a PokemonAuthError", async() => {
        let res = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "...")
            .send({});

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: refresh token required",
        });
    });

    test("Testing requestNewAccessToken missing access token header field", async() => {
        let res = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", "...")
            .send({});

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: access token required",
        });
    });

    test("Testing requestNewAccessToken invalid refresh token throws a PokemonAuthError", async() => {
        let res = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", "invalidAccessToken")
            .set("auth-token-access", "...")
            .send({});

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid refresh token or tampered payload",
        });
    });

    test("Testing requestNewAccessToken valid refresh token", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        res = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send({});

        let newAccessToken = res.headers["auth-token-access"];
        let newRefreshToken = res.headers["auth-token-refresh"];

        expect(newAccessToken).toBeTruthy();
    });

    test("Testing requestNewAccessToken returns new access token", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        let res2 = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send({});

        let newAccessToken = res2.headers["auth-token-access"];
        expect(newAccessToken).not.toBe(accessToken);
    });
});

describe("/logout", () => {
    test("Testing logout missing refresh token header field", async() => {
        let res = await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "...")
            .send();

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: refresh token required",
        });
    });

    test("Testing logout missing access token header field", async() => {
        let res = await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", "...")
            .send();

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: access token required",
        });
    });

    test("Testing logout invalid refresh token", async() => {
        let res = await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", "invalidAccessToken")
            .set("auth-token-access", "...")
            .send();

        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid refresh token or tampered payload",
        });
    });

    test("Testing logout valid refresh token", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        res = await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        expect(JSON.parse(res.text)).toStrictEqual({
            msg: "Logged out",
        });
    });

    test("Testing logout and requestNewAccessToken expired refresh token: token expire after logout", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        res = await authServer
            .post(`/requestNewAccessToken`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send({});
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid or expired refresh token",
        });
    });


    test("Testing logout refresh token removed fron DB account", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        const user = await userModel.findOne({ username: payload.username });
        expect(user).toBeTruthy();
        expect(user.authTokenRefresh).toStrictEqual({ token: "", valid: false });
    });
});

describe("user protected resources: routes accessible only by logged users", () => {
    test("testing user route '/api/v1/pokemons' with missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get("/api/v1/pokemons")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing user route '/api/v1/pokemons' with invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get("/api/v1/pokemons")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });


    test("testing user route '/api/v1/pokemons' with valid access token", async() => {
        const { accessToken } = await setup();
        let res = await appServer
            .get("/api/v1/pokemons?after=0&count=20")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        let pokeData = JSON.parse(res.text);
        expect(pokeData.length).toBe(20);
    });

    test("testing user route '/api/v1/pokemons' with an expired access token throws a PokemonAuthError", async() => {
        const { refreshToken, accessToken } = await setup();

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .get("/api/v1/pokemons?after=0&count=20")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });

    test("testing user route '/api/v1/pokemons' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup();
        let res = await appServer
            .get("/api/v1/pokemons?after=0&count=20")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });

    let pokemonID = 15;
    test("testing user route '/api/v1/pokemon?id=n' with missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing user route /api/v1/pokemon?id=n' with invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });


    test("testing user route /api/v1/pokemon?id=n' with valid access token", async() => {
        const { accessToken } = await setup();
        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        let pokeData = JSON.parse(res.text);
        expect(pokeData).toBeTruthy();
        expect(Array.isArray(pokeData)).toBe(true);
        expect(pokeData.length).toBe(1);
        expect(pokeData[0].name.english).toBe("Beedrill"); // poke ID 15 English name is Beedrill
    });

    test("testing user route /api/v1/pokemon?id=n' with an expired access token throws a PokemonAuthError", async() => {
        const { refreshToken, accessToken } = await setup();

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });

    test("testing user route '/api/v1/pokemon?id=n' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup();
        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
});


describe("admin protected resources: routes accessible by logged admins", () => {

    let pokeID = 2000;

    test("testing admin route POST '/api/v1/pokemon/' missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing admin route POST '/api/v1/pokemon/' invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });

    test("testing admin route POST '/api/v1/pokemon/' valid access token", async() => {
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        const { accessToken } = await setup(true);
        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                }
            });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ msg: "Added Successfully" });
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
    });

    test("testing admin route POST '/api/v1/pokemon/' expired access token ", async() => {
        const { refreshToken, accessToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });


    test("testing admin route POST '/api/v1/pokemon/' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup(true);
        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
    /////////////////////DELETE
    test("testing admin route DELETE '/api/v1/pokemon/?id=n' missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing admin route DELETE '/api/v1/pokemon/?id=n' invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });

    test("testing admin route DELETE '/api/v1/pokemon/?id=n' valid access token", async() => {
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
            id: pokeID,
            name: { english: "fasty" },
            "type": [
                "Bug",
                "Poison"
            ],
            "base": {
                "HP": 45,
                "Attack": 25,
                "Defense": 50,
                "Sp. Attack": 25,
                "Sp. Defense": 25,
                "Speed": 35
            }
        }); //$$$
        const { accessToken } = await setup(true);
        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({
            msg: "Deleted Successfully"
        });
        await pokeModel.remove({ id: pokeID }); //$$$
    });

    test("testing admin route DELETE '/api/v1/pokemon/?id=n' expired access token ", async() => {
        const { refreshToken, accessToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });


    test("testing admin route DELETE '/api/v1/pokemon/?id=n' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup(true);
        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
    //////////////////////////////////////////////PUT
    test("testing admin route PUT '/api/v1/pokemon/:id' missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing admin route PUT '/api/v1/pokemon/:id' invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });

    test("testing admin route PUT '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken } = await setup(true);
        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        delete jsonRes.pokeInfo.__v;
        delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({
            pokeInfo: pokeData,
            msg: "Updated Successfully"
        });
        await pokeModel.remove({ id: pokeID }); //$$$
    });

    test("testing admin route PUT '/api/v1/pokemon/:id' expired access token ", async() => {
        const { refreshToken, accessToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });


    test("testing admin route PUT '/api/v1/pokemon/:id' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup(true);
        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
    ////////////////////////////////////////////////////////////PATCH
    test("testing admin route PATCH '/api/v1/pokemon/:id' missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing admin route PATCH '/api/v1/pokemon/:id' invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });

    test("testing admin route PATCH '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken } = await setup(true);
        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        delete jsonRes.pokeInfo.__v;
        delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({
            pokeInfo: pokeData,
            msg: "Updated Successfully"
        });
        await pokeModel.remove({ id: pokeID }); //$$$
    });

    test("testing admin route PATCH '/api/v1/pokemon/:id' expired access token ", async() => {
        const { refreshToken, accessToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });


    test("testing admin route PATCH '/api/v1/pokemon/:id' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup(true);
        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send({ datadummy: "..." });
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
    //////////////////////////////GET reports

    test("testing admin route GET '/report?id=n' missing access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: No Token: Please provide the access token using the headers."
        });
    });

    test("testing admin route GET '/report?id=n' invalid access token throws a PokemonAuthError", async() => {
        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", "invalidAccessToken")
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: "Poke API Error - Authentication Error: invalid access token or tampered payload"
        });
    });

    test("testing admin route GET '/report?id=n' valid access token", async() => {
        const { accessToken } = await setup(true);
        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({ msg: 'Table 1' });

    });

    test("testing admin route GET '/report?id=n' expired access token ", async() => {
        const { refreshToken, accessToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: Invalid or expired access token.'
        })
    });


    test("testing admin route GET '/report?id=n' cannnot be accessed by a refresh token", async() => {
        const { refreshToken } = await setup(true);
        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", refreshToken) //refresh token instead of access token
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({
            err: 'Poke API Error - Authentication Error: invalid access token or tampered payload'
        })
    });
    //end
});


describe("Testing users cannot access admin endpoints", () => {
    let pokeID = 2000;
    test("testing users cannot access GET '/report?id=n' valid access token", async() => {
        const { accessToken } = await setup(); //user not admin
        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({ err: "Poke API Error - Authentication Error: Access denied" });

    });

    test("testing users cannot access PATCH '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken } = await setup(); //user not admin
        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        // delete jsonRes.pokeInfo.__v;
        // delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({ err: "Poke API Error - Authentication Error: Access denied" });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access PUT '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken } = await setup(); //user not admin
        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        // delete jsonRes.pokeInfo.__v;
        // delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({ err: "Poke API Error - Authentication Error: Access denied" });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access DELETE '/api/v1/pokemon/?id=n' valid access token", async() => {
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
            id: pokeID,
            name: { english: "fasty" },
            "type": [
                "Bug",
                "Poison"
            ],
            "base": {
                "HP": 45,
                "Attack": 25,
                "Defense": 50,
                "Sp. Attack": 25,
                "Sp. Defense": 25,
                "Speed": 35
            }
        }); //$$$
        const { accessToken } = await setup(); //user not admin
        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Access denied" });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access POST '/api/v1/pokemon/'", async() => {
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        const { accessToken } = await setup(); //user not admin
        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                }
            });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Access denied" });
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
    });
})


////HERR
describe("Testing user/admin cannot access the routes after logging out before logging back in", () => {
    let pokeID = 2000;
    test("testing users cannot access GET '/report?id=n' valid access token", async() => {
        const { accessToken, refreshToken } = await setup(true);
        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .get('/report?id=1')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        expect(JSON.parse(res.text)).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });

    });

    test("testing users cannot access PATCH '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken, refreshToken } = await setup(true);
        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .patch(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        // delete jsonRes.pokeInfo.__v;
        // delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access PUT '/api/v1/pokemon/:id' valid access token", async() => {
        let pokeData = {
            name: { english: "fasty" },
            "base": {
                "HP": 55
            },
            "type": [],
            id: pokeID
        }
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                },
            }) //$$$
        const { accessToken, refreshToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .put(`/api/v1/pokemon/${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send(pokeData);
        let jsonRes = JSON.parse(res.text);
        // delete jsonRes.pokeInfo.__v;
        // delete jsonRes.pokeInfo._id;
        expect(jsonRes).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access DELETE '/api/v1/pokemon/?id=n' valid access token", async() => {
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        await pokeModel.create({
            id: pokeID,
            name: { english: "fasty" },
            "type": [
                "Bug",
                "Poison"
            ],
            "base": {
                "HP": 45,
                "Attack": 25,
                "Defense": 50,
                "Sp. Attack": 25,
                "Sp. Defense": 25,
                "Speed": 35
            }
        }); //$$$
        const { accessToken, refreshToken } = await setup(true);
        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .delete(`/api/v1/pokemon/?id=${pokeID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({ datadummy: "..." });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        await pokeModel.remove({ id: pokeID }); //$$$
    });



    test("testing users cannot access POST '/api/v1/pokemon/'", async() => {
        let pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
        const { accessToken, refreshToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .post("/api/v1/pokemon")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send({
                id: pokeID,
                name: { english: "fasty" },
                "type": [
                    "Bug",
                    "Poison"
                ],
                "base": {
                    "HP": 45,
                    "Attack": 25,
                    "Defense": 50,
                    "Sp. Attack": 25,
                    "Sp. Defense": 25,
                    "Speed": 35
                }
            });
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        pokeModel = await getPokeModel();
        await pokeModel.remove({ id: pokeID }); //$$$
    });


    test("testing user route '/api/v1/pokemons' with valid access token", async() => {
        const { accessToken, refreshToken } = await setup(true);
        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();

        let res = await appServer
            .get("/api/v1/pokemons?after=0&count=20")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        // let pokeData = JSON.parse(res.text);
        // expect(pokeData.length).toBe(20);
    });


    test("testing user route /api/v1/pokemon?id=n' with valid access token", async() => {
        const { accessToken, refreshToken } = await setup(true);

        await authServer
            .get(`/logout`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-refresh", refreshToken)
            .set("auth-token-access", accessToken)
            .send();
        let pokemonID = 15;
        let res = await appServer
            .get(`/api/v1/pokemon?id=${pokemonID}`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .set("auth-token-access", accessToken)
            .send();
        let msg = JSON.parse(res.text);
        expect(msg).toStrictEqual({ err: "Poke API Error - Authentication Error: Invalid or expired access token." });
        // let pokeData = JSON.parse(res.text);
        // expect(pokeData).toBeTruthy();
        // expect(Array.isArray(pokeData)).toBe(true);
        // expect(pokeData.length).toBe(1);
        // expect(pokeData[0].name.english).toBe("Beedrill"); // poke ID 15 English name is Beedrill
    });
})


describe("miscellaneous tests", () => {
    test("testing decoding JWT token(refresh and access) and fetching its payload", async() => {
        n++;
        let payload = {
            username: `coco${n}`,
            email: `cococ${n}@gmail.com`,
            password: "123",
        };

        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let res = await authServer
            .post(`/login`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);

        let refreshToken = res.headers["auth-token-refresh"];
        let accessToken = res.headers["auth-token-access"];

        let refreshDecode = null;
        let accessDecode = null;
        try {
            refreshDecode = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
            accessDecode = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        } catch (err) {
            expect(false).toBeTruthy();
        }
        expect(refreshDecode).toBeTruthy();
        expect(accessDecode).toBeTruthy();
        expect(refreshDecode.username).toBe(payload.username);
        expect(accessDecode.username).toBe(payload.username);
    });
})

async function setup(admin) {
    n++;
    let payload = {
        username: `coco${n}`,
        email: `cococ${n}@gmail.com`,
        password: "123",
    };
    if (admin) {
        payload = {
            username: `admin`,
            email: `admin@admin.ca`,
            password: "admin",
        };
    }
    if (!admin) {
        await authServer
            .post(`/register`)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(payload);
    }
    let res = await authServer
        .post(`/login`)
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(payload);

    let refreshToken = res.headers["auth-token-refresh"];
    let accessToken = res.headers["auth-token-access"];
    return { payload, refreshToken, accessToken };
}


async function getPokeModel() {
    if (!mongoose.models.pokemons) {
        let pokeSchema = await getTypes();
        return mongoose.model('pokemons', pokeSchema);
    }
    return mongoose.models.pokemons;
}