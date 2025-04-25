const { google } = require('googleapis');
const { getOAuthClient } = require('./googleAuth');
const base64url = require('base64url');

// Send an email
async function sendEmail({ to, subject, message }) {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    message
  ];

  const email = emailLines.join('\n');
  const encodedMessage = base64url.encode(email);

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });

  return res.data;
}

// List recent emails
async function listEmails({ quantity = 5 }) {
  const limit = Math.min(quantity, 10);
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: limit
  });

  const messages = res.data.messages || [];
  const messageDetails = [];

  for (const msg of messages) {
    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id
    });

    const subjectHeader = fullMessage.data.payload.headers.find(
      h => h.name === 'Subject'
    );

    const snippet = fullMessage.data.snippet;

    messageDetails.push({
      id: msg.id,
      subject: subjectHeader ? subjectHeader.value : '(No subject)',
      snippet
    });
  }

  return messageDetails;
}

module.exports = {
  sendEmail,
  listEmails
};
