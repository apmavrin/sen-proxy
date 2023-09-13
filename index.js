const express = require("express");
const morgan = require("morgan");
const https = require("https");
const fs = require("fs");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { constants } = require("buffer");
const env = require("dotenv").config();

// Create Express Server
const app = express();

// Configuration
const PORT = 8080;
const HOST = "localhost";
const API_SERVICE_URL = process.env.API_SERVICE_URL;
var jSession = "";
const options = {
  key: fs.readFileSync("./certificate/private.key"),
  cert: fs.readFileSync("./certificate/certificate.pem"),
  secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1 | constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3
}

const getjSession = () =>  {
      const URL = `${API_SERVICE_URL}/login`;
      const CRED = {
        auth_user: process.env.AUTH_USER,
        password: process.env.PASSWORD,
      };
      const getSEN = async () => {
        const rawResponse = await fetch(URL, {
          method: "POST",
          body: JSON.stringify(CRED),
        });
        jSession = rawResponse.headers.get("Set-Cookie").split(";")[0];
        console.log(jSession);
      };
      getSEN();
    }

//Obtain the session ID and refresh it once in 30 mins

if (jSession == "") {
    getjSession();
    setInterval(getjSession, 1_800_000);
}

// Logging
app.use(morgan("dev"));

//Check if JSESSION is acquired
app.get("/jsession", (req, res, next) => {
    res.send("session id: " + jSession);
  });

// Redirect all requests to SEN Cloud
app.use(
  "",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {'^/enmanager' : ''},
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader("Cookie", jSession);
      }
  })
);

// Start Proxy on HTTP 8080
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});

// Start Proxy on HTTPS 443
https.createServer(options, app).listen(443)