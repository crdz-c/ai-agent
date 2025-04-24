

const { google } = require('googleapis');
const { getOAuthClient } = require('./googleAuth');

async function listUpcomingEvents(maxResults = 10) {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return response.data.items;
}

async function createEvent({ summary, description, startDateTime, endDateTime }) {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary,
    description,
    start: {
      dateTime: startDateTime,
      timeZone: 'America/Sao_Paulo'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'America/Sao_Paulo'
    }
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event
  });

  return response.data;
}

module.exports = {
  listUpcomingEvents,
  createEvent
};
