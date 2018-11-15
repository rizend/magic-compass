const _ = require('lodash');
const WsTransport = require("./wsTransport");

let roomMap = {};

// http://diveintohtml5.info/geolocation.html
// https://developer.mozilla.org/en-US/docs/Web/API/Detecting_device_orientation

const props = "latitude, longitude, altitude, accuracy, altitudeAccuracy, heading, speed".split(", ");
function onMessage(message) {
  console.log(message);
  const obj = _.pick(JSON.parse(message), props);
  console.log(message);
  _.forEach(obj, (value, key) => {
      if (typeof value === "number" && !isNaN(value)) {
        this.coords[key] = value;
      }
  });
}

class Room {
  constructor() {
    this.clients = [];
    this.nextUpdate = 0;
  }
  handleClient(client) {
    this.clients = this.clients.filter(c => c && c.isAlive);
    let clients = this.clients;
    client.coords = {};
    client.onmessage = onMessage;
    // client.onclose = onClose;
    if (clients.length >= 2) {
      return "*full*";
    }
    clients.push(client);
    if (clients.length === 1) {
      client.send({"typ": "loading"});
    } else if (clients.length === 2) {
      clients.forEach(c => c.sendCharacter("*"));
      console.log('Got two clients, lets go!');
    }
    return false;
  }
  tick() {
    let clients = this.clients;
    if (clients.length === 2) {
      sendLetters(clients[0], clients[1]);
    }
  }
}
function onConnection(client, id) {
  console.log("Connecton to room %s", id);
  if (!(/^[a-zA-Z0-9]{1,255}$/g).test(id)) {
    return "Bad id!";
  }
  let room = roomMap[id] || (roomMap[id] = new Room());
  console.log('new connection!');
  return room.handleClient(client);
}
WsTransport.run(onConnection);

const DIRECTION_LETTERS = "E,NE,N,NW,W,SW,S,SE".split(",");

function sendLetters(a, b) {
  let latitudeDifference = a.coords.latitude - b.coords.latitude;
  let longitudeDifference = a.coords.longitude - b.coords.longitude;
  let altitudeDifference = a.coords.altitude - b.coords.altitude;
  let altitudeAccuracy = a.coords.altitudeAccuracy + b.coords.altitudeAccuracy;

  // we're going to model the earth's surface as basically flat for simplicity; no great circle distance for us.
  let distanceAccuracy = Math.sqrt(2) * a.coords.accuracy + b.coords.accuracy;
  let distance = Math.sqrt(Math.pow(latitudeDifference, 2) + Math.pow(longitudeDifference, 2));

  let θ = Math.atan2(latitudeDifference, longitudeDifference); // [-PI, PI]
  if (θ < 0) {
    θ = θ + Math.PI*2; // [0, 2*PI]
  }
/*
         a
        /|
       / |      SOHCAHTOA => tan(θ) = opposite / adjacent
      /  |      tan(θ) = latitude / longitude
     /   |      θ = arctan(latitude / longitude)
    /    |-latitude
   / θ   |
  --------
b      |
    longitude

*/
  let eighth = Math.round((θ / Math.PI * 4) - 0.5); // [0,7], integer
  let bDirection = DIRECTION_LETTERS[eighth];
  let aDirection = DIRECTION_LETTERS[(eighth + 4) % 8];
  a.sendCharacter(aDirection || "?");
  b.sendCharacter(bDirection || "?");
}

setInterval(function() {
  // @TODO: check for dead clients
  _.forEach(roomMap, room => {
    room.tick();
  })
}, 1000);
