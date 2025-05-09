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

// Task Management

async function createTask({ title, dueDate, priority, projectId, sectionId, labels, description }) {
  console.log('Creating Todoist task:', { title, dueDate, priority, projectId, sectionId });
  
  const body = {
    content: title
  };

  // Add optional parameters if provided
  if (dueDate) body.due_datetime = dueDate;
  if (priority) body.priority = priority;
  if (projectId) body.project_id = projectId;
  if (sectionId) body.section_id = sectionId;
  if (labels && labels.length > 0) body.labels = labels;
  if (description) body.description = description;
  
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  return handleTodoistResponse(response);
}

async function updateTask(parameters) {
  // Handle both direct taskId parameter and parameters object
  let taskId;
  let updates = {};
  
  if (!parameters) {
    throw new Error('Parameters are required to update a task.');
  }
  
  // Extract taskId from parameters
  if (parameters.id) {
    taskId = parameters.id;
  } else if (parameters.taskId) {
    taskId = parameters.taskId;
  } else {
    // If we don't have a task ID, try to find the task by content/title
    if (parameters.title) {
      console.log('Searching for task by content:', parameters.title);
      const tasks = await getAllTasks();
      const task = tasks.find(t => 
        t.content.toLowerCase().includes(parameters.title.toLowerCase())
      );
      
      if (task) {
        taskId = task.id;
        console.log('Found task by content:', { taskId, content: task.content });
      } else {
        throw new Error('Task not found. Please provide a valid task ID or title.');
      }
    } else {
      throw new Error('Task ID or title is required to update a task.');
    }
  }
  
  // Build updates object
  if (parameters.newTitle || parameters.content) {
    updates.content = parameters.newTitle || parameters.content;
  }
  
  if (parameters.dueDate || parameters.due_date || parameters.due_datetime) {
    updates.due_datetime = parameters.dueDate || parameters.due_date || parameters.due_datetime;
  }
  
  if (parameters.priority) {
    updates.priority = parameters.priority;
  }
  
  if (parameters.labels) {
    updates.labels = parameters.labels;
  }
  
  if (parameters.description) {
    updates.description = parameters.description;
  }
  
  console.log('Updating Todoist task:', { taskId, updates });
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    const result = await handleTodoistResponse(response);
    return { 
      ...result,
      id: taskId,
      success: true,
      message: 'Task updated successfully'
    };
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

async function deleteTask(parameters) {
  // Handle both direct taskId parameter and parameters object
  let taskId;
  
  if (typeof parameters === 'string' || typeof parameters === 'number') {
    taskId = parameters;
  } else if (parameters && parameters.id) {
    taskId = parameters.id;
  } else if (parameters && parameters.taskId) {
    taskId = parameters.taskId;
  } else {
    // If we don't have a task ID, try to find the task by content/title
    if (parameters && parameters.title) {
      console.log('Searching for task by content:', parameters.title);
      const tasks = await getAllTasks();
      const task = tasks.find(t => 
        t.content.toLowerCase().includes(parameters.title.toLowerCase())
      );
      
      if (task) {
        taskId = task.id;
        console.log('Found task by content:', { taskId, content: task.content });
      } else {
        throw new Error('Task not found. Please provide a valid task ID or title.');
      }
    } else {
      throw new Error('Task ID or title is required to delete a task.');
    }
  }
  
  console.log('Deleting Todoist task:', { taskId });
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    const result = await handleTodoistResponse(response);
    return { 
      ...result,
      id: taskId,
      success: true,
      message: 'Task deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

async function completeTask(parameters) {
  // Handle both direct taskId parameter and parameters object
  let taskId;
  if (typeof parameters === 'string' || typeof parameters === 'number') {
    taskId = parameters;
  } else if (parameters && parameters.id) {
    taskId = parameters.id;
  } else if (parameters && parameters.taskId) {
    taskId = parameters.taskId;
  } else {
    // If we don't have a task ID, try to find the task by content/title
    if (parameters && parameters.title) {
      console.log('Searching for task by content:', parameters.title);
      const tasks = await getAllTasks();
      const task = tasks.find(t => 
        t.content.toLowerCase().includes(parameters.title.toLowerCase())
      );
      
      if (task) {
        taskId = task.id;
        console.log('Found task by content:', { taskId, content: task.content });
      } else {
        throw new Error('Task not found. Please provide a valid task ID or title.');
      }
    } else {
      throw new Error('Task ID or title is required to complete a task.');
    }
  }
  
  console.log('Completing Todoist task:', { taskId });
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await handleTodoistResponse(response);
    return { 
      ...result,
      id: taskId,
      success: true,
      message: 'Task completed successfully'
    };
  } catch (error) {
    console.error('Error completing task:', error);
    throw error;
  }
}

async function uncompleteTask(parameters) {
  // Handle both direct taskId parameter and parameters object
  let taskId;
  if (typeof parameters === 'string' || typeof parameters === 'number') {
    taskId = parameters;
  } else if (parameters && parameters.id) {
    taskId = parameters.id;
  } else if (parameters && parameters.taskId) {
    taskId = parameters.taskId;
  } else {
    // If we don't have a task ID, try to find the task by content/title
    if (parameters && parameters.title) {
      console.log('Searching for task by content:', parameters.title);
      const tasks = await getAllTasks();
      const task = tasks.find(t => 
        t.content.toLowerCase().includes(parameters.title.toLowerCase())
      );
      
      if (task) {
        taskId = task.id;
        console.log('Found task by content:', { taskId, content: task.content });
      } else {
        throw new Error('Task not found. Please provide a valid task ID or title.');
      }
    } else {
      throw new Error('Task ID or title is required to uncomplete a task.');
    }
  }
  
  console.log('Reopening Todoist task:', { taskId });
  
  try {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/reopen`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await handleTodoistResponse(response);
    return { 
      ...result,
      id: taskId,
      success: true,
      message: 'Task reopened successfully'
    };
  } catch (error) {
    console.error('Error reopening task:', error);
    throw error;
  }
}

// Task Retrieval

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

async function getTaskById(taskId) {
  console.log('Fetching Todoist task by ID:', { taskId });
  
  const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function getFilteredTasks(filter) {
  // Filter can be: today, overdue, upcoming
  console.log(`Fetching ${filter} Todoist tasks`);
  let url = `${API_BASE}/tasks`;
  
  if (filter === 'today') {
    url = `${API_BASE}/tasks?filter=today`;
  } else if (filter === 'overdue') {
    url = `${API_BASE}/tasks?filter=overdue`;
  } else if (filter === 'upcoming') {
    url = `${API_BASE}/tasks?filter=7 days`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function searchTasks(query) {
  console.log('Searching Todoist tasks:', { query });
  
  // Todoist doesn't have a direct search API, so we fetch all tasks and filter
  const allTasks = await getAllTasks();
  
  // Search in task content and description (case insensitive)
  return allTasks.filter(task => 
    task.content.toLowerCase().includes(query.toLowerCase()) || 
    (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
  );
}

// Project Management

async function getAllProjects() {
  console.log('Fetching all Todoist projects');
  
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function getProjectById(projectId) {
  console.log('Fetching Todoist project:', { projectId });
  
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function createProject(name, color, parentId) {
  console.log('Creating Todoist project:', { name, color, parentId });
  
  const body = {
    name: name
  };
  
  if (color) body.color = color;
  if (parentId) body.parent_id = parentId;
  
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  return handleTodoistResponse(response);
}

async function updateProject(projectId, updates) {
  console.log('Updating Todoist project:', { projectId, updates });
  
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return handleTodoistResponse(response);
}

async function deleteProject(projectId) {
  console.log('Deleting Todoist project:', { projectId });
  
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

// Section Management

async function getSections(projectId) {
  console.log('Fetching Todoist sections for project:', { projectId });
  
  let url = `${API_BASE}/sections`;
  if (projectId) {
    url += `?project_id=${projectId}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function createSection(name, projectId) {
  console.log('Creating Todoist section:', { name, projectId });
  
  const response = await fetch(`${API_BASE}/sections`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      project_id: projectId
    })
  });
  
  return handleTodoistResponse(response);
}

async function updateSection(sectionId, name) {
  console.log('Updating Todoist section:', { sectionId, name });
  
  const response = await fetch(`${API_BASE}/sections/${sectionId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name
    })
  });
  
  return handleTodoistResponse(response);
}

async function deleteSection(sectionId) {
  console.log('Deleting Todoist section:', { sectionId });
  
  const response = await fetch(`${API_BASE}/sections/${sectionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

// Label Management

async function getAllLabels() {
  console.log('Fetching all Todoist labels');
  
  const response = await fetch(`${API_BASE}/labels`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function createLabel(name, color) {
  console.log('Creating Todoist label:', { name, color });
  
  const body = {
    name: name
  };
  
  if (color) body.color = color;
  
  const response = await fetch(`${API_BASE}/labels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  return handleTodoistResponse(response);
}

async function updateLabel(labelId, updates) {
  console.log('Updating Todoist label:', { labelId, updates });
  
  const response = await fetch(`${API_BASE}/labels/${labelId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  return handleTodoistResponse(response);
}

async function deleteLabel(labelId) {
  console.log('Deleting Todoist label:', { labelId });
  
  const response = await fetch(`${API_BASE}/labels/${labelId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

// Comment Management

async function getComments(taskId) {
  console.log('Fetching comments for task:', { taskId });
  
  const response = await fetch(`${API_BASE}/comments?task_id=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

async function createComment(taskId, content) {
  console.log('Adding comment to task:', { taskId, content });
  
  const response = await fetch(`${API_BASE}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      task_id: taskId,
      content: content
    })
  });
  
  return handleTodoistResponse(response);
}

async function updateComment(commentId, content) {
  console.log('Updating comment:', { commentId, content });
  
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: content
    })
  });
  
  return handleTodoistResponse(response);
}

async function deleteComment(commentId) {
  console.log('Deleting comment:', { commentId });
  
  const response = await fetch(`${API_BASE}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });
  
  return handleTodoistResponse(response);
}

// Token Validation

async function validateToken() {
  try {
    console.log('Validating Todoist API token...');
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
  // Task Management
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  uncompleteTask,
  
  // Task Retrieval
  getAllTasks,
  getTaskById,
  getFilteredTasks,
  searchTasks,
  
  // Project Management
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  
  // Section Management
  getSections,
  createSection,
  updateSection,
  deleteSection,
  
  // Label Management
  getAllLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  
  // Comment Management
  getComments,
  createComment,
  updateComment,
  deleteComment,
  
  // Token Validation
  validateToken
};
