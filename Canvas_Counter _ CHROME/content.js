// Content script for Canvas pages
class CanvasTracker {
  constructor() {
    this.init();
  }

  async init() {
    // Record Canvas visit
    await this.recordVisit();
    
    // Add study tracker indicator
    this.addStudyIndicator();
    
    // Check for course reviews
    this.checkCourseReviews();
  }

  async recordVisit() {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['lastCanvasVisit']);
    
    if (result.lastCanvasVisit !== today) {
      await chrome.storage.local.set({ lastCanvasVisit: today });
      console.log('Canvas visit recorded for', today);
    }
  }

  addStudyIndicator() {
    // Add a subtle indicator that the extension is active
    const indicator = document.createElement('div');
    indicator.id = 'study-tracker-indicator';
    indicator.innerHTML = `
      <div class="study-indicator">
        <div class="study-icon">🔥</div>
        <div class="study-text">Study Tracker Active</div>
      </div>
    `;
    
    // Insert at the top of the page
    const header = document.querySelector('#header') || document.querySelector('.ic-app-header') || document.body;
    if (header) {
      header.appendChild(indicator);
    }
  }

  async checkCourseReviews() {
    const result = await chrome.storage.local.get(['courses']);
    const courses = result.courses || [];
    const now = Date.now();
    
    const dueCourses = courses.filter(course => course.nextReview <= now);
    
    if (dueCourses.length > 0) {
      this.showReviewReminder(dueCourses);
    }
  }

  showReviewReminder(dueCourses) {
    const reminder = document.createElement('div');
    reminder.id = 'course-review-reminder';
    reminder.innerHTML = `
      <div class="review-reminder">
        <div class="reminder-header">
          <span class="reminder-icon">📚</span>
          <strong>Course Review Reminder</strong>
          <button class="reminder-close">×</button>
        </div>
        <div class="reminder-content">
          <p>You have ${dueCourses.length} course${dueCourses.length > 1 ? 's' : ''} due for review:</p>
          <ul>
            ${dueCourses.map(course => `<li>${course.name}</li>`).join('')}
          </ul>
          <p>Complete a pomodoro session to maintain your streak!</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(reminder);
    
    // Add close functionality
    reminder.querySelector('.reminder-close').addEventListener('click', () => {
      reminder.remove();
    });
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (reminder.parentNode) {
        reminder.remove();
      }
    }, 10000);
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new CanvasTracker());
} else {
  new CanvasTracker();
}