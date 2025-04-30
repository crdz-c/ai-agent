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
    // Task actions
    create_task: createTask,
    update_task: updateTask,
    delete_task: deleteTask,
    check_tasks: getAllTasks,
    complete_task: completeTask,
    uncomplete_task: uncompleteTask,
    search_tasks: searchTasks,
    
    // Project actions
    create_project: createProject,
    update_project: updateProject,
    delete_project: deleteProject,
    list_projects: getAllProjects,
    get_project: getProjectById,
    
    // Section actions
    create_section: createSection,
    update_section: updateSection,
    delete_section: deleteSection,
    list_sections: getSections,
    
    // Label actions
    create_label: createLabel,
    update_label: updateLabel,
    delete_label: deleteLabel,
    list_labels: getAllLabels,
    
    // Comment actions
    create_comment: createComment,
    update_comment: updateComment,
    delete_comment: deleteComment,
    list_comments: getComments
  },
  
  // Placeholder handlers for other services (will be implemented through Zapier)
  zapier: {
    // Email actions
    send_email: null,
    check_email: null,
    search_email: null,
    view_email: null,
    reply_email: null,
    
    // Note actions
    create_note: null,
    update_note: null,
    delete_note: null,
    check_notes: null,
    search_notes: null,
    view_note: null,
    
    // Event actions
    create_event: null,
    update_event: null,
    delete_event: null,
    check_events: null,
    search_events: null,
    view_event: null
  },
  
  // OpenAI actions
  openai: {
    chat_with_gpt: null,
    analyze_text: null,
    generate_text: null,
    summarize_text: null,
    translate_text: null
  },
  
  // Spotify actions
  spotify: {
    play_music: null,
    add_to_playlist: null,
    search_music: null,
    get_music_info: null
  }
};

module.exports = {
  serviceCapabilities,
  legacyHandlers
};
