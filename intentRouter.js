

const { createTask } = require('./services/todoist');
const { sendEmail, listEmails } = require('./services/gmail');
const { createEvent, listUpcomingEvents } = require('./services/calendar');

module.exports = {
  create_task: {
    todoist: createTask
  },
  check_tasks: {
    todoist: async () => {
      // optional implementation
    }
  },
  send_email: {
    gmail: sendEmail
  },
  check_email: {
    gmail: listEmails
  },
  create_event: {
    calendar: createEvent
  },
  check_calendar: {
    calendar: listUpcomingEvents
  }
};
