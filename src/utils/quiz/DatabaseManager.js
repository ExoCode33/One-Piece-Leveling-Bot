// src/utils/quiz/DatabaseManager.js - Database Operations for Daily Quiz

const { isTestingMode, getCurrentDayKey } = require('./timezone');

class DatabaseManager {
    constructor(database) {
        this.db = database;
        this.initializeTables();
    }

    //
