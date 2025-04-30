require('dotenv').config();
const { createTask } = require('./services/todoist');

async function testCreateTask() {
  try {
    const task = await createTask({
      title: "Test task from AI Agent",
      dueDate: new Date().toISOString()
    });
    console.log('Task created successfully:', task);
  } catch (error) {
    console.error('Failed to create task:', error.message);
  }
}

testCreateTask();
