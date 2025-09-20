// Background script for the Canvas Counter extension
class BackgroundTracker {
  constructor() {
    this.timer = null;
    this.timeLeft = 25 * 60; // 25 minutes in seconds
    this.isRunning = false;
    this.isWorkSession = true;
    this.settings = {
      workDuration: 25,
      breakDuration: 5,
      notificationsEnabled: true
    };
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

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Load timer state on startup
    this.loadTimerState();
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
        title: 'Content Review Reminder',
        message: `${dueCourses.length} content${dueCourses.length > 1 ? 's' : ''} ${dueCourses.length > 1 ? 'are' : 'is'} due for review: ${dueCourses.map(c => c.name).join(', ')}`
      });
    }
  }

  // Timer methods
  async loadTimerState() {
    const result = await chrome.storage.local.get(['timerState', 'settings']);
    if (result.timerState) {
      this.timeLeft = result.timerState.timeLeft;
      this.isRunning = result.timerState.isRunning;
      this.isWorkSession = result.timerState.isWorkSession;
    }
    if (result.settings) {
      this.settings = { ...this.settings, ...result.settings };
    }
    
    // If timer was running, restart it
    if (this.isRunning) {
      this.startTimer();
    }
  }

  async saveTimerState() {
    await chrome.storage.local.set({
      timerState: {
        timeLeft: this.timeLeft,
        isRunning: this.isRunning,
        isWorkSession: this.isWorkSession
      }
    });
  }

  startTimer() {
    this.isRunning = true;
    this.saveTimerState();
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.saveTimerState();
      
      if (this.timeLeft <= 0) {
        this.completeSession();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.timer);
    this.saveTimerState();
  }

  resetTimer() {
    this.pauseTimer();
    this.timeLeft = this.isWorkSession ? this.settings.workDuration * 60 : this.settings.breakDuration * 60;
    this.saveTimerState();
  }

  async completeSession() {
    this.pauseTimer();
    
    if (this.isWorkSession) {
      // Completed a work session - increment streak and add XP
      await this.incrementStreak();
      await this.addXP(25); // 25 base XP for completing a work session (plus streak bonus)
      await this.checkAchievements();
      
      // Switch to break
      this.isWorkSession = false;
      this.timeLeft = this.settings.breakDuration * 60;
      
      if (this.settings.notificationsEnabled) {
        this.showNotification('Work session complete!', 'Time for a mindful break! 🧘‍♀️');
      }
    } else {
      // Completed a break session
      this.isWorkSession = true;
      this.timeLeft = this.settings.workDuration * 60;
      
      if (this.settings.notificationsEnabled) {
        this.showNotification('Break complete!', 'Ready for another focus session?');
      }
    }
    
    this.saveTimerState();
  }

  async incrementStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    const result = await chrome.storage.local.get(['streak', 'lastSessionDate']);
    let streak = result.streak || 0;
    let lastSessionDate = result.lastSessionDate;
    
    if (lastSessionDate === today) {
      // Already completed a session today
      return;
    } else if (lastSessionDate === yesterday) {
      // Continuing streak
      streak++;
    } else {
      // New streak or broken streak
      streak = 1;
    }
    
    lastSessionDate = today;
    
    await chrome.storage.local.set({
      streak: streak,
      lastSessionDate: lastSessionDate
    });
  }

  async addXP(baseAmount) {
    const result = await chrome.storage.local.get(['level', 'xp', 'streak']);
    let level = result.level || 1;
    let xp = result.xp || 0;
    const currentStreak = result.streak || 0;
    
    // Calculate streak bonus
    const streakBonus = this.calculateStreakBonus(currentStreak);
    const totalXP = baseAmount + streakBonus;
    
    xp += totalXP;
    
    // Check for level up (reduced XP requirements for better progression)
    const xpToNextLevel = level * 50; // Reduced from 100 to 50 XP per level
    if (xp >= xpToNextLevel) {
      level++;
      xp = xp - xpToNextLevel;
      
      // Show level up notification
      this.showNotification('🎉 Level Up!', `Congratulations! You've reached level ${level}!`);
    }
    
    await chrome.storage.local.set({ 
      level: level, 
      xp: xp 
    });
    
    // Show XP earned notification if there's a streak bonus
    if (streakBonus > 0) {
      this.showNotification('🔥 Streak Bonus!', `+${streakBonus} XP bonus for ${currentStreak} day streak!`);
    }
  }

  calculateStreakBonus(streak) {
    // Progressive streak bonus system
    if (streak <= 1) {
      return 0; // No bonus for first day
    } else if (streak <= 3) {
      return 5; // Small bonus for 2-3 day streak
    } else if (streak <= 7) {
      return 10; // Medium bonus for 4-7 day streak
    } else if (streak <= 14) {
      return 15; // Good bonus for 1-2 week streak
    } else if (streak <= 30) {
      return 25; // Great bonus for 2-4 week streak
    } else {
      return 35; // Excellent bonus for 1+ month streak
    }
  }

  async checkAchievements() {
    const result = await chrome.storage.local.get(['achievements', 'streak']);
    const achievements = result.achievements || {
      'first-session': false,
      'week-streak': false,
      'month-master': false,
      'streak-starter': false,
      'streak-champion': false,
      'streak-legend': false,
      'streak-god': false
    };
    const streak = result.streak || 0;
    
    let newAchievements = [];
    
    // First session achievement
    if (!achievements['first-session']) {
      achievements['first-session'] = true;
      newAchievements.push('First Focus');
    }
    
    // Streak Starter achievement (3 days)
    if (!achievements['streak-starter'] && streak >= 3) {
      achievements['streak-starter'] = true;
      newAchievements.push('Streak Starter');
    }
    
    // Week streak achievement (7 days)
    if (!achievements['week-streak'] && streak >= 7) {
      achievements['week-streak'] = true;
      newAchievements.push('Week Warrior');
    }
    
    // Streak Champion achievement (14 days)
    if (!achievements['streak-champion'] && streak >= 14) {
      achievements['streak-champion'] = true;
      newAchievements.push('Streak Champion');
    }
    
    // Month master achievement (30 days)
    if (!achievements['month-master'] && streak >= 30) {
      achievements['month-master'] = true;
      newAchievements.push('Month Master');
    }
    
    // Streak Legend achievement (60 days)
    if (!achievements['streak-legend'] && streak >= 60) {
      achievements['streak-legend'] = true;
      newAchievements.push('Streak Legend');
    }
    
    // Streak God achievement (100 days)
    if (!achievements['streak-god'] && streak >= 100) {
      achievements['streak-god'] = true;
      newAchievements.push('Streak God');
    }
    
    if (newAchievements.length > 0) {
      await chrome.storage.local.set({ achievements: achievements });
      this.showAchievementNotification(newAchievements);
    }
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      title: title,
      message: message,
      iconUrl: '/icons/icon.svg'
    });
  }

  showAchievementNotification(achievements) {
    const message = achievements.length === 1 
      ? `Achievement unlocked: ${achievements[0]}!`
      : `Achievements unlocked: ${achievements.join(', ')}!`;
    
    this.showNotification('🏆 Achievement Unlocked!', message);
  }

  // Message handling
  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'getTimerState':
        sendResponse({
          timeLeft: this.timeLeft,
          isRunning: this.isRunning,
          isWorkSession: this.isWorkSession,
          settings: this.settings
        });
        break;
        
      case 'toggleTimer':
        if (this.isRunning) {
          this.pauseTimer();
        } else {
          this.startTimer();
        }
        sendResponse({ success: true });
        break;
        
      case 'resetTimer':
        this.resetTimer();
        sendResponse({ success: true });
        break;
        
      case 'updateSettings':
        this.settings = { ...this.settings, ...request.settings };
        await chrome.storage.sync.set({ settings: this.settings });
        this.resetTimer(); // Reset timer with new settings
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }
}

// Initialize background script
new BackgroundTracker();