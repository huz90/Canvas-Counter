class StudyTracker {
  constructor() {
    // Timer state will be synced from background script
    this.timeLeft = 25 * 60;
    this.isRunning = false;
    this.isWorkSession = true;
    this.settings = {
      workDuration: 25,
      breakDuration: 5,
      notificationsEnabled: true
    };
    
    // Gamification properties
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.achievements = {
      'first-session': false,
      'week-streak': false,
      'month-master': false,
      'streak-starter': false,
      'streak-champion': false,
      'streak-legend': false,
      'streak-god': false
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadStreak();
    await this.loadCourses();
    await this.loadGamificationData();
    await this.syncTimerState(); // Sync with background timer
    this.bindEvents();
    this.updateDisplay();
    this.updateGamificationDisplay();
    this.checkCanvasVisit();
    
    // Start periodic sync with background timer
    this.startTimerSync();
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get(['settings']);
    if (result.settings) {
      this.settings = { ...this.settings, ...result.settings };
    }
    this.timeLeft = this.settings.workDuration * 60;
  }

  async loadStreak() {
    const result = await chrome.storage.local.get(['streak', 'lastSessionDate']);
    this.streak = result.streak || 0;
    this.lastSessionDate = result.lastSessionDate;
    this.updateStreakDisplay();
  }

  async loadCourses() {
    const result = await chrome.storage.local.get(['courses']);
    this.courses = result.courses || [];
    this.updateCoursesDisplay();
  }

  async loadGamificationData() {
    const result = await chrome.storage.local.get(['level', 'xp', 'achievements']);
    this.level = result.level || 1;
    this.xp = result.xp || 0;
    this.achievements = { ...this.achievements, ...result.achievements };
    this.calculateXpToNextLevel();
  }

  calculateXpToNextLevel() {
    this.xpToNextLevel = this.level * 50; // Reduced from 100 to 50 XP per level
  }

  bindEvents() {
    // Timer controls
    document.getElementById('timerBtn').addEventListener('click', () => this.toggleTimer());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
    
    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
    document.getElementById('closeModal').addEventListener('click', () => this.hideSettings());
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    
    // Courses
    document.getElementById('addCourseBtn').addEventListener('click', () => this.showAddCourse());
    document.getElementById('closeCourseModal').addEventListener('click', () => this.hideAddCourse());
    document.getElementById('addCourse').addEventListener('click', () => this.addCourse());
    
    // Click outside modal to close
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) this.hideSettings();
    });
    document.getElementById('addCourseModal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) this.hideAddCourse();
    });
  }

  async syncTimerState() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });
      const previousWorkSession = this.isWorkSession;
      
      this.timeLeft = response.timeLeft;
      this.isRunning = response.isRunning;
      this.isWorkSession = response.isWorkSession;
      this.settings = { ...this.settings, ...response.settings };
      
      // Update UI based on current state
      this.updateTimerButton();
      this.updateTimerLabel();
      
      // Check if session type changed (work <-> break)
      if (previousWorkSession !== this.isWorkSession) {
        this.handleSessionChange();
      }
      
      // Also sync gamification data
      await this.syncGamificationData();
    } catch (error) {
      console.error('Failed to sync timer state:', error);
    }
  }

  async syncGamificationData() {
    try {
      const result = await chrome.storage.local.get(['level', 'xp', 'achievements']);
      const previousLevel = this.level;
      
      this.level = result.level || 1;
      this.xp = result.xp || 0;
      this.achievements = { ...this.achievements, ...result.achievements };
      this.calculateXpToNextLevel();
      
      // Update display
      this.updateGamificationDisplay();
      
      // Check for level up animation
      if (this.level > previousLevel) {
        this.showLevelUpAnimation();
      }
    } catch (error) {
      console.error('Failed to sync gamification data:', error);
    }
  }

  startTimerSync() {
    // Sync timer state every second when popup is open
    this.timerSyncInterval = setInterval(() => {
      this.syncTimerState();
      this.updateDisplay();
    }, 1000);
  }

  stopTimerSync() {
    if (this.timerSyncInterval) {
      clearInterval(this.timerSyncInterval);
      this.timerSyncInterval = null;
    }
  }

  async toggleTimer() {
    try {
      await chrome.runtime.sendMessage({ action: 'toggleTimer' });
      await this.syncTimerState();
      this.updateTimerButton();
    } catch (error) {
      console.error('Failed to toggle timer:', error);
    }
  }

  async resetTimer() {
    try {
      await chrome.runtime.sendMessage({ action: 'resetTimer' });
      await this.syncTimerState();
      this.updateDisplay();
    } catch (error) {
      console.error('Failed to reset timer:', error);
    }
  }

  updateTimerButton() {
    const timerBtn = document.getElementById('timerBtn');
    if (this.isRunning) {
      timerBtn.textContent = 'PAUSE';
      timerBtn.classList.add('pause');
    } else {
      timerBtn.textContent = 'START';
      timerBtn.classList.remove('pause');
    }
  }

  updateTimerLabel() {
    const timerLabel = document.getElementById('timerLabel');
    timerLabel.textContent = this.isWorkSession ? 'Focus Time' : 'Break Time';
  }

  // Session completion is now handled by background script
  // This method is called when the popup detects a session change
  handleSessionChange() {
    this.updateTimerLabel();
    this.updateGamificationDisplay();
    
    if (!this.isWorkSession) {
      // Show meditation section for break
      this.showMeditationSection();
      this.startBreathingAnimation();
    } else {
      // Hide meditation section for work
      this.hideMeditationSection();
      this.stopBreathingAnimation();
    }
  }

  async incrementStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    if (this.lastSessionDate === today) {
      // Already completed a session today
      return;
    } else if (this.lastSessionDate === yesterday) {
      // Continuing streak
      this.streak++;
    } else {
      // New streak or broken streak
      this.streak = 1;
    }
    
    this.lastSessionDate = today;
    
    await chrome.storage.local.set({
      streak: this.streak,
      lastSessionDate: this.lastSessionDate
    });
    
    this.updateStreakDisplay();
  }

  updateStreakDisplay() {
    document.getElementById('streakNumber').textContent = this.streak;
    
    // Update gif based on streak value
    const fireGif = document.getElementById('fireGif');
    if (this.streak === 0) {
      // Show John Travolta image (fire.gif) for streak 0
      fireGif.src = 'icons/fire.gif';
      fireGif.alt = 'John Travolta';
    } else {
      // Show animated fire gif for streak > 0
      fireGif.src = 'icons/fire-animated.gif';
      fireGif.alt = 'Animated Fire';
    }
    
    const lastSessionElement = document.getElementById('lastSession');
    if (this.lastSessionDate) {
      const date = new Date(this.lastSessionDate);
      lastSessionElement.textContent = `Last session: ${date.toLocaleDateString()}`;
    } else {
      lastSessionElement.textContent = 'Complete a pomodoro to start!';
    }
  }

  updateDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timerDisplay').textContent = display;
    this.updateProgressRing();
  }

  updateProgressRing() {
    const totalTime = this.isWorkSession ? this.settings.workDuration * 60 : this.settings.breakDuration * 60;
    const progress = (totalTime - this.timeLeft) / totalTime;
    const circumference = 2 * Math.PI * 54; // radius = 54
    const offset = circumference - (progress * circumference);
    
    const circle = document.getElementById('progressCircle');
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = this.isWorkSession ? '#f97316' : '#10b981';
  }

  showNotification(title, message) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/icons/icon48.png'
      });
    }
  }

  showSettings() {
    document.getElementById('workDuration').value = this.settings.workDuration;
    document.getElementById('breakDuration').value = this.settings.breakDuration;
    document.getElementById('notificationsEnabled').checked = this.settings.notificationsEnabled;
    document.getElementById('settingsModal').classList.add('show');
  }

  hideSettings() {
    document.getElementById('settingsModal').classList.remove('show');
  }

  async saveSettings() {
    const newSettings = {
      workDuration: parseInt(document.getElementById('workDuration').value),
      breakDuration: parseInt(document.getElementById('breakDuration').value),
      notificationsEnabled: document.getElementById('notificationsEnabled').checked
    };
    
    try {
      await chrome.runtime.sendMessage({ 
        action: 'updateSettings', 
        settings: newSettings 
      });
      this.settings = { ...this.settings, ...newSettings };
      this.hideSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  showAddCourse() {
    document.getElementById('courseName').value = '';
    document.getElementById('reviewInterval').value = '7';
    document.getElementById('addCourseModal').classList.add('show');
  }

  hideAddCourse() {
    document.getElementById('addCourseModal').classList.remove('show');
  }

  async addCourse() {
    const name = document.getElementById('courseName').value.trim();
    const interval = parseInt(document.getElementById('reviewInterval').value);
    
    if (!name) return;
    
    const course = {
      id: Date.now(),
      name,
      interval,
      lastReview: Date.now(),
      nextReview: Date.now() + (interval * 24 * 60 * 60 * 1000)
    };
    
    this.courses.push(course);
    await chrome.storage.local.set({ courses: this.courses });
    
    this.updateCoursesDisplay();
    this.hideAddCourse();
  }

  async removeCourse(id) {
    this.courses = this.courses.filter(course => course.id !== id);
    await chrome.storage.local.set({ courses: this.courses });
    this.updateCoursesDisplay();
  }

  async reviewCourse(id) {
    const course = this.courses.find(c => c.id === id);
    if (course) {
      course.lastReview = Date.now();
      course.nextReview = Date.now() + (course.interval * 24 * 60 * 60 * 1000);
      await chrome.storage.local.set({ courses: this.courses });
      this.updateCoursesDisplay();
    }
  }

  updateCoursesDisplay() {
    const container = document.getElementById('coursesList');
    
    if (this.courses.length === 0) {
      container.innerHTML = '<div class="no-courses">No content reviews scheduled</div>';
      return;
    }
    
    const now = Date.now();
    const sortedCourses = this.courses.sort((a, b) => a.nextReview - b.nextReview);
    
    container.innerHTML = sortedCourses.map(course => {
      const isDue = course.nextReview <= now;
      const dueDate = new Date(course.nextReview);
      const timeUntil = isDue ? 'Due now!' : `Due ${dueDate.toLocaleDateString()}`;
      
      return `
        <div class="course-item ${isDue ? 'due' : ''}">
          <div class="course-info">
            <div class="course-name">${course.name}</div>
            <div class="course-due">${timeUntil}</div>
          </div>
          <div class="course-actions">
            <button class="course-action review-btn" data-course-id="${course.id}" title="Mark content as reviewed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </button>
            <button class="course-action remove-btn" data-course-id="${course.id}" title="Remove content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners for the dynamically created buttons
    this.bindCourseEvents();
  }

  bindCourseEvents() {
    // Handle review button clicks
    document.querySelectorAll('.review-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const courseId = parseInt(e.target.closest('.review-btn').dataset.courseId);
        this.reviewCourse(courseId);
      });
    });
    
    // Handle remove button clicks
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const courseId = parseInt(e.target.closest('.remove-btn').dataset.courseId);
        this.removeCourse(courseId);
      });
    });
  }

  // XP management is now handled by the background script
  // This method is kept for compatibility but delegates to background
  async addXP(amount) {
    // XP is automatically added by background script when sessions complete
    // This method is no longer needed but kept for compatibility
    console.log('addXP called in popup - XP is managed by background script');
  }

  async checkAchievements() {
    let newAchievements = [];
    
    // First session achievement
    if (!this.achievements['first-session']) {
      this.achievements['first-session'] = true;
      newAchievements.push('First Focus');
    }
    
    // Week streak achievement
    if (!this.achievements['week-streak'] && this.streak >= 7) {
      this.achievements['week-streak'] = true;
      newAchievements.push('Week Warrior');
    }
    
    // Month master achievement
    if (!this.achievements['month-master'] && this.streak >= 30) {
      this.achievements['month-master'] = true;
      newAchievements.push('Month Master');
    }
    
    if (newAchievements.length > 0) {
      await chrome.storage.local.set({ achievements: this.achievements });
      this.showAchievementNotification(newAchievements);
      this.updateAchievementsDisplay();
    }
  }

  showLevelUpAnimation() {
    const fireGif = document.getElementById('fireGif');
    fireGif.style.animation = 'none';
    setTimeout(() => {
      fireGif.style.animation = 'flame 0.5s ease-in-out infinite alternate, levelUp 1s ease';
    }, 10);
    
    setTimeout(() => {
      fireGif.style.animation = 'flame 2s ease-in-out infinite alternate';
    }, 1000);
  }

  showAchievementNotification(achievements) {
    if (this.settings.notificationsEnabled) {
      const message = achievements.length === 1 
        ? `Achievement unlocked: ${achievements[0]}!`
        : `Achievements unlocked: ${achievements.join(', ')}!`;
      
      this.showNotification('🏆 Achievement Unlocked!', message);
    }
  }

  updateGamificationDisplay() {
    // Update level display
    document.getElementById('levelNumber').textContent = this.level;
    
    // Update XP bar
    const xpProgress = (this.xp / this.xpToNextLevel) * 100;
    document.getElementById('xpProgress').style.width = `${xpProgress}%`;
    document.getElementById('xpText').textContent = `${this.xp}/${this.xpToNextLevel} XP`;
    
    // Update achievements display
    this.updateAchievementsDisplay();
  }

  updateAchievementsDisplay() {
    const achievementItems = document.querySelectorAll('.achievement-item');
    
    achievementItems.forEach(item => {
      const achievementId = item.dataset.achievement;
      if (this.achievements[achievementId]) {
        item.classList.remove('locked');
        item.classList.add('unlocked');
      }
    });
  }

  showMeditationSection() {
    const meditationSection = document.getElementById('meditationSection');
    const timerSection = document.querySelector('.timer-section');
    
    // Keep timer section visible during break so users can see the countdown
    timerSection.style.display = 'block';
    meditationSection.style.display = 'block';
  }

  hideMeditationSection() {
    const meditationSection = document.getElementById('meditationSection');
    const timerSection = document.querySelector('.timer-section');
    
    meditationSection.style.display = 'none';
    timerSection.style.display = 'block';
  }

  startBreathingAnimation() {
    const breathingText = document.getElementById('breathingText');
    
    // Initialize timeout tracking array
    this.breathingTimeouts = [];
    
    // Set initial text
    breathingText.textContent = 'Breathe In';
    
    // Sync with CSS animation timing (14 second cycle)
    // 0-6 seconds: Breathe In (circle expanding)
    // 6-10 seconds: Hold (circle at max size)
    // 10-14 seconds: Breathe Out (circle contracting)
    
    const timeout1 = setTimeout(() => {
      breathingText.textContent = 'Hold';
    }, 6000); // After 6 seconds
    
    const timeout2 = setTimeout(() => {
      breathingText.textContent = 'Breathe Out';
    }, 10000); // After 10 seconds
    
    this.breathingTimeouts.push(timeout1, timeout2);
    
    // Restart the cycle every 14 seconds
    this.breathingInterval = setInterval(() => {
      breathingText.textContent = 'Breathe In';
      
      const timeout3 = setTimeout(() => {
        breathingText.textContent = 'Hold';
      }, 6000);
      
      const timeout4 = setTimeout(() => {
        breathingText.textContent = 'Breathe Out';
      }, 10000);
      
      this.breathingTimeouts.push(timeout3, timeout4);
    }, 14000);
  }

  stopBreathingAnimation() {
    if (this.breathingInterval) {
      clearInterval(this.breathingInterval);
      this.breathingInterval = null;
    }
    
    // Clear any pending setTimeout timers
    if (this.breathingTimeouts) {
      this.breathingTimeouts.forEach(timeout => clearTimeout(timeout));
      this.breathingTimeouts = [];
    }
    
    // Reset breathing text
    const breathingText = document.getElementById('breathingText');
    breathingText.textContent = 'Breathe In';
  }

  async checkCanvasVisit() {
    // Check if user is currently on Canvas
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab && (currentTab.url.includes('instructure.com') || currentTab.url.includes('canvas'))) {
        // User is on Canvas, record visit
        const today = new Date().toDateString();
        const result = await chrome.storage.local.get(['lastCanvasVisit']);
        
        if (result.lastCanvasVisit !== today) {
          await chrome.storage.local.set({ lastCanvasVisit: today });
        }
      }
    } catch (error) {
      console.log('Could not check Canvas visit:', error);
    }
  }
}

// Initialize when popup opens
let studyTracker;
document.addEventListener('DOMContentLoaded', () => {
  studyTracker = new StudyTracker();
  
  // Request notification permission
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

// Clean up when popup is closed
window.addEventListener('beforeunload', () => {
  if (studyTracker) {
    studyTracker.stopTimerSync();
  }
});