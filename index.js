'use strict';

// at least one world must be tracked in order to track players
// due to the design of the dynmap API.
const EventEmitter = require('events');
const rp = require('request-promise');

/**
 * Class representing the Dynmap server
 * This can only be used once the 'ready' event has been fired
 */
class Dynmap extends EventEmitter {
  /**
   * Constructor for the Dynmap class
   * @param {String} url Base URL of the map, eg. http://dynmap.starcatcher.us/
   * @param {Object} [options] The options object
   * @param {String} options.configPath Location of the configuration
   */
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;

    this.tracking = {};
    this.players = {};
    this.markers = {};
    this.worlds = {};
    this.updateURL = null;
    this.titleURL = null;
    this.markerURL = null;
    this.loginURL = null;
    this.config = null;
    this.defaultWorld = null;
    this.serverTime = null;

    this._init();
  }
  /**
   * Internal function to fetch initial data from the server
   * @return {Promise}
   */
  async _init() {
    let configPath = this.options.configPath || 'standalone/config.js';
    let preConfig;
    try {
      preConfig = await rp(this.url + configPath);
    } catch (err) {
      return this.emit('error', err);
    }
    let configuration = preConfig.match(/configuration: '(.+)',?/)[1];
    this.updateURL = preConfig.match(/update: '(.+)'/)[1];
    this.tileURL = preConfig.match(/tiles: '(.+)'/)[1];
    this.markerURL = preConfig.match(/markers: '(.+)'/)[1];
    this.loginURL = preConfig.match(/login: '(.+)'/)[1];
    let config;
    try {
      config = await rp(this.url + configuration, { json: true });
    } catch (err) {
      return this.emit('error', err);
    }
    if (config.error === 'login-required') {
      throw new Error('Login required to access');
    }
    this.config = config;
    this.defaultWorld = this.config.defaultworld;
    for (let i of Object.keys(this.config.worlds)) {
      let world = this.config.worlds[i];
      this.worlds[world.name] = world;
    }
    this.emit('ready');
    this.on('update', data => this.serverTime = data.servertime);
  }
  /**
   * Start fetching events for a specific world
   * @param {String} world World name to start tracking
   */
  track(world = this.defaultWorld) {
    if (!(world in this.worlds)) throw new Error('No such world');
    if (world in this.tracking) {
      throw new Error('Already tracking world ' + world);
    }
    this.tracking[world] = setInterval(async () => {
      let time = Date.now();
      let update;
      try {
        update = await rp(
          this.url + this.updateURL
          .replace('{world}', world)
          .replace('{timestamp}', time),
          { json: true }
        );
      } catch (err) {
        return this.emit('error', err);
      }
      this.emit('update', update);
      let newPlayers = {};
      for (let i of Object.keys(update.players)) {
        let player = update.players[i];
        // "-some-other-bogus-world-" for the world means the player is
        // not visible, this is a workaround
        if (player.world === '-some-other-bogus-world-') {
          player.visible = false;
        } else player.visible = true;
        if (player.account in this.players) this.emit('playerUpdate', player);
          else this.emit('playerAdded', player);
        this.players[player.account] = player;
        newPlayers[player.account] = player;
      }
      for (let i in this.players) {
        if (!(i in newPlayers)) {
          this.emit('playerRemoved', this.players[i]);
          delete(this.players[i]);
        }
      }
      this.tracking[world].lastUpdate = time;
    }, this.config.updaterate);
    this.tracking[world].lastUpdate = null;
  }
  /**
   * Stop tracking a world
   * @param {String} world World to stop tracking
   */
  untrack(world) {
    if (!(world in this.tracking)) {
      throw new Error('World is not being tracked');
    }
    clearInterval(this.tracking[world]);
    delete this.tracking[world];
    if (Object.keys(this.tracking).length === 0) this.players = {};
  }
  /**
   * Get server time
   * Only needed if no world is currently being tracked. If tracking is active,
   * use dynmap.time instead
   * @param {String} world World name
   * @return {Promise}
   */
  async getServerTime(world) {
    let body;
    body = await rp(
      this.url + this.updateURL
      .replace('{world}', world)
      .replace('{timestamp}', Date.now()),
      { json: true }
    );
    this.serverTime = body.servertime;
    return this.serverTime;
  }
  /**
   * Get markers in a world
   * @param {String} world World name
   * @return {Promise}
   */
  async getMarkers(world) {
    if (!(world in this.worlds)) throw new Error('No such world');
    let body = await rp(
      this.url + this.markerURL + '_markers_/marker_' + world + '.json',
      { json: true }
    );
    this.markers = body.sets;
    return this.markers;
  }
}

module.exports = Dynmap;
module.exports.Dynmap = module.exports;
