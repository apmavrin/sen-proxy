import express from "express";
import morgan from "morgan";
import { fileURLToPath } from "url";
import * as fs from "fs";
import * as rfs from "rotating-file-stream";
import * as path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { constants } from "buffer";
import axios from "axios";
import "dotenv/config";
import { Agent, createServer } from "https";

// Create Express Server
const app = express();
app.set("trust proxy", true);

// Configuration
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const PORT = 8080;
const HOST = "localhost";
const API_SERVICE_URL = process.env.API_SERVICE_URL;
var jSession = "";
const options = {
  key: fs.readFileSync("./certificate/private.key"),
  cert: fs.readFileSync("./certificate/certificate.pem"),
  secureOptions:
    constants.SSL_OP_NO_TLSv1 |
    constants.SSL_OP_NO_TLSv1_1 |
    constants.SSL_OP_NO_SSLv2 |
    constants.SSL_OP_NO_SSLv3,
};

const getjSession = () => {
  const URL = `${API_SERVICE_URL}/login`;
  const BODY = {
    auth_user: process.env.AUTH_USER,
    password: process.env.PASSWORD,
  };
  const getSEN = async () => {
    const rawResponse = await axios.post(URL, BODY, {
      // proxy: {
      //   protocol: 'http',
      //   host: 'nseproxy.sce.com',
      //   port: 8080,
      //   auth: {
      //     username: process.env.PROXY_USER,
      //     password: process.env.PROXY_PASSWORD
      //   }
      // }
    });
    jSession = rawResponse.headers.get("Set-Cookie")[0].split(";")[0];
    console.log(jSession);
  };
  getSEN();
};

//Obtain the session ID and refresh it once in 30 mins

if (jSession == "") {
  getjSession();
  setInterval(getjSession, 1_800_000);
}

// Logging

const pad = (num) => (num > 9 ? "" : "0") + num;
const generator = (time, index) => {
  if (!time) return "file.log";

  var month = time.getFullYear() + "" + pad(time.getMonth() + 1);
  var day = pad(time.getDate());
  var hour = pad(time.getHours());
  var minute = pad(time.getMinutes());

  return `${month}/${month}${day}-${hour}${minute}-${index}-file.log`;
};

const accessLogStream = rfs.createStream(generator, {
  interval: "1d", // rotate daily
  path: path.join(__dirname, "logs"),
  size: "10M", // rotate every 10 MegaBytes written
});

app.use(
  morgan("[:date[clf]] :referrer :req[header] :method :url - :status", {
    stream: accessLogStream,
  })
);

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
    agent: new Agent({
      maxSockets: Infinity,
      keepAlive: true,
    }),
    pathRewrite: { "^/enmanager": "" },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader("Cookie", jSession);
    },
    onError: (err, req, res) => {
      console.log(err);
    },
  })
);

// Start Proxy on HTTP 8080
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});

// Start Proxy on HTTPS 443
// createServer(options, app).listen(443)
