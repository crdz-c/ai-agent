

const fetch = require('node-fetch');

const API_BASE = 'https://api.todoist.com/rest/v2';
const TOKEN = process.env.TODOIST_API_KEY;

async function createTask({ title, dueDate }) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: title,
      due_datetime: dueDate
    })
  });
  return await res.json();
}

async function updateTask(taskId, updates) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  return res.status === 204;
}

async function deleteTask(taskId) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  return res.status === 204;
}

async function getAllTasks() {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  return await res.json();
}

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  getAllTasks
};
