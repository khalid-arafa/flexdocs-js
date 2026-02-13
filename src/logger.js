const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

class Logger {
  constructor(options = {}) {
    this.level = options.level !== undefined ? options.level : LogLevel.INFO;
    this.prefix = options.prefix || "[FlexDocs]";
  }

  setLevel(level) {
    this.level = level;
  }

  debug(...args) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.prefix, ...args);
    }
  }

  log(...args) {
    if (this.level <= LogLevel.INFO) {
      console.log(this.prefix, ...args);
    }
  }

  info(...args) {
    if (this.level <= LogLevel.INFO) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args) {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.prefix, ...args);
    }
  }
}

const logger = new Logger();

export { Logger, LogLevel };
export default logger;
