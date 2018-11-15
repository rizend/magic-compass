const express = require('express');
const WebSocket = require('ws');

function run(onConnection) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.static('public'))
  const server = app.listen(3000, 'localhost');
  const wss = new WebSocket.Server({ server });

  function noop() {}

  function heartbeat() {
    this.isAlive = true;
  }

  const clients = new Set();
  class Client {
    constructor(ws) {
      this._ws = ws;
      this.onclose = null;
      this.onmessage = null;
      this._alive = true;
      this._id = null;
      this.lastChar = undefined;
      ws.on('pong', () => {
        this._alive = true
      });
      ws.on('message', msg => {
        if (this._id === null) {
          this._id = msg;
          let err = onConnection(this, msg);
          if (err) {
            this.end(err);
            return;
          }
          return;
        }
        this.onmessage ? this.onmessage.call(this, msg) : console.log("unhandled message!");
      });
    }
    send(msg) {
      if (typeof msg !== "string") {
        msg = JSON.stringify(msg);
      }
      if (this._id !== null) {
        try {
          this._ws.send(msg);
        } catch(e) {
          this._term("send failed");
        }
      } else {
        console.log("No id, message ignored %s", msg)
      }
    }
    sendCharacter(char) {
      if (this.lastChar !== char) {
        this.lastChar = char;
        return this.send({char, typ: "char"});
      }
    }
    end(msg) {
      this._ws.send(msg, () => this._ws.close())
    }
    _term() {
      console.log('terminating');
      clients.delete(this);
      this._ws.terminate();
      this.onclose && this.onclose.call(this);
    }
    get isAlive() {
      return this._ws.readyState < 2;
    }
  }

  wss.on('connection', function connection(ws, req) {
    const ip = req.headers['x-forwarded-for'];
    req = null;
    let client = new Client(ws);
    clients.add(client);
  });

  const interval = setInterval(function ping() {
    let toDelete = new Set();
    clients.forEach(function each(client) {
      if (client._alive === false) {
        return client._term();
      }

      client._alive = false;
      client._ws.ping(noop);
    });
  }, 10 * 1000); // 30 * 1000 prod, 30s
}

module.exports.run = run;
