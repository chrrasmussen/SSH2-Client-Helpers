// Global variables

var _logger;


// Public functions

function setLogger(logger) {
    _logger = logger;
}

function setUpConnection(Client, config) {
    return {
        connect: function (sessionHandler) {
            return connect(Client, config, sessionHandler);
        },
        exec: function (command, optionsOrFn) {
            return exec(Client, config, command, optionsOrFn);
        }
    };
}

function connect(Client, config, sessionHandler) {
    return _connect(Client, config, function (conn) {
        return sessionHandler(function (command, options) {
            return _exec(conn, command, options);
        });
    });
}

function exec(Client, config, command, optionsOrFn) {
    return connect(Client, config, function (exec) {
        return exec(command, optionsOrFn);
    });
}


// Private functions

function _connect(Client, config, sessionHandler) {
    return new Promise(function (resolve, reject) {
        var conn = new Client();
        conn.on('ready', function () {
            _log('Connection ready');

            sessionHandler(conn)
                .then(function () {
                    _log('Disconnected');

                    conn.end();
                    resolve();
                })
                .catch(function (err) {
                    reject(err);
                });
        });

        conn.on('error', function (err) {
            _log('Connection failed: ' + err);

            reject(err);
        });

        conn.connect(config);
    });
}

function _exec(conn, command, optionsOrFn) {
    var defaultConfigureStream = function (stream) {
        _configureStream(stream, optionsOrFn);
    };
    var configureStream = (typeof(optionsOrFn) === 'function') ? optionsOrFn : defaultConfigureStream;

    return __exec(conn, command, configureStream);
}

function __exec(conn, command, configureStreamHandler) {
    return new Promise(function (resolve, reject) {
        _log('Executing: ' + command);

        conn.exec(command, function (err, stream) {
            if (!err) {
                var configureStreamPromise = Promise.resolve();
                if (configureStreamHandler) {
                    var maybePromise = configureStreamHandler(stream);

                    var isPromise = maybePromise && typeof(maybePromise.then) === 'function';
                    if (isPromise) {
                        configureStreamPromise = maybePromise;
                    }
                }

                stream.on('close', function(code, signal) {
                    _log('Stream close: code: ' + code + ', signal: ' + signal);

                    configureStreamPromise.then(function () {
                        resolve({
                            code: code,
                            signal: signal
                        });
                    });
                });
            }
            else {
                reject(err);
            }
        });
    });
}

function _configureStream(stream, options) {
    options = options || {};

    if (options.stdin) {
        options.stdin.pipe(stream);
    }

    if (options.stdout !== null) {
        var stdout = options.stdout || process.stdout;
        stream.stdout.pipe(stdout);
    }

    if (options.stderr !== null) {
        var stderr = options.stderr || process.stderr;
        stream.stderr.pipe(stderr);
    }
}

function _log(msg) {
    if (_logger) {
        _logger(msg);
    }
}

module.exports = {
    setLogger: setLogger,
    setUpConnection: setUpConnection,
    connect: connect,
    exec: exec
};
