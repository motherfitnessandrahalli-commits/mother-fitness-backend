const { Attendance, Customer } = require('../models');

class AlertService {
    /**
     * Calculate attendance drop alerts for a specific customer
     * Rule: If last 5 days attendance < 50% of 15-day rolling average
     */
    static async calculateAttendanceDrop(customerId) {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        // Get all IN attendances for last 15 days
        const attendances = await Attendance.find({
            customerId,
            type: 'IN',
            timestamp: { $gte: fifteenDaysAgo }
        }).sort({ timestamp: -1 });

        if (attendances.length === 0) return null;

        const totalVisits15 = attendances.length;
        const avg15 = totalVisits15 / 15; // Visits per day baseline

        const last5Visits = attendances.filter(a => a.timestamp >= fiveDaysAgo).length;
        const avg5 = last5Visits / 5; // Visits per day recently

        // Threshold: Member must have been somewhat active to trigger a "drop" alert
        if (avg15 < 0.2) return null; // Less than 3 visits in 15 days is too low to flag a drop

        const dropPercentage = ((avg15 - avg5) / avg15) * 100;

        if (dropPercentage >= 50) {
            return {
                type: 'ATTENDANCE_DROP',
                severity: dropPercentage > 75 ? 'CRITICAL' : 'WARNING',
                score: Math.round(dropPercentage),
                message: `Attendance dropped by ${Math.round(dropPercentage)}% in last 5 days`,
                suggestedAction: 'Call member / Offer PT session'
            };
        }

        return null;
    }

    /**
     * Calculate workout duration drop alerts
     * Pairs IN/OUT events to find session durations
     */
    static async calculateDurationDrop(customerId) {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch all IN/OUT events for 14 days
        const events = await Attendance.find({
            customerId,
            timestamp: { $gte: fourteenDaysAgo }
        }).sort({ timestamp: 1 });

        if (events.length < 2) return null;

        // Pair IN and OUT events to find durations in minutes
        const sessions = [];
        let currentIn = null;

        for (const event of events) {
            if (event.type === 'IN') {
                if (currentIn) {
                    // Previous IN had no OUT. Assume a default 60min session if it was a different day
                    // to keep the data somewhat useful without over-counting
                    const lastInTime = new Date(currentIn.timestamp);
                    const currentInTime = new Date(event.timestamp);
                    if (lastInTime.toDateString() !== currentInTime.toDateString()) {
                        sessions.push({ timestamp: currentIn.timestamp, duration: 60 });
                    }
                }
                currentIn = event;
            } else if (event.type === 'OUT' && currentIn) {
                const durationMinutes = (event.timestamp - currentIn.timestamp) / (1000 * 60);
                if (durationMinutes > 2 && durationMinutes < 300) { // Valid session (2m to 5h)
                    sessions.push({
                        timestamp: currentIn.timestamp,
                        duration: durationMinutes
                    });
                }
                currentIn = null;
            }
        }

        if (sessions.length === 0) return null;

        const prev7 = sessions.filter(s => s.timestamp < sevenDaysAgo);
        const curr7 = sessions.filter(s => s.timestamp >= sevenDaysAgo);

        if (prev7.length === 0 || curr7.length === 0) return null;

        const avgPrev = prev7.reduce((acc, s) => acc + s.duration, 0) / prev7.length;
        const avgCurr = curr7.reduce((acc, s) => acc + s.duration, 0) / curr7.length;

        // Ignore if baseline duration is very short (< 20 mins)
        if (avgPrev < 20) return null;

        const dropPercentage = ((avgPrev - avgCurr) / avgPrev) * 100;

        if (dropPercentage >= 50) {
            return {
                type: 'DURATION_DROP',
                severity: dropPercentage > 75 ? 'CRITICAL' : 'WARNING',
                score: Math.round(dropPercentage),
                message: `Workout duration dropped by ${Math.round(dropPercentage)}% this week`,
                suggestedAction: 'Motivation check / Workout plan review'
            };
        }

        return null;
    }
}

module.exports = AlertService;
