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
        exec: function (command, options, configureStreamOptions) {
            return exec(Client, config, command, options, configureStreamOptions);
        }
    };
}

function connect(Client, config, sessionHandler) {
    return _connect(Client, config, function (conn) {
        return sessionHandler(function (command, options, configureStreamOptions) {
            return _exec(conn, command, options, configureStreamOptions);
        });
    });
}

function exec(Client, config, command, options, configureStreamOptions) {
    return connect(Client, config, function (exec) {
        return exec(command, options, configureStreamOptions);
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

function _exec(conn, command, options, configureStreamOptions) {
    options = options || {};
    
    var defaultConfigureStream = function (stream) {
        _configureStream(stream, configureStreamOptions);
    };
    var configureStreamHandler = (typeof(configureStreamOptions) === 'function') ? configureStreamOptions : defaultConfigureStream;
    
    return new Promise(function (resolve, reject) {
        _log('Executing: ' + command);

        conn.exec(command, options, function (err, stream) {
            if (!err) {
                var configureStreamPromise = _toPromise(configureStreamHandler(stream));

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

function _toPromise(maybePromise) {
    var isPromise = maybePromise && typeof(maybePromise.then) === 'function';
    if (isPromise) {
        return maybePromise;
    }
    
    return Promise.resolve();
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
