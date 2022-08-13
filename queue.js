function getBlankPromise() {
    let resolver, rejector;

    const promise = new Promise(function (resolve, reject) {
        resolver = resolve;
        rejector = reject;
    });

    return [ promise, resolver, rejector ];
}

function sleep(ms) {
    return new Promise( (res) => { setTimeout(res, ms); } );
}

module.exports = class Queue {

    constructor(config) {
        this.active = false;
        this._lastActive = Date.now();
        this.delay = config.delay || 500;
        this.concurrent = config.concurrent || 2;
        this.todo = [];

        if (config.autostart) {
            this.start();
        }
    }

    /**
     * @param {Function} fn The function to run.
     * @param {mixed[]} args Arguments to pass to the function.
     * @returns {Promise} Promise resolving to the job's return value when completed.
     */
    submit(fn, args) {
        const promise = getBlankPromise();
        this.todo.push([fn, args || [], promise]);
        return promise[0];
    }

    async runLoop() {
        const knownActive = this._lastActive;

        if ( this.todo.length > 0 ) {
            const [ fn, args, promise ] = this.todo.shift();
            let res;
            try {
                res = fn(...args);
            } catch (e) {
                promise[2](e);
            }
            if ( res instanceof Promise ) {
                res.then( promise[1], promise[2] );
                await promise[0];
            } else {
                promise[1](res);
            }
        }
        await sleep((this.todo.length > 0 || this.delay > 50) ? this.delay : 50);

        // Die if not active or if this function was part of a previous active stage
        if (this.active && this._lastActive === knownActive) {
            this.runLoop();
        }
    }

    start() {
        this._lastActive = Date.now();
        this.active = true;
        this.intervals = [];
        for ( let i = 0; i < this.concurrent; i++ ) {
            this.runLoop();
        }
    }

    stop() {
        this.active = false;
    }

}