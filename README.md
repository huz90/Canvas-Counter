# Canvas-Counter
Keep up your canvas streak!

## Installation
- Download or clone this repository  
- Extract the ZIP folder  
- Open Chrome and navigate to `chrome://extensions/`  
- Enable **Developer mode** in the top right  
- Click **Load unpacked** and select the **Canvas Counter – CHROME** folder  
  - **ATTENTION:** Do **NOT** select the **“Canvas Counter–main”** folder.  
    This will **NOT** work.  
  - Instead, open that folder and select the **“Canvas Counter – CHROME”** folder.  
- The Canvas Counter icon will appear in your extensions toolbar

A Chrome extension for Canvas LMS that helps students maintain study streaks, use pomodoro technique, and implement spaced repetition for course reviews.

## Features

### 🔥 Study Streak Tracking
- Track consecutive days of study sessions
- Streak only increments after completing a 25-minute pomodoro session
- Visual fire emoji indicator with streak counter

### ⏰ Pomodoro Timer
- 25-minute focus sessions followed by 5-minute breaks
- Customizable work and break durations
- Visual progress ring with smooth animations
- Audio and visual notifications for session completion

### 📚 Spaced Repetition System
- Add courses for scheduled review
- Customizable review intervals (1 day, 3 days, 1 week, 2 weeks, 1 month)
- Automatic reminders when reviews are due
- Track last review dates and upcoming due dates

### 🎨 Beautiful Design
- Modern, clean interface with smooth animations
- Responsive design optimized for extension popup
- Intuitive controls and visual feedback
- Apple-inspired design aesthetics

## Usage

### Getting Started
1. Click the extension icon to open the popup
2. Visit any Canvas page to start tracking your study sessions
3. Complete a 25-minute pomodoro session to begin your streak

### Using the Pomodoro Timer
1. Click "START" to begin a 25-minute focus session
2. Work on your studies until the timer completes
3. Take a 5-minute break when prompted
4. Repeat the cycle to maintain productivity

### Adding Course Reviews
1. Click the "+ Add Course Review" button
2. Enter the course name
3. Select review interval (1 day to 1 month)
4. The course will appear in your review list with due dates

### Settings
- Customize work and break durations
- Enable/disable notifications
- Access through the settings gear icon

## Technical Details

### Files Structure
- `manifest.json` - Extension configuration
- `popup.html/css/js` - Main extension interface
- `content.js/css` - Canvas page integration
- `background.js` - Background processes and notifications
- `icons/` - Extension icons

### Storage
- Uses Chrome Storage API for data persistence
- Syncs settings across devices
- Local storage for streak and course data

### Permissions
- `storage` - Save settings and data
- `tabs` - Detect Canvas page visits
- `notifications` - Show review reminders
- `host_permissions` - Access Canvas domains

## Development

### Prerequisites
- Chrome browser
- Basic knowledge of JavaScript, HTML, CSS

### Making Changes
1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon for the extension
4. Test your changes

### Adding Features
- Modify `popup.js` for UI functionality
- Update `content.js` for Canvas page integration
- Edit `background.js` for background processes

## Privacy

This extension:
- Stores all data locally in your browser
- Does not send data to external servers
- Only accesses Canvas pages you visit
- Respects your privacy and study habits

## Support

For issues, suggestions, or contributions, please refer to the extension's support channels or create an issue in the repository.

## License

This extension is provided as-is for educational and productivity purposes.

## Patch Notes

### 1.1.0
Fixed timer not keeping track when the extension is closed. 
Added gif change after streak = 1
### 1.2.0
Fixed XP system not going beyond level 1
Added level scaling beyond level 1
Added XP bonus for longer streak days
Timer added to meditation time
New achievements added
Fixed meditation text syncing with dynamic breathing circle
Changed "Course Review" to "Content Review" for clarity
#### 1.2.1
Changed Icon
#### 1.2.21
Increased time on breathing circle
