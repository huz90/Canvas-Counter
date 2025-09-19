// Background script for the Canvas Counter extension
class BackgroundTracker {
  constructor() {
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.onInstall();
      }
    });

    // Set up alarms for course review reminders
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'courseReviewCheck') {
        this.checkCourseReviews();
      }
    });

    // Create a daily alarm to check for course reviews
    chrome.alarms.create('courseReviewCheck', {
      delayInMinutes: 1,
      periodInMinutes: 60 // Check every hour
    });

    // Listen for tab updates to detect Canvas visits
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isCanvasUrl(tab.url)) {
        this.recordCanvasVisit();
      }
    });
  }

  onInstall() {
    // Initialize default settings
    chrome.storage.sync.set({
      settings: {
        workDuration: 25,
        breakDuration: 5,
        notificationsEnabled: true
      }
    });

    // Request notification permission
    chrome.notifications.create({
      type: 'basic',
      title: 'Canvas Counter Installed!',
      message: 'Start your study streak by completing a pomodoro session!'
    });
  }

  isCanvasUrl(url) {
    if (!url) return false;
    return url.includes('instructure.com') || url.includes('canvas');
  }

  async recordCanvasVisit() {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['lastCanvasVisit']);
    
    if (result.lastCanvasVisit !== today) {
      await chrome.storage.local.set({ lastCanvasVisit: today });
    }
  }

  async checkCourseReviews() {
    const result = await chrome.storage.local.get(['courses', 'settings']);
    const courses = result.courses || [];
    const settings = result.settings || { notificationsEnabled: true };
    
    if (!settings.notificationsEnabled) return;

    const now = Date.now();
    const dueCourses = courses.filter(course => {
      const timeSinceLastCheck = now - (course.lastNotification || 0);
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      return course.nextReview <= now && timeSinceLastCheck > oneDayInMs;
    });

    if (dueCourses.length > 0) {
      // Update last notification time
      const updatedCourses = courses.map(course => {
        if (dueCourses.some(dc => dc.id === course.id)) {
          return { ...course, lastNotification: now };
        }
        return course;
      });
      
      await chrome.storage.local.set({ courses: updatedCourses });

      // Show notification
      chrome.notifications.create({
        type: 'basic',
        title: 'Course Review Reminder',
        message: `${dueCourses.length} course${dueCourses.length > 1 ? 's' : ''} ${dueCourses.length > 1 ? 'are' : 'is'} due for review: ${dueCourses.map(c => c.name).join(', ')}`
      });
    }
  }
}

// Initialize background script
new BackgroundTracker();