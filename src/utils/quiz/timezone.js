// src/utils/quiz/timezone.js - Timezone and Testing Mode Utilities

// Check if testing mode is enabled
function isTestingMode() {
    return process.env.DAILY_QUIZ_TESTING_MODE === 'true';
}

// Get current day key based on EDT timezone with 3 AM reset
function getCurrentDayKey() {
    if (isTestingMode()) {
        return `test-mode-${new Date().toISOString().split('T')[0]}`;
    }
    
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    // If it's before 3 AM EDT, use previous day
    if (edtTime.getHours() < 3) {
        edtTime.setDate(edtTime.getDate() - 1);
    }
    
    return edtTime.toISOString().split('T')[0];
}

// Check if date is in Eastern Daylight Time (EDT)
function isEDT(date) {
    const year = date.getFullYear();
    
    // Second Sunday in March at 2:00 AM
    const marchSecondSunday = new Date(year, 2, 1); // March 1st
    marchSecondSunday.setDate(1 + (14 - marchSecondSunday.getDay()) % 7); // First Sunday
    marchSecondSunday.setDate(marchSecondSunday.getDate() + 7); // Second Sunday
    marchSecondSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    // First Sunday in November at 2:00 AM
    const novemberFirstSunday = new Date(year, 10, 1); // November 1st
    novemberFirstSunday.setDate(1 + (7 - novemberFirstSunday.getDay()) % 7); // First Sunday
    novemberFirstSunday.setHours(2, 0, 0, 0); // 2:00 AM
    
    return date >= marchSecondSunday && date < novemberFirstSunday;
}

// Get next reset time as Unix timestamp
function getNextResetUnixTimestamp() {
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    const nextReset = new Date(edtTime);
    nextReset.setHours(3, 0, 0, 0); // 3:00 AM EDT
    
    const currentTimeInMinutes = (edtTime.getHours() * 60) + edtTime.getMinutes();
    const resetTimeInMinutes = (3 * 60) + 0; // 3:00 AM
    
    // If it's already past 3 AM today, set for tomorrow
    if (currentTimeInMinutes >= resetTimeInMinutes) {
        nextReset.setDate(nextReset.getDate() + 1);
    }
    
    // Convert back to UTC
    const utcReset = new Date(nextReset.getTime() - (edtOffset * 60 * 60 * 1000));
    return Math.floor(utcReset.getTime() / 1000);
}

// Get human-readable time until next reset
function getTimeUntilReset() {
    const now = Date.now();
    const nextResetTime = getNextResetUnixTimestamp() * 1000;
    const timeDiff = nextResetTime - now;
    
    if (timeDiff <= 0) {
        return 'Reset time has passed';
    }
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Get current EDT time string for display
function getCurrentEDTTimeString() {
    const now = new Date();
    const edtOffset = isEDT(now) ? -4 : -5;
    const edtTime = new Date(now.getTime() + (edtOffset * 60 * 60 * 1000));
    
    const timeZoneName = isEDT(now) ? 'EDT' : 'EST';
    
    return {
        timeString: edtTime.toISOString().replace('T', ' ').substring(0, 19),
        timeZone: timeZoneName,
        offset: edtOffset,
        isDaylightSaving: isEDT(now)
    };
}

// Debug timezone information
function debugTimezone() {
    const now = new Date();
    const edtInfo = getCurrentEDTTimeString();
    const currentDay = getCurrentDayKey();
    const nextReset = getNextResetUnixTimestamp();
    const timeUntilReset = getTimeUntilReset();
    
    console.log('\n🔍 TIMEZONE DEBUG INFORMATION:');
    console.log(`Server UTC time: ${now.toISOString()}`);
    console.log(`Calculated EDT time: ${edtInfo.timeString} ${edtInfo.timeZone}`);
    console.log(`Is EDT (Daylight Saving)? ${edtInfo.isDaylightSaving}`);
    console.log(`EDT offset: ${edtInfo.offset} hours`);
    console.log(`Current day key: ${currentDay}`);
    console.log(`Next reset: ${new Date(nextReset * 1000).toISOString()}`);
    console.log(`Time until reset: ${timeUntilReset}`);
    console.log(`Testing mode: ${isTestingMode()}`);
    console.log('───────────────────────────────────────\n');
    
    return {
        serverUTC: now.toISOString(),
        calculatedEDT: edtInfo.timeString,
        timeZone: edtInfo.timeZone,
        isEDT: edtInfo.isDaylightSaving,
        edtOffset: edtInfo.offset,
        currentDay: currentDay,
        nextReset: nextReset,
        timeUntilReset: timeUntilReset,
        testingMode: isTestingMode()
    };
}

// Validate timezone calculation
function validateTimezone() {
    try {
        const now = new Date();
        const systemNYTime = new Date().toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const edtInfo = getCurrentEDTTimeString();
        
        return {
            valid: true,
            systemNYTime: systemNYTime,
            calculatedEDT: edtInfo.timeString,
            timeZone: edtInfo.timeZone,
            matches: systemNYTime.includes(edtInfo.timeString.split(' ')[0]) // Check if dates match
        };
    } catch (error) {
        console.error('Timezone validation error:', error);
        return {
            valid: false,
            error: error.message
        };
    }
}

module.exports = {
    isTestingMode,
    getCurrentDayKey,
    isEDT,
    getNextResetUnixTimestamp,
    getTimeUntilReset,
    getCurrentEDTTimeString,
    debugTimezone,
    validateTimezone
};
