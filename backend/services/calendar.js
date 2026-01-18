const { google } = require('googleapis');

class CalendarService {
    constructor(authClient) {
        this.calendar = google.calendar({ version: 'v3', auth: authClient });
    }

    async getEvents(timeMin, timeMax, maxResults = 10, query) {
        const now = new Date();
        const tMin = timeMin || now.toISOString();
        const tMax = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const response = await this.calendar.events.list({
            calendarId: 'primary',
            timeMin: tMin,
            timeMax: tMax,
            maxResults: maxResults || 10,
            singleEvents: true,
            orderBy: 'startTime',
            q: query || undefined
        });

        const events = (response.data.items || []).map(event => ({
            id: event.id,
            summary: event.summary || '(No title)',
            description: event.description || '',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location || '',
            attendees: (event.attendees || []).map(a => a.email),
            htmlLink: event.htmlLink,
            isAllDay: !event.start.dateTime
        }));

        return {
            success: true,
            events,
            count: events.length,
            timeRange: { from: tMin, to: tMax }
        };
    }

    async createEvent(eventData) {
        const { summary, description, startTime, endTime, attendees, location } = eventData;
        const event = {
            summary: summary,
            description: description || '',
            location: location || '',
            start: { dateTime: startTime },
            end: { dateTime: endTime }
        };

        if (attendees && attendees.length > 0) {
            event.attendees = attendees.map(email => ({ email }));
        }

        const response = await this.calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendUpdates: attendees ? 'all' : 'none'
        });

        return {
            success: true,
            event: {
                id: response.data.id,
                summary: response.data.summary,
                start: response.data.start.dateTime || response.data.start.date,
                end: response.data.end.dateTime || response.data.end.date,
                htmlLink: response.data.htmlLink,
                attendees: attendees || []
            },
            message: 'Event created successfully!'
        };
    }
}

module.exports = CalendarService;
