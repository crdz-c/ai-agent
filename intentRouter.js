const { 
  // Task Management
  createTask, updateTask, deleteTask, completeTask, uncompleteTask,
  // Task Retrieval
  getAllTasks, getTaskById, getFilteredTasks, searchTasks,
  // Project Management
  getAllProjects, getProjectById, createProject, updateProject, deleteProject,
  // Section Management
  getSections, createSection, updateSection, deleteSection,
  // Label Management
  getAllLabels, createLabel, updateLabel, deleteLabel,
  // Comment Management
  getComments, createComment, updateComment, deleteComment
} = require('./services/todoist');

// Define service capabilities using the ENTITY_ACTION format
const serviceCapabilities = {
  // Todoist capabilities
  todoist: {
    TASK: {
      CREATE: createTask,
      UPDATE: updateTask,
      DELETE: deleteTask,
      COMPLETE: completeTask,
      UNCOMPLETE: uncompleteTask,
      LIST: getAllTasks,
      GET: getTaskById,
      SEARCH: searchTasks
    },
    PROJECT: {
      CREATE: createProject,
      UPDATE: updateProject,
      DELETE: deleteProject,
      LIST: getAllProjects,
      GET: getProjectById
    },
    SECTION: {
      CREATE: createSection,
      UPDATE: updateSection,
      DELETE: deleteSection,
      LIST: getSections
    },
    LABEL: {
      CREATE: createLabel,
      UPDATE: updateLabel,
      DELETE: deleteLabel,
      LIST: getAllLabels
    },
    COMMENT: {
      CREATE: createComment,
      UPDATE: updateComment,
      DELETE: deleteComment,
      LIST: getComments
    }
  }
};

// Legacy handler mapping for backward compatibility
const legacyHandlers = {
  todoist: {
    create_task: createTask,
    check_tasks: getAllTasks
  }
};

module.exports = {
  serviceCapabilities,
  legacyHandlers
};
