const fetch = require('node-fetch');

const API_BASE = 'https://api.todoist.com/rest/v2';
const TOKEN = process.env.TODOIST_API_KEY;

// Validate token at startup
if (!TOKEN) {
  throw new Error('TODOIST_API_KEY environment variable is not set');
}

async function handleTodoistResponse(response) {
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Todoist API Error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    });
    throw new Error(`Todoist API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  if (response.status === 204) {
    return { success: true };
  }
  
  try {
    return await response.json();
  } catch (error) {
    console.error('Error parsing Todoist response:', error);
    throw new Error('Failed to parse Todoist response');
  }
}

async function createTask({ title, dueDate }) {
  console.log('Creating Todoist task:', { title, dueDate });
  
  const response = await fetch(`${API_BASE}/tasks`, {
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
  
  return handleTodoistResponse(response);
}

async function updateTask(taskId, updates) {
  console.log('Updating Todoist task:', { taskId, updates });
  
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return handleTodoistResponse(response);
}

async function deleteTask(taskId) {
  console.log('Deleting Todoist task:', { taskId });
  
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function getAllTasks() {
  console.log('Fetching all Todoist tasks');
  
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

// Export a function to validate the token
async function validateToken() {
  try {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Todoist API returned ${response.status}: ${response.statusText}`);
    }
    
    console.log('Todoist API token validated successfully');
    return true;
  } catch (error) {
    console.error('Todoist API token validation failed:', error);
    throw error;
  }
}

module.exports = {
  createTask,
  updateTask,
  deleteTask,
  getAllTasks,
  validateToken
};
