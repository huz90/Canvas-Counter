class StudyTracker {
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
    
    // Gamification properties
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.achievements = {
      'first-session': false,
      'week-streak': false,
      'month-master': false
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadStreak();
    await this.loadCourses();
    await this.loadGamificationData();
    this.bindEvents();
    this.updateDisplay();
    this.updateGamificationDisplay();
    this.checkCanvasVisit();
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
    this.xpToNextLevel = this.level * 100;
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

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    this.isRunning = true;
    document.getElementById('timerBtn').textContent = 'PAUSE';
    document.getElementById('timerBtn').classList.add('pause');
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateDisplay();
      
      if (this.timeLeft <= 0) {
        this.completeSession();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    document.getElementById('timerBtn').textContent = 'START';
    document.getElementById('timerBtn').classList.remove('pause');
    clearInterval(this.timer);
  }

  resetTimer() {
    this.pauseTimer();
    this.timeLeft = this.isWorkSession ? this.settings.workDuration * 60 : this.settings.breakDuration * 60;
    this.updateDisplay();
  }

  async completeSession() {
    this.pauseTimer();
    
    if (this.isWorkSession) {
      // Completed a work session - increment streak and add XP
      await this.incrementStreak();
      await this.addXP(25); // 25 XP for completing a work session
      await this.checkAchievements();
      
      // Switch to break and show meditation section
      this.isWorkSession = false;
      this.timeLeft = this.settings.breakDuration * 60;
      document.getElementById('timerLabel').textContent = 'Break Time';
      this.showMeditationSection();
      this.startBreathingAnimation();
      
      if (this.settings.notificationsEnabled) {
        this.showNotification('Work session complete!', 'Time for a mindful break! 🧘‍♀️');
      }
    } else {
      // Completed a break session
      this.isWorkSession = true;
      this.timeLeft = this.settings.workDuration * 60;
      document.getElementById('timerLabel').textContent = 'Focus Time';
      this.hideMeditationSection();
      this.stopBreathingAnimation();
      
      if (this.settings.notificationsEnabled) {
        this.showNotification('Break complete!', 'Ready for another focus session?');
      }
    }
    
    this.updateDisplay();
    this.updateProgressRing();
    this.updateGamificationDisplay();
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
    this.settings.workDuration = parseInt(document.getElementById('workDuration').value);
    this.settings.breakDuration = parseInt(document.getElementById('breakDuration').value);
    this.settings.notificationsEnabled = document.getElementById('notificationsEnabled').checked;
    
    await chrome.storage.sync.set({ settings: this.settings });
    
    // Reset timer with new duration
    this.resetTimer();
    this.hideSettings();
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
      container.innerHTML = '<div class="no-courses">No course reviews scheduled</div>';
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
            <button class="course-action review-btn" data-course-id="${course.id}" title="Mark as reviewed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </button>
            <button class="course-action remove-btn" data-course-id="${course.id}" title="Remove course">
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

  async addXP(amount) {
    this.xp += amount;
    
    // Check for level up
    if (this.xp >= this.xpToNextLevel) {
      this.level++;
      this.xp = this.xp - this.xpToNextLevel;
      this.calculateXpToNextLevel();
      this.showLevelUpAnimation();
    }
    
    await chrome.storage.local.set({ 
      level: this.level, 
      xp: this.xp 
    });
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
    
    timerSection.style.display = 'none';
    meditationSection.style.display = 'block';
  }

  hideMeditationSection() {
    const meditationSection = document.getElementById('meditationSection');
    const timerSection = document.querySelector('.timer-section');
    
    meditationSection.style.display = 'none';
    timerSection.style.display = 'block';
  }

  startBreathingAnimation() {
    this.breathingInterval = setInterval(() => {
      const breathingText = document.getElementById('breathingText');
      const currentText = breathingText.textContent;
      
      if (currentText === 'Breathe In') {
        breathingText.textContent = 'Hold';
      } else if (currentText === 'Hold') {
        breathingText.textContent = 'Breathe Out';
      } else {
        breathingText.textContent = 'Breathe In';
      }
    }, 2000); // Change text every 2 seconds
  }

  stopBreathingAnimation() {
    if (this.breathingInterval) {
      clearInterval(this.breathingInterval);
      this.breathingInterval = null;
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