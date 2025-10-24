	// ============================================================================
	// SECTION 1: FIREBASE IMPORTS & DEPENDENCIES
	// ============================================================================
	// Why: Using CDN imports instead of npm packages to avoid build step complexity
	// This keeps the app deployable as a simple static site without requiring Node.js

	import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
	import {
	    getDatabase,
	    ref,
	    set,
	    get,
	    update,
	    remove,
	    onValue,
	    child
	} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
	import {
	    getAuth,
	    signInWithEmailAndPassword,
	    createUserWithEmailAndPassword,
	    signInWithPopup,
	    GoogleAuthProvider,
	    onAuthStateChanged,
	    signOut,
	    sendEmailVerification
	} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

	// ============================================================================
	// SECTION 2: IMMEDIATE DARK MODE INITIALIZATION
	// ============================================================================
	// Why: Dark mode must be applied BEFORE the page renders to prevent flash of wrong theme
	// This IIFE runs synchronously before any HTML is parsed to avoid the "white flash"
	// that occurs when switching from default light mode to dark mode after page load
	(function initializeDarkMode() {
	    const isDarkMode = localStorage.getItem('darkMode') === 'true';

	    if (isDarkMode) {
	        // Apply to documentElement first (available immediately in <head>)
	        document.documentElement.classList.add('dark-mode');

	        // Also apply to body - it may not exist yet since we're in <head>
	        // Why: Some CSS selectors target body.dark-mode specifically
	        if (document.body) {
	            document.body.classList.add('dark-mode');
	        } else {
	            // Wait for body to be available, but only listen once to avoid memory leaks
	            document.addEventListener('DOMContentLoaded', function applyDarkModeToBody() {
	                document.body.classList.add('dark-mode');
	            }, { once: true });
	        }
	    }
	})();

	// ============================================================================
	// SECTION 3: FIREBASE CONFIGURATION
	// ============================================================================
	// Why: Firebase config is stored here instead of environment variables because:
	// 1. These are public identifiers (safe to expose in client-side code)
	// 2. Security is handled by Firebase Security Rules, not by hiding these values
	// 3. Simplifies deployment as a static site without needing a build process
	const firebaseConfig = {
	  apiKey: "AIzaSyA5k5pOZjWTrV3b1f51-aWH2AgDUY-p5hE",
	  authDomain: "life-akuk095.firebaseapp.com",
	  databaseURL: "https://life-akuk095-default-rtdb.europe-west1.firebasedatabase.app",
	  projectId: "life-akuk095",
	  storageBucket: "life-akuk095.firebasestorage.app",
	  messagingSenderId: "80383828301",
	  appId: "1:80383828301:web:7c001b7375f63fc5055704",
	};

	// ============================================================================
	// SECTION 4: CUSTOM DIALOG UTILITIES
	// ============================================================================
	// Why: Replacing browser's native alert/confirm/prompt with custom dialogs because:
	// 1. Native dialogs block the entire browser and can't be styled
	// 2. They don't support dark mode or our app's theme
	// 3. Custom dialogs provide better UX with animations and consistent design
	// 4. They return Promises for better async/await compatibility

	/**
	 * Custom alert dialog - replaces window.alert()
	 * Why async: Returns a Promise so callers can await the user's acknowledgment
	 */
function customAlert(message, title = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'custom-dialog';
        
        let html = '';
        if (title) {
            html += `<div class="custom-dialog-title">${title}</div>`;
        }
        html += `<div class="custom-dialog-message">${message}</div>`;
        html += `<div class="custom-dialog-buttons">
            <button class="custom-dialog-button primary">OK</button>
        </div>`;
        
        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Why 10ms delay: Allows browser to render the element before adding 'show' class
        // This enables CSS transitions to work properly (can't transition from non-existent to visible)
        setTimeout(() => overlay.classList.add('show'), 10);

        const closeDialog = () => {
            overlay.classList.remove('show');

            // Why 200ms delay: Matches CSS transition duration for fade-out animation
            // Removing from DOM immediately would skip the closing animation
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve();
            }, 200);
        };

        dialog.querySelector('.custom-dialog-button').addEventListener('click', closeDialog);

        // Why allow overlay click to close: Standard UX pattern - clicking outside dismisses modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDialog();
        });
    });
}

	/**
	 * Custom confirm dialog - replaces window.confirm()
	 * Why customizable button text: Allows context-specific actions like "Delete" instead of generic "OK"
	 * Returns: Promise<boolean> - true if confirmed, false if cancelled
	 */
	function customConfirm(message, title = '', confirmText = 'OK') {
	    return new Promise((resolve) => {
	        const overlay = document.createElement('div');
	        overlay.className = 'custom-dialog-overlay';

	        const dialog = document.createElement('div');
	        dialog.className = 'custom-dialog';

	        let html = '';
	        if (title) {
	            html += `<div class="custom-dialog-title">${title}</div>`;
	        }
	        html += `<div class="custom-dialog-message">${message}</div>`;

	        // Why check confirmText for dangerous words: Automatically applies red 'destructive' styling
	        // to warn users about potentially dangerous actions like deleting data
	        const isDangerous = confirmText.toLowerCase().includes('delete') || confirmText.toLowerCase().includes('remove');
	        const buttonClass = isDangerous ? 'destructive' : 'primary';

	        html += `<div class="custom-dialog-buttons">
	            <button class="custom-dialog-button" data-result="false">Cancel</button>
	            <button class="custom-dialog-button ${buttonClass}" data-result="true">${confirmText}</button>
	        </div>`;

	        dialog.innerHTML = html;
	        overlay.appendChild(dialog);
	        document.body.appendChild(overlay);

	        setTimeout(() => overlay.classList.add('show'), 10);

	        const closeDialog = (result) => {
	            overlay.classList.remove('show');
	            setTimeout(() => {
	                document.body.removeChild(overlay);
	                resolve(result);
	            }, 200);
	        };

	        // Why use data-result attribute: Cleanly maps button clicks to boolean results
	        // without needing separate handlers for each button
	        dialog.querySelectorAll('.custom-dialog-button').forEach(btn => {
	            btn.addEventListener('click', () => {
	                closeDialog(btn.dataset.result === 'true');
	            });
	        });

	        // Why overlay click returns false: Clicking outside should cancel, not confirm
	        // Prevents accidental confirmations of destructive actions
	        overlay.addEventListener('click', (e) => {
	            if (e.target === overlay) closeDialog(false);
	        });
	    });
	}

	/**
	 * Custom prompt dialog - replaces window.prompt()
	 * Why include defaultValue: Pre-fills input for editing existing values
	 * Returns: Promise<string|null> - user input or null if cancelled
	 */
	function customPrompt(message, defaultValue = '', title = '') {
	    return new Promise((resolve) => {
	        const overlay = document.createElement('div');
	        overlay.className = 'custom-dialog-overlay';

	        const dialog = document.createElement('div');
	        dialog.className = 'custom-dialog';

	        let html = '';
	        if (title) {
	            html += `<div class="custom-dialog-title">${title}</div>`;
	        }
	        html += `<div class="custom-dialog-message">${message}</div>`;
	        html += `<input type="text" class="custom-dialog-input" value="${defaultValue}" placeholder="${defaultValue}">`;
	        html += `<div class="custom-dialog-buttons">
	            <button class="custom-dialog-button" data-result="cancel">Cancel</button>
	            <button class="custom-dialog-button primary" data-result="ok">OK</button>
	        </div>`;

	        dialog.innerHTML = html;
	        overlay.appendChild(dialog);
	        document.body.appendChild(overlay);

	        const input = dialog.querySelector('.custom-dialog-input');

	        // Why focus and select in setTimeout: Ensures input is ready in DOM before manipulating it
	        // Why select(): Auto-selects text so user can immediately start typing to replace it
	        setTimeout(() => {
	            overlay.classList.add('show');
	            input.focus();
	            input.select();
	        }, 10);

	        const closeDialog = (result) => {
	            overlay.classList.remove('show');
	            setTimeout(() => {
	                document.body.removeChild(overlay);
	                resolve(result);
	            }, 200);
	        };

	        dialog.querySelectorAll('.custom-dialog-button').forEach(btn => {
	            btn.addEventListener('click', () => {
	                if (btn.dataset.result === 'ok') {
	                    // Why return null for empty input: Matches native prompt() behavior
	                    // Allows callers to distinguish between cancelled and empty input
	                    closeDialog(input.value || null);
	                } else {
	                    closeDialog(null);
	                }
	            });
	        });

	        // Why keyboard shortcuts: Standard UX - Enter submits, Escape cancels
	        // Allows power users to complete actions without mouse
	        input.addEventListener('keydown', (e) => {
	            if (e.key === 'Enter') {
	                closeDialog(input.value || null);
	            } else if (e.key === 'Escape') {
	                closeDialog(null);
	            }
	        });

	        // Why overlay click returns null: Clicking outside = cancellation
	        overlay.addEventListener('click', (e) => {
	            if (e.target === overlay) closeDialog(null);
	        });
	    });
	}
	// ============================================================================
	// SECTION 5: FIREBASE INITIALIZATION
	// ============================================================================
	const app = initializeApp(firebaseConfig);
	const database = getDatabase(app);
	const auth = getAuth(app);

	// ============================================================================
	// SECTION 6: GLOBAL STATE MANAGEMENT
	// ============================================================================
	// Why global variables: Shared state across multiple functions and event handlers
	// Alternative would be a state management library, but that adds complexity for a single-page app

	// Authentication state
	let currentUser = null;  // Populated by onAuthStateChanged listener

	// Guide/Document state
	// Why localStorage for currentGuideId: Persists which guide is open across page refreshes
	let currentGuideId = localStorage.getItem('currentGuideId') || null;

	// Reminder & Timer state
	// Why object format for skillReminders: Allows O(1) lookup by 'catIndex-skillIndex' key
	// Format: { 'catIndex-skillIndex': { enabled: true, items: { 'itemIndex': 'HH:MM' } } }
	let skillReminders = {};
	let itemTimers = {};  // Stores active setTimeout references for clearing

	// Journal state
	let currentJournalEntryId = null;
	let currentJournalData = {};  // Temporary storage while editing
	
	// Default data structure
	let categories = [
	    {
	        name: "Health & Body", 
	        icon: "💪", 
	        skills: [
	            {
	                title: "Basic Hygiene", 
	                icon: "🧼", 
					bulletStyle: "checkbox",
	                items: ["Brush teeth twice daily", "Shower regularly", "Wash hands before eating"]
	            }
	        ]
	    },
	    {
        name: "Daily Living", 
        icon: "🏡", 
        skills: [
            {
                title: "Household Basics", 
                icon: "🧹", 
                items: ["Do laundry", "Clean regularly", "Take out trash"]
            }
        ]
    }
];

// HOME PAGE BUTTON SETUP (outside populateHomePage)
const homeSearchBtn = document.getElementById('homeSearchBtn');
const homeSearchOverlay = document.getElementById('homeSearchOverlay');
const homeSearchClose = document.getElementById('homeSearchClose');
const homeSearchInputFull = document.getElementById('homeSearchInputFull');
const homeSearchResults = document.getElementById('homeSearchResults');

if (homeSearchBtn && homeSearchOverlay) {
    homeSearchBtn.addEventListener('click', () => {
        homeSearchOverlay.classList.add('show');
        if (homeSearchInputFull) homeSearchInputFull.focus();
    });
}

if (homeSearchClose) {
    homeSearchClose.addEventListener('click', () => {
        homeSearchOverlay.classList.remove('show');
        if (homeSearchInputFull) homeSearchInputFull.value = '';
        if (homeSearchResults) homeSearchResults.innerHTML = '';
    });
}

if (homeSearchInputFull) {
    homeSearchInputFull.addEventListener('input', async (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            homeSearchResults.innerHTML = '';
            return;
        }
        
        if (!currentUser) return;
        
        const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
        const guides = guidesSnapshot.val() || {};
        
        let results = [];
        
        Object.keys(guides).forEach(guideId => {
            const guide = guides[guideId];
            const guideTitle = guide.appTitle || '';
            const guideSubtitle = guide.appSubtitle || '';
            
            if (guideTitle.toLowerCase().includes(searchTerm) || 
                guideSubtitle.toLowerCase().includes(searchTerm)) {
                results.push({
                    type: 'guide',
                    id: guideId,
                    title: guideTitle,
                    subtitle: guideSubtitle,
                    icon: guide.appIcon || '📄',
                    color: guide.themeColor || '#3498db'
                });
            }
        });
        
        if (results.length === 0) {
            homeSearchResults.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px 0;">No results found</div>';
        } else {
            homeSearchResults.innerHTML = results.map(result => `
                <div class="search-result-item" data-guide-id="${result.id}" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, ${result.color}dd, ${result.color}); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                        ${result.icon}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 14px; font-weight: 500; color: #2c3e50; margin-bottom: 2px;">${result.title}</div>
                        <div style="font-size: 12px; color: #9ca3af;">${result.subtitle}</div>
                    </div>
                </div>
            `).join('');
            
            document.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const guideId = item.dataset.guideId;
                    switchGuide(guideId);
                    homeSearchOverlay.classList.remove('show');
                    homeSearchInputFull.value = '';
                    homeSearchResults.innerHTML = '';
                    
                    document.getElementById('homePage').classList.remove('active');
                    document.querySelector('.container').style.display = 'block';
                    document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
                    document.querySelectorAll('.bottom-nav-item')[0].classList.add('active');
                    
                    setTimeout(() => {
                        const backBtn = document.getElementById('headerBackBtn');
                        if (backBtn) backBtn.style.display = 'flex';
                    }, 100);
                });
            });
        }
    });
}


// HOME PAGE BUTTONS - Set up once on page load
document.addEventListener('DOMContentLoaded', () => {
    const homeSearchBtn = document.getElementById('homeSearchBtn');
    const homeSearchOverlay = document.getElementById('homeSearchOverlay');
    const homeSearchClose = document.getElementById('homeSearchClose');
    const homeSearchInputFull = document.getElementById('homeSearchInputFull');
    const homeSearchResults = document.getElementById('homeSearchResults');

    if (homeSearchBtn && homeSearchOverlay) {
        homeSearchBtn.addEventListener('click', () => {
            homeSearchOverlay.classList.add('show');
            if (homeSearchInputFull) homeSearchInputFull.focus();
        });
    }

    if (homeSearchClose) {
        homeSearchClose.addEventListener('click', () => {
            homeSearchOverlay.classList.remove('show');
            if (homeSearchInputFull) homeSearchInputFull.value = '';
            if (homeSearchResults) homeSearchResults.innerHTML = '';
        });
    }

    if (homeSearchInputFull) {
        homeSearchInputFull.addEventListener('input', async (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (!searchTerm) {
                homeSearchResults.innerHTML = '';
                return;
            }
            
            if (!currentUser) return;
            
            const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
            const guides = guidesSnapshot.val() || {};
            
            let results = [];
            
            Object.keys(guides).forEach(guideId => {
                const guide = guides[guideId];
                const guideTitle = guide.appTitle || '';
                const guideSubtitle = guide.appSubtitle || '';
                
                if (guideTitle.toLowerCase().includes(searchTerm) || 
                    guideSubtitle.toLowerCase().includes(searchTerm)) {
                    results.push({
                        type: 'guide',
                        id: guideId,
                        title: guideTitle,
                        subtitle: guideSubtitle,
                        icon: guide.appIcon || '📄',
                        color: guide.themeColor || '#3498db'
                    });
                }
            });
            
            if (results.length === 0) {
                homeSearchResults.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px 0;">No results found</div>';
            } else {
                homeSearchResults.innerHTML = results.map(result => `
                    <div class="search-result-item" data-guide-id="${result.id}" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, ${result.color}dd, ${result.color}); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                            ${result.icon}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; font-weight: 500; color: #2c3e50; margin-bottom: 2px;">${result.title}</div>
                            <div style="font-size: 12px; color: #9ca3af;">${result.subtitle}</div>
                        </div>
                    </div>
                `).join('');
                
                document.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const guideId = item.dataset.guideId;
                        switchGuide(guideId);
                        homeSearchOverlay.classList.remove('show');
                        homeSearchInputFull.value = '';
                        homeSearchResults.innerHTML = '';
                        
                        document.getElementById('homePage').classList.remove('active');
                        document.querySelector('.container').style.display = 'block';
                        document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
                        document.querySelectorAll('.bottom-nav-item')[0].classList.add('active');
                        
                        setTimeout(() => {
                            const backBtn = document.getElementById('headerBackBtn');
                            if (backBtn) backBtn.style.display = 'flex';
                        }, 100);
                    });
                });
            }
        });
    }

    const homeCreateBtn = document.getElementById('homeCreateBtn');
    if (homeCreateBtn) {
        homeCreateBtn.addEventListener('click', () => {
            createNewGuide();
        });
    }

    // Filter items event listeners are now added dynamically in populateFilterNavigation()

    const homeMenuBtn = document.getElementById('homeMenuBtn');
    const homeDropdownMenu = document.getElementById('homeDropdownMenu');
    const homeSelectMenuBtn = document.getElementById('homeSelectMenuBtn');
    const homeCreateCollectionMenuBtn = document.getElementById('homeCreateCollectionMenuBtn');

    if (homeMenuBtn && homeDropdownMenu) {
        homeMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            homeDropdownMenu.classList.toggle('show');
            
            if (homeSelectMenuBtn) {
                homeSelectMenuBtn.innerHTML = homeSelectMode 
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Cancel`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>Select`;
            }
        });
    }

    if (homeSelectMenuBtn) {
        homeSelectMenuBtn.addEventListener('click', () => {
            toggleSelectMode();
            homeDropdownMenu.classList.remove('show');
        });
    }

    if (homeCreateCollectionMenuBtn) {
        homeCreateCollectionMenuBtn.addEventListener('click', async () => {
            homeDropdownMenu.classList.remove('show');
            await createNewCollection();
        });
    }

    const homeCreateTypeMenuBtn = document.getElementById('homeCreateTypeMenuBtn');
    if (homeCreateTypeMenuBtn) {
        homeCreateTypeMenuBtn.addEventListener('click', async () => {
            homeDropdownMenu.classList.remove('show');
            await createNewType();
        });
    }

    document.addEventListener('click', (e) => {
        if (homeDropdownMenu && homeMenuBtn && !homeMenuBtn.contains(e.target) && !homeDropdownMenu.contains(e.target)) {
            homeDropdownMenu.classList.remove('show');
        }
    });
});

// Check if user is logged in
auth.onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById('loginScreen');
    const signupScreen = document.getElementById('signupScreen');
    const appContainer = document.getElementById('app');
    
    if (user) {
        currentUser = user;
        
        // Hide both auth screens
        loginScreen.classList.remove('show');
        signupScreen.classList.remove('show');
        
        setTimeout(() => {
            loginScreen.style.display = 'none';
            signupScreen.style.display = 'none';
            appContainer.style.display = 'block';
            setTimeout(() => appContainer.classList.add('show'), 10);
        }, 300);
        
        loadUserData(user.uid);
        
// Restore last active page from localStorage, default to home
        const lastPage = localStorage.getItem('currentPage') || 'guides';
        const homePage = document.getElementById('homePage');
        const templatesPage = document.getElementById('templatesPage');
        const profilePage = document.getElementById('profilePage');
        const settingsPage = document.getElementById('settingsPage');
        const mainContainer = document.querySelector('.container');
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
        
        // Remove all active states
        bottomNavItems.forEach(nav => nav.classList.remove('active'));
        
        // Hide all pages first
        mainContainer.style.display = 'none';
        if (homePage) homePage.classList.remove('active');
        if (templatesPage) templatesPage.classList.remove('active');
        if (profilePage) profilePage.classList.remove('active');
        if (settingsPage) settingsPage.classList.remove('active');
        
        if (lastPage === 'guides') {
            // Show home page with guides list
            if (homePage) {
                homePage.classList.add('active');
                populateHomePage();
            }
            bottomNavItems[0]?.classList.add('active');
        } else if (lastPage === 'templates') {
            if (templatesPage) {
                templatesPage.classList.add('active');
            }
            bottomNavItems[1]?.classList.add('active');
        } else if (lastPage === 'profile') {
            if (profilePage) {
                profilePage.classList.add('active');
                const profileEmail = document.getElementById('profileEmail');
                if (profileEmail && currentUser) {
                    profileEmail.textContent = currentUser.email;
                }
            }
            bottomNavItems[2]?.classList.add('active');
        } else if (lastPage === 'settings') {
            if (settingsPage) {
                settingsPage.classList.add('active');
            }
            bottomNavItems[3]?.classList.add('active');
        } else {
            // Fallback: go to home page
            if (homePage) {
                homePage.classList.add('active');
                populateHomePage();
            }
            bottomNavItems[0]?.classList.add('active');
        }
    } else {
        // User is NOT logged in
        currentUser = null;
        appContainer.classList.remove('show');
        appContainer.style.display = 'none';
        
        // Show login screen
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.classList.add('show'), 10);
    }
});

// App/Guide UI state
let checkedItems = {};  // Tracks which checklist items are checked
let editMode = false;  // Whether user is in edit mode (can reorder/delete items)
let activeTabIndex = 0;  // Currently active category tab

// Guide appearance settings (loaded from Firebase for each guide)
let appIcon = "📚";
let appTitle = "Short note";
let appSubtitle = "Double tap to add description";

// Why default grey (#607d8b): Neutral color that works well in both light and dark mode
let themeColor = '#607d8b';

// Layout & Display options
// Why three layout modes: Provides flexibility for different use cases
// 'vertical' = stacked cards, 'horizontal' = side-by-side, 'headings' = list view
let layoutMode = 'vertical';

// Why sticky mode: Mimics physical sticky notes for visual familiarity
let stickyMode = 'white';  // Options: 'yellow', 'blue', 'pink', 'white'

// Auto-refresh feature
// Why auto-refresh: Allows daily checklists to reset automatically at a specific time
let autoRefreshEnabled = false;
let autoRefreshTime = "00:00";  // 24-hour format (HH:MM)

// Visual customization
let headerImage = null;  // Base64 or URL for header background image
let wallpaperUrl = '';  // Background wallpaper URL

// Collection/Filter state
// Why localStorage: Remembers user's last selected collection filter across sessions
let selectedCollection = localStorage.getItem('selectedCollection') || null;
let selectedFilter = 'all';  // Filter type: 'all', 'completed', 'incomplete'

// ============================================================================
// Drag and Drop State
// ============================================================================
// Why separate drag state variables: Needed to track what's being dragged,
// from where, and where it can be dropped during reordering operations
let draggedCard = null;  // The DOM element being dragged
let draggedCatIndex = null;  // Source category index
let draggedSkillIndex = null;  // Source skill index within category
let draggedElement = null;  // Current draggable element reference
let placeholder = null;  // Visual placeholder showing drop position
let draggedTab = null;  // For tab reordering
let draggedTabIndex = null;  // Source tab index

// ============================================================================
// SECTION 7: APP CONSTANTS & THEME DATA
// ============================================================================

// Color Theme Presets
// Why predefined themes: Provides curated color combinations that look professional
// and work well together, rather than requiring users to pick colors manually
const colorThemes = [
    { name: 'Forest', primary: '#27ae60', secondary: '#f39c12' },          // Green + Amber
    { name: 'Cherry', primary: '#e74c3c', secondary: '#c0392b' },          // Red + Dark Red
    { name: 'Tropical', primary: '#16a085', secondary: '#23a88e' },        // Teal + Gold
    { name: 'Tropical2', primary: '#f39c12', secondary: '#f2b555' },        
	{ name: 'Slate', primary: '#34495e', secondary: '#7f8c8d' },           // Dark Blue + Gray
    { name: 'Lavender Sky', primary: '#9b59b6', secondary: '#3498db' },     // Purple + Sky Blue
	{ name: 'Serene', primary: '#3EACA8', secondary: '#46b0ac' },  // Teal + Brown from your palette
	{ name: 'Serene2', primary: '#5A5050', secondary: '#756767' },  // Teal + Brown from your palet
	{ name: 'Dusty Rose', primary: '#C9A0A0', secondary: '#A88080' },
    { name: 'Rose Clay', primary: '#D98C8C', secondary: '#A96565' },
	{ name: 'Elegant Burgundy', primary: '#8B4359', secondary: '#6B3349' },
    { name: 'Deep Teal', primary: '#4A7C7E', secondary: '#355E60' },
	{ name: 'Elegant Navy', primary: '#1E3A5F', secondary: '#2C5F8D' },
    { name: 'Stormy Blue', primary: '#6A8CA5', secondary: '#456274' },
	{ name: 'Slate Blue', primary: '#6B7C93', secondary: '#4A5F7F' },
    { name: 'Steel Blue', primary: '#607D8B', secondary: '#455A64' },
	{ name: 'Charcoal', primary: '#5C6B73', secondary: '#3D4A52' },
	{ name: 'Dark', primary: '#0A0A0A', secondary: '#000000' }
];

// SVG Icon Library
// Why SVG paths instead of icon fonts: SVGs are more reliable, don't require font loading,
// and can be styled/animated with CSS. Each path is a 24x24 viewBox coordinate system
// Why categorized: Organized by theme to help users find relevant icons quickly
const svgIcons = [
    // Activity & Health
    { name: 'Tracking', path: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2' },
    { name: 'Alarm', path: 'M12 9v4l2 2M5 3 2 6m17 0-3-3M6.38 18.7 4 21m13.64-2.33L20 21', circles: [{ cx: '12', cy: '13', r: '8' }] },
    { name: 'Album', path: 'M11 3 11 11 14 8 17 11 17 3', rect: { width: '18', height: '18', x: '3', y: '3', rx: '2', ry: '2' } },
    { name: 'Ambulance', path: 'M10 10H6M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14M8 8v4M9 18h6', circles: [{ cx: '17', cy: '18', r: '2' }, { cx: '7', cy: '18', r: '2' }] },
    { name: 'Anchor', path: 'M12 22V8M5 12H2a10 10 0 0 0 20 0h-3', circles: [{ cx: '12', cy: '5', r: '3' }] },
    { name: 'Aperture', path: 'm14.31 8 5.74 9.94M9.69 8h11.48m-13.79 4 5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83m13.79-4-5.74 9.94', circles: [{ cx: '12', cy: '12', r: '10' }] },
    { name: 'Archive', path: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4', rect: { width: '20', height: '5', x: '2', y: '3', rx: '1' } },
    
    // Food & Nutrition
    { name: 'Apple', path: 'M12 6.528V3a1 1 0 0 1 1-1h0M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21' },
    { name: 'Pizza', path: 'm12 14-1 1m2.75 4.25-1.25 1.42M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12M18.8 9.3a1 1 0 0 0 2.1 7.7M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z' },
    { name: 'Fish', path: 'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6ZM18 12v.5M16 17.93a9.77 9.77 0 0 1 0-11.86M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4m-.02 12.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98' },
    { name: 'Pounds', path: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76ZM8 12h4M10 16V9.5a2.5 2.5 0 0 1 5 0M8 16h7' },
    { name: 'Ban', path: 'M4.929 4.929 19.07 19.071', circles: [{ cx: '12', cy: '12', r: '10' }] },
    { name: 'Food Bowl', path: 'M7 21h10M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1m-3.38 0 4-4M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2' },
    { name: 'Soup', path: 'M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM7 21h10M19.5 12 22 6M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62' },
    { name: 'Cooking Pot', path: 'M2 12h20M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8m2-4 16-4m-14.14 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8' },
    { name: 'Chef Hat', path: 'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1ZM6 17h12' },
    { name: 'Coffee', path: 'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2' },
    { name: 'Utensils', path: 'm16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7m-20.9-.2 6.4-6.3m10.6-10.5-7 7' },
    
    // Finance & Banking
    { name: 'Bank', path: 'M10 18v-7M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949zM14 18v-7M18 18v-7M3 22h18M6 18v-7' },
    { name: 'Credit Card', path: 'M2 10h20', rect: { width: '20', height: '14', x: '2', y: '5', rx: '2' } },
    { name: 'Receipt', path: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM8 13h5M10 17V9.5a2.5 2.5 0 0 1 5 0M8 17h7' },
    
    // Cleaning & Maintenance
    { name: 'Brush Clean', path: 'm16 22-1-4M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233zm3 8 1-4' },
    
    // Transportation
    { name: 'Fuel', path: 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16M2 21h13M3 9h11' },
    { name: 'Dashboard', path: 'm12 14 4-4M3.34 19a10 10 0 1 1 17.32 0' },
    { name: 'Train', path: 'M4 11h16M12 3v8m-4 8-2 3m12 3-2-3M8 15h.01M16 15h.01', rect: { width: '16', height: '16', x: '4', y: '3', rx: '2' } },
    { name: 'Cable Car', path: 'M10 3h.01M14 2h.01m-12 7 20-5M12 12V6.5', rect: { width: '16', height: '10', x: '4', y: '12', rx: '3' }, extraPath: 'M9 12v5M15 12v5M4 17h16' },
    
    // Habits & Lifestyle
    { name: 'Cigarette', path: 'M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14M18 8c0-2.5-2-2.5-2-5M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M22 8c0-2.5-2-2.5-2-5M7 12v4' },
    { name: 'Bed', path: 'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9' },
    { name: 'Fridge', path: 'M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6ZM5 10h14M15 7v6' },
    
    // Nature & Outdoor
    { name: 'Tree Palm', path: 'M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14' },
    { name: 'Camping', path: 'm14 5 3-3 3 3m-6 5 3-3 3 3M17 14V2M17 14H7l-5 8h20ZM8 14v8m1 0 5 8', circles: [{ cx: '4', cy: '4', r: '2' }] },
    { name: 'Target', path: 'M22 12h-4M6 12H2M12 6V2M12 22v-4', circles: [{ cx: '12', cy: '12', r: '10' }] },
    
    // Health & Medical
    { name: 'Medicine', path: 'M18 11h-4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h4M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7', rect: { width: '16', height: '5', x: '4', y: '2', rx: '1' } },
    
    // Technology
    { name: 'Laptop', path: 'M2 20h20', rect: { width: '18', height: '12', x: '3', y: '4', rx: '2', ry: '2' } },
    
    // Emotions
    { name: 'Smile', path: 'M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', circles: [{ cx: '12', cy: '12', r: '10' }] },
    { name: 'Laugh', path: 'M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12ZM9 9h.01M15 9h.01', circles: [{ cx: '12', cy: '12', r: '10' }] },

	{ name: 'Night', path: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z' },
    { name: 'Water', path: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z' },
    { name: 'Location', path: 'M12 2C8 2 5 5.13 5 9c0 5 7 13 7 13s7-8 7-13c0-3.87-3-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
    
    // Productivity
    { name: 'Reading', path: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z' },
    { name: 'Planning', path: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z' },
    { name: 'Focus', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-12c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z' },
    { name: 'Goals', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    
    // Learning & Growth
    { name: 'Study', path: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z' },
    { name: 'Gift', path: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z' },
    { name: 'Research', path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' },
    { name: 'Skills', path: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' },
    
    // Work & Career
    { name: 'Work', path: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z' },
    { name: 'Meeting', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { name: 'Email', path: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
    { name: 'Call', path: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z' },
    { name: 'Presentation', path: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z' },
    
    // Social & Relationships
    { name: 'Family', path: 'M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63C19.68 7.55 18.92 7 18.06 7h-.12c-.86 0-1.62.55-1.9 1.37L13.5 16H16v6h4zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h1.5v7h4z' },
    { name: 'Friends', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { name: 'Communication', path: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z' },
    { name: 'Date', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
    { name: 'Community', path: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z' },
    
    // Finance
    { name: 'Budget', path: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
    { name: 'Investment', path: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z' },
    { name: 'Shopping', path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' },
    { name: 'Bills', path: 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' },
    
    // Home & Living
    { name: 'Cleaning', path: 'M16 11h-1V3c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v8H8c-2.76 0-5 2.24-5 5v7h18v-7c0-2.76-2.24-5-5-5zm3 10h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H9v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H5v-5c0-1.65 1.35-3 3-3h8c1.65 0 3 1.35 3 3v5z' },
    { name: 'Cooking', path: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z' },
    { name: 'Gardening', path: 'M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C14.5 2.12 13.38 1 12 1S9.5 2.12 9.5 3.5l.02.19c-.4-.28-.89-.44-1.42-.44-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25zM12 5.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S9.5 9.38 9.5 8s1.12-2.5 2.5-2.5zM3 13c0 4.97 4.03 9 9 9 0-4.97-4.03-9-9-9z' },
    { name: 'Laundry', path: 'M9.17 16.83L14.83 11.17L13.41 9.76L9.17 14L7.76 12.59L6.34 14L9.17 16.83M18 2.01L6 2C4.89 2 4 2.89 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.89 19.1 2.01 18 2.01M18 20H6L6.01 4H18V20Z' },
    { name: 'Organization', path: 'M10 3H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8H4V5h6v6zm10-8h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8h-6V5h6v6zM10 13H4c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2zm0 8H4v-6h6v6zm10-8h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2zm0 8h-6v-6h6v6z' },
    
    // Transportation
    { name: 'Driving', path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' },
    { name: 'Walking', path: 'M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z' },
    { name: 'Cycling', path: 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z' },
    { name: 'Travel', path: 'M2.5 19h19v2h-19v-2zm7.9-3.5l7.9-7.9c.4-.4.4-1 0-1.4L14.5 2.5c-.4-.4-1-.4-1.4 0l-7.9 7.9c-.4.4-.4 1 0 1.4l3.8 3.8c.4.3 1 .3 1.4-.1z' },
    
    // Entertainment & Hobbies
    { name: 'Music', path: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z' },
    { name: 'Gaming', path: 'M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z' },
    { name: 'Movies', path: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z' },
    { name: 'Photography', path: 'M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z' },
    { name: 'Art', path: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' },
    
    // Self-Care & Wellness
    { name: 'Yoga', path: 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z' },
    { name: 'Skincare', path: 'M12 2C9.24 2 7 4.24 7 7c0 1.77.94 3.31 2.34 4.16L8.5 13h7l-.84-1.84C16.06 10.31 17 8.77 17 7c0-2.76-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-1 4h2v8h-2v-8z' },
    
    // Mind & Creativity
    { name: 'Journal', path: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z' },
    { name: 'Drawing', path: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' },
    { name: 'Brainstorm', path: 'M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z' },
    { name: 'Ideas', path: 'M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z' },
    
    // Digital Life
    { name: 'Video Call', path: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z' },
    { name: 'World', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' },
  
    // Nature & Environment
    { name: 'Outdoors', path: 'M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z' },
    
    // Time Management
    { name: 'Time', path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' },
    { name: 'Timer', path: 'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z' },
    { name: 'Routine', path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z' },
    { name: 'Morning', path: 'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95z' },
    
    // Health Tracking
    { name: 'Weight', path: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z' },
    { name: 'Mood', path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z' },
    
    // Food & Nutrition
    { name: 'Coffee', path: 'M2 21h18v-2H2v2zm2-8h14v-2H4v2zm18.5-5H20V4h1.5c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5zM4 4h14v4c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V4z' },
    
    // Mental Health
    { name: 'Abort', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z' },
    
    // Miscellaneous Life Actions
    { name: 'Thumbs-up', path: 'M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84C7 18.95 8.05 20 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z' },
    { name: 'Sleep', path: 'M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm0-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm12-3h-8v8H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' },
    { name: 'Connect', path: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z' }
];

// Skill card drag start
document.addEventListener('dragstart', (e) => {
    // Prevent dragging if any element is being edited
    if (document.querySelector('[contenteditable="true"]')) {
        e.preventDefault();
        return false;
    }
    
    if (e.target.classList.contains('skill-card') && !editMode && layoutMode === 'headings') {
        draggedCard = e.target;
        draggedCatIndex = parseInt(e.target.dataset.catIndex);
        draggedSkillIndex = parseInt(e.target.dataset.skillIndex);
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        
        const rect = e.target.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(e.target, offsetX, offsetY);
    }
    
    // Tab drag start
    if (e.target.classList.contains('nav-tab') && !editMode && e.target.draggable) {
        // Prevent dragging if any element is being edited
        if (document.querySelector('[contenteditable="true"]')) {
            e.preventDefault();
            return false;
        }
        
        draggedTab = e.target;
        draggedTabIndex = parseInt(e.target.dataset.catIndex);
        e.target.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    }
});

// Combined drag end
document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('skill-card')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.skill-card').forEach(card => {
            card.classList.remove('drag-over');
        });
        draggedCard = null;
    }
    
    if (e.target.classList.contains('nav-tab')) {
        e.target.style.opacity = '';
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.style.borderLeft = '';
        });
        draggedTab = null;
    }
});

// Combined drag over
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    
    // Skill cards
    if (draggedCard) {
        const target = e.target.closest('.skill-card');
        if (target && target !== draggedCard && target.dataset.catIndex === draggedCard.dataset.catIndex) {
            e.dataTransfer.dropEffect = 'move';
        }
    }
    
    // Tabs
    if (draggedTab) {
        const target = e.target.closest('.nav-tab');
        if (target && target !== draggedTab && target.draggable) {
            e.dataTransfer.dropEffect = 'move';
        }
    }
});

// Combined drag enter
document.addEventListener('dragenter', (e) => {
    // Skill cards
    if (draggedCard) {
        const target = e.target.closest('.skill-card');
        if (target && target !== draggedCard && target.dataset.catIndex === draggedCard.dataset.catIndex) {
            target.classList.add('drag-over');
        }
    }
    
    // Tabs
    if (draggedTab) {
        const target = e.target.closest('.nav-tab');
        if (target && target !== draggedTab && target.draggable) {
            target.style.borderLeft = '3px solid var(--primary-color)';
        }
    }
});

// Combined drag leave
document.addEventListener('dragleave', (e) => {
    // Skill cards
    if (draggedCard) {
        const target = e.target.closest('.skill-card');
        if (target) {
            target.classList.remove('drag-over');
        }
    }
    
    // Tabs
    if (draggedTab) {
        const target = e.target.closest('.nav-tab');
        if (target) {
            target.style.borderLeft = '';
        }
    }
});

// Combined drop
document.addEventListener('drop', (e) => {
    e.preventDefault();
    
    // Skill cards drop
    if (draggedCard) {
        const target = e.target.closest('.skill-card');
        if (target && target !== draggedCard && target.dataset.catIndex === draggedCard.dataset.catIndex) {
            const targetCatIndex = parseInt(target.dataset.catIndex);
            const targetSkillIndex = parseInt(target.dataset.skillIndex);
            
            const [movedSkill] = categories[draggedCatIndex].skills.splice(draggedSkillIndex, 1);
            categories[targetCatIndex].skills.splice(targetSkillIndex, 0, movedSkill);
            
            saveCategories();
            renderContent();
        }
    }
    
    // Tabs drop
    if (draggedTab) {
        const target = e.target.closest('.nav-tab');
        if (target && target !== draggedTab && target.draggable) {
            const targetIndex = parseInt(target.dataset.catIndex);
            
            const [movedCategory] = categories.splice(draggedTabIndex, 1);
            categories.splice(targetIndex, 0, movedCategory);
            
            if (activeTabIndex === draggedTabIndex) {
                activeTabIndex = targetIndex;
            } else if (draggedTabIndex < activeTabIndex && targetIndex >= activeTabIndex) {
                activeTabIndex--;
            } else if (draggedTabIndex > activeTabIndex && targetIndex <= activeTabIndex) {
                activeTabIndex++;
            }
            
            saveCategories();
            renderTabs();
            renderContent();
        }
    }
});

		
// ============================================================================
// DATA LOADING & PERSISTENCE
// ============================================================================

/**
 * Retry a Firebase operation with exponential backoff
 * @param {Function} operation - The async operation to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise} - Result of the operation
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

/**
 * Check if user is online
 * @returns {boolean} - True if online, false otherwise
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Load user's guide data from Firebase
 * Why async: Firebase operations are asynchronous, so we need to wait for data
 */
async function loadUserData(userId) {
    // Check internet connectivity first
    if (!isOnline()) {
        await customAlert('No internet connection detected. Please check your network and try again.', 'Connection Error');
        // Still try to show the app with default data
        applyTheme();
        renderHeader();
        renderTabs();
        renderContent();
        updateLayoutButton();
        setTimeout(() => applyHeaderImage(), 50);
        document.querySelector('.container').classList.add('loaded');
        return;
    }

    // Why hide container initially: Prevents flickering/layout shifts while data loads
    // Better to show smooth fade-in with complete data than partial content appearing
    document.querySelector('.container').classList.remove('loaded');
	document.querySelector('.container').style.opacity = '0';

    // Why check if guide exists: First-time users or new guides need default data
    // This ensures every user has a working guide even if they've never saved before
    try {
        const snapshot = await retryOperation(() => get(ref(database, `users/${userId}/guides/${currentGuideId}`)));
        if (!snapshot.exists()) {
            await retryOperation(() => set(ref(database, `users/${userId}/guides/${currentGuideId}`), {
                appTitle, appSubtitle, appIcon, categories, checkedItems, themeColor
            }));
        }
    } catch (error) {
        console.error('Error checking/creating guide:', error);
        // Continue to try loading data even if this fails
    }

    // Why Promise.all: Load all guide data in parallel instead of sequentially
    // This is much faster than loading one field at a time (hundreds of ms saved)
    // Wrap with retry logic to handle temporary network issues
    try {
        const results = await retryOperation(() => Promise.all([
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/categories`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/checkedItems`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/appTitle`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/appSubtitle`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/appIcon`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/themeColor`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/layoutMode`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/autoRefreshEnabled`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/autoRefreshTime`)),
	        get(ref(database, `users/${userId}/guides/${currentGuideId}/lastRefreshDate`)),
			get(ref(database, `users/${userId}/guides/${currentGuideId}/headerImage`)),
			get(ref(database, `users/${userId}/guides/${currentGuideId}/wallpaper`)),
			get(ref(database, `users/${userId}/guides/${currentGuideId}/skillReminders`)),
			get(ref(database, `users/${userId}/guides/${currentGuideId}/itemTimers`)),
	    ]));

        const [categoriesSnap, checkedSnap, titleSnap, subtitleSnap, iconSnap, themeSnap, layoutSnap, autoRefreshEnabledSnap, autoRefreshTimeSnap, lastRefreshSnap, headerImageSnap, wallpaperSnap, remindersSnap, timersSnap] = results;

			
		// Load categories
        if (categoriesSnap.val()) {
            categories = categoriesSnap.val();
        }
        
        // Load checked items
        if (checkedSnap.val()) {
            checkedItems = checkedSnap.val();
        }
        
        // Load app title
        if (titleSnap.val()) {
            appTitle = titleSnap.val();
        }
        
        // Load app subtitle
        if (subtitleSnap.val()) {
            appSubtitle = subtitleSnap.val();
        }
        
        // Load app icon
        if (iconSnap.val() !== null) {
            appIcon = iconSnap.val();
        }
        
        // Load theme color
        if (themeSnap.val()) {
            themeColor = themeSnap.val();
        } else {
            themeColor = '#607d8b';
        }
        
        // Load layout mode
        if (layoutSnap.val()) {
            layoutMode = layoutSnap.val();
        }

        // Load auto-refresh settings
        if (autoRefreshEnabledSnap.val() !== null) {
            autoRefreshEnabled = autoRefreshEnabledSnap.val();
        }
        if (autoRefreshTimeSnap.val()) {
            autoRefreshTime = autoRefreshTimeSnap.val();
        }

		// Load header image BEFORE applying theme
		if (headerImageSnap.val()) {
		    headerImage = headerImageSnap.val();
		    console.log('Header image loaded from Firebase, length:', headerImage.length);
		} else {
		    headerImage = null;
		    console.log('No header image in Firebase');
		}
		
		// Load wallpaper BEFORE applying theme
		if (wallpaperSnap.exists()) {
		    wallpaperUrl = wallpaperSnap.val();
		    console.log('Wallpaper loaded from Firebase, length:', wallpaperUrl.length);
		} else {
		    wallpaperUrl = '';
		    console.log('No wallpaper in Firebase');
		}

		// Load skill reminders
		if (remindersSnap.val()) {
		    skillReminders = remindersSnap.val();
		}

		// Load item timers
		if (timersSnap.val()) {
		    itemTimers = timersSnap.val();
		}
			
        // Check if we need to auto-refresh
        checkAndAutoRefresh(lastRefreshSnap.val());

        // Apply theme (now knows if headerImage and wallpaper exist)
        applyTheme();

        // Render everything
        renderHeader();
        renderTabs();
        renderContent();
        updateLayoutButton();

        // Apply header image AFTER header is rendered
        setTimeout(() => applyHeaderImage(), 50);

        // Apply wallpaper AFTER content area is rendered
        setTimeout(() => applyWallpaper(), 50);

        // Show container with loaded data
        setTimeout(() => {
            document.querySelector('.container').style.opacity = '1';
        }, 100);

        // Hide spinner
        const spinner = document.getElementById('refreshSpinner');
        if (spinner) spinner.classList.remove('show');

    } catch (error) {
        console.error('Error loading user data:', error);

        // Determine error type and show appropriate message
        let errorMessage = 'Failed to load your data. ';
        let errorTitle = 'Connection Error';

        if (!isOnline()) {
            errorMessage += 'Your internet connection appears to be offline. Please check your network and try refreshing the page.';
        } else if (error.code === 'PERMISSION_DENIED') {
            errorMessage += 'Access denied. Please check your Firebase security rules or re-authenticate.';
            errorTitle = 'Permission Error';
        } else if (error.code === 'UNAVAILABLE' || error.message?.includes('network')) {
            errorMessage += 'The server is temporarily unavailable. Please try again in a moment.';
        } else {
            errorMessage += 'An unexpected error occurred. Please try refreshing the page. If the problem persists, contact support.';
        }

        // Show error message to user
        await customAlert(errorMessage, errorTitle);

        try {
            await loadItemTimers();
        } catch (timerError) {
            console.error('Error loading timers:', timerError);
        }

        // Still try to show the app with default data
        applyTheme();
        renderHeader();
        renderTabs();
        renderContent();
        updateLayoutButton();
        setTimeout(() => applyHeaderImage(), 50);
        document.querySelector('.container').classList.add('loaded');
    }
}

/**
 * Switch to a different guide/document
 * @param {string} guideId - The unique identifier of the guide to switch to
 *
 * What: Changes the currently active guide and loads its data
 * Why: Users can have multiple guides (checklists, journals, etc.) and need to switch between them
 * How: Updates global state, persists to localStorage, reloads data from Firebase
 */
function switchGuide(guideId) {
    // Update global current guide reference
    currentGuideId = guideId;

    // Why localStorage: Remembers which guide user was viewing if they refresh the page
    localStorage.setItem('currentGuideId', guideId);

    // Why set to 'guides': Keeps the home/guides tab highlighted in bottom navigation
    // even when viewing a specific guide (maintains navigation context)
    localStorage.setItem('currentPage', 'guides');

    // Load all data for this guide from Firebase
    loadUserData(currentUser.uid);

    // Why 100ms delay: Ensures DOM is ready before manipulating back button
    // The guide view needs to render before we can access its header elements
    setTimeout(() => {
        const backBtn = document.getElementById('headerBackBtn');
        if (backBtn) {
            // Show back button to allow returning to guide list
            backBtn.style.display = 'flex';
        }
    }, 100);
}
	
// ============================================================================
// THEME & COLOR MANAGEMENT
// ============================================================================

/**
 * Apply the current theme color to the entire app
 * Why this function exists: Centralizes all theme-related styling so changing
 * the theme only requires calling this one function
 */
function applyTheme() {
    const theme = colorThemes.find(t => t.primary === themeColor);
    let primaryColor, secondaryColor;

    // Why check preset vs custom: Preset themes have carefully chosen color pairs,
    // but we also support custom colors by auto-generating a complementary secondary color
    if (theme) {
        // Use curated preset theme with designer-chosen color pairs
        primaryColor = theme.primary;
        secondaryColor = theme.secondary;

    } else {
        // Custom color selected - auto-generate secondary color
        primaryColor = themeColor;
        const hex = themeColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Why subtract 30 from RGB: Creates a slightly darker shade for depth
        // Not too dark (would look black), not too subtle (wouldn't show contrast)
        const darkerR = Math.max(0, r - 30);
        const darkerG = Math.max(0, g - 30);
        const darkerB = Math.max(0, b - 30);

        secondaryColor = '#' + [darkerR, darkerG, darkerB]
            .map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // Determine if the theme is light
    const isLight = isLightColor(primaryColor);

    // Why special handling for light themes: Light colors need much darker secondaries
    // for sufficient contrast (WCAG accessibility). 30-point darker isn't enough.
    if (isLight) {
        const hex = primaryColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        // Why multiply by 0.7: Creates 30% darker color for readable text on light backgrounds
        const darkerR = Math.max(0, Math.floor(r * 0.7));
        const darkerG = Math.max(0, Math.floor(g * 0.7));
        const darkerB = Math.max(0, Math.floor(b * 0.7));

        secondaryColor = '#' + [darkerR, darkerG, darkerB]
            .map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // Why CSS variables: Allows entire app to react to theme changes without
    // manually updating every element. CSS can reference these variables.
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.documentElement.style.setProperty('--secondary-color', secondaryColor);

    // Why 30% opacity for shadows: Subtle depth without being too heavy or distracting
    const hex = secondaryColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    document.documentElement.style.setProperty('--shadow-color', `rgba(${r}, ${g}, ${b}, 0.3)`);

    // Why use secondary for light themes: Primary color would be too light for active indicators
    document.documentElement.style.setProperty('--tab-active-color', isLight ? secondaryColor : primaryColor);

    document.documentElement.style.setProperty('--save-btn-color', isLight ? secondaryColor : primaryColor);

    // Why check for wallpaper: Background should be transparent when wallpaper is set,
    // otherwise wallpaper wouldn't show through
    if (!wallpaperUrl) {
        document.body.style.background = '#f0f2f5';
    } else {
        document.body.style.background = 'transparent';
    }        
       
    // Adjust floating button
    const floatingBtn = document.getElementById('layoutBtn');
    if (floatingBtn) {
        floatingBtn.style.backgroundColor = secondaryColor;
    }
    
    // Apply header styling - but skip gradient if image exists
    const header = document.querySelector('.header');
    if (header) {
        if (!headerImage) {
            // No image - apply gradient
            header.style.background = `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`;
        }
        // Always set text colors
        header.style.color = isLight ? '#2c3e50' : 'white';
        
        // Adjust all text elements in header
        const headerTexts = header.querySelectorAll('h1, p, .editable');
        headerTexts.forEach(el => {
            el.style.color = isLight ? '#2c3e50' : 'white';
        });
        
        // Adjust button colors in header
        const headerButtons = header.querySelectorAll('.edit-btn, .guide-menu-btn');
        headerButtons.forEach(btn => {
            btn.style.color = isLight ? '#2c3e50' : 'white';
        });
    }
}
	
/**
 * Toggle the color picker menu visibility
 * @param {Event} e - Click event
 *
 * What: Shows or hides the custom color picker interface
 * Why: Allows users to choose custom colors beyond the preset themes
 */
function toggleColorPicker(e) {
    // Why stopPropagation: Prevents click from bubbling to document body
    // which would immediately close the menu we're trying to open
    e.stopPropagation();

    const picker = document.getElementById('colorPickerMenu');
    picker.classList.toggle('show');

    // Why initialize on show: Color picker canvas needs to be visible in DOM
    // before we can draw on it and position indicators correctly
    if (picker.classList.contains('show')) {
        setTimeout(() => initColorPicker(), 10);
    }
}

/**
 * Apply a selected color as the theme
 * @param {string} color - Hex color code (e.g., '#ff5733')
 *
 * What: Sets a new theme color and saves it to Firebase
 * Why: Updates the entire app's appearance when user selects a color
 */
function selectColor(color) {
    // Update global theme color variable
    themeColor = color;

    // Why check currentUser: Don't try to save to Firebase if not logged in
    if (!currentUser) return;

    // Persist color choice to Firebase so it's saved across sessions
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/themeColor`), themeColor);

    // Apply the new theme to all UI elements
    applyTheme();

    // Re-render header to show new color in theme button/indicators
    renderHeader();

    // Why close both menus: Selecting a color completes the action,
    // no need to keep menus open (better UX)
    document.getElementById('colorPickerMenu').classList.remove('show');
    document.getElementById('dropdownMenu').classList.remove('show');
}

function initColorPicker() {
    const canvas = document.getElementById('colorCanvas');
    const hueSlider = document.getElementById('hueSlider');
    const canvasIndicator = document.getElementById('canvasIndicator');
    const hueIndicator = document.getElementById('hueIndicator');
    const hexInput = document.getElementById('hexInput');
    const colorPreview = document.getElementById('colorPreview');
    
    if (!canvas || !hueSlider) return;
    
    let currentHue = 0;
    let currentSaturation = 100;
    let currentLightness = 50;
    
    // Convert current themeColor to HSL
    const rgb = hexToRgb(themeColor);
    if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        currentHue = hsl.h;
        currentSaturation = hsl.s;
        currentLightness = hsl.l;
        
        // Set initial positions
        hueIndicator.style.left = (currentHue / 360 * 100) + '%';
        
		// Calculate correct canvas position based on HSL
        // X-axis: Saturation (0 = left/white, 100 = right/full color)
        // Y-axis: Brightness (0 = top/bright, 100 = bottom/dark)
        const xPos = currentSaturation;
        const yPos = (1 - (currentLightness / 100)) * 100;
        
        canvasIndicator.style.left = Math.max(0, Math.min(100, xPos)) + '%';
        canvasIndicator.style.top = Math.max(0, Math.min(100, yPos)) + '%';
        canvas.style.backgroundColor = `hsl(${currentHue}, 100%, 50%)`;
    }
    
// Hue slider interaction
function updateHue(clientX) {
        const rect = hueSlider.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const huePercent = (x / rect.width) * 100;
        currentHue = (huePercent / 100) * 360;
        
        hueIndicator.style.left = huePercent + '%';
        canvas.style.backgroundColor = `hsl(${currentHue}, 100%, 50%)`;
        updateColor();
    }
    
    let hueActive = false;
    
    // Mouse events for hue slider
    hueSlider.addEventListener('mousedown', (e) => {
        hueActive = true;
        updateHue(e.clientX);
    });
    
    // Touch events for hue slider
    hueSlider.addEventListener('touchstart', (e) => {
        e.preventDefault();
        hueActive = true;
        updateHue(e.touches[0].clientX);
    });
    
    // Canvas interaction
    let canvasActive = false;
    
    function updateCanvas(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
        
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
        currentSaturation = xPercent;
        currentLightness = 50 - (yPercent - 50) * (50 / 50);
        
        canvasIndicator.style.left = xPercent + '%';
        canvasIndicator.style.top = yPercent + '%';
        updateColor();
    }
    
    // Mouse events for canvas
    canvas.addEventListener('mousedown', (e) => {
        canvasActive = true;
        updateCanvas(e.clientX, e.clientY);
    });
    
    // Touch events for canvas
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        canvasActive = true;
        updateCanvas(e.touches[0].clientX, e.touches[0].clientY);
    });
    
    // Global mouse move and up
    document.addEventListener('mousemove', (e) => {
        if (hueActive) updateHue(e.clientX);
        if (canvasActive) updateCanvas(e.clientX, e.clientY);
    });
    
    document.addEventListener('mouseup', () => {
        hueActive = false;
        canvasActive = false;
    });
    
    // Global touch move and end
    document.addEventListener('touchmove', (e) => {
        if (hueActive) {
            e.preventDefault();
            updateHue(e.touches[0].clientX);
        }
        if (canvasActive) {
            e.preventDefault();
            updateCanvas(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    
    document.addEventListener('touchend', () => {
        hueActive = false;
        canvasActive = false;
    });
    
    function updateColor() {
        const color = hslToHex(currentHue, currentSaturation, currentLightness);
        hexInput.value = color;
        colorPreview.style.backgroundColor = color;
    }
    
    // Hex input
    hexInput.addEventListener('input', (e) => {
        let value = e.target.value;
        if (!value.startsWith('#')) value = '#' + value;
        
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            colorPreview.style.backgroundColor = value;
            const rgb = hexToRgb(value);
            if (rgb) {
                const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
                currentHue = hsl.h;
                currentSaturation = hsl.s;
                currentLightness = hsl.l;
                
                hueIndicator.style.left = (currentHue / 360 * 100) + '%';
                canvasIndicator.style.left = currentSaturation + '%';
                canvasIndicator.style.top = (100 - currentLightness * 2) + '%';
                canvas.style.backgroundColor = `hsl(${currentHue}, 100%, 50%)`;
            }
        }
    });
    
    hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyCustomColor();
        }
    });
}

// ============================================================================
// COLOR CONVERSION UTILITIES
// ============================================================================
// Why these exist: Color picker needs to convert between color formats
// (HEX for storage, RGB for math, HSL for the color picker interface)

/**
 * Convert hexadecimal color to RGB
 * @param {string} hex - Hex color code (e.g., '#ff5733' or 'ff5733')
 * @returns {Object|null} RGB object with r, g, b properties (0-255) or null if invalid
 *
 * What: Parses hex string and extracts red, green, blue values
 * Why: Need RGB values for color calculations and conversions to HSL
 */
function hexToRgb(hex) {
    // Regex captures 3 groups of 2 hex digits (RR GG BB)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    // Why return null if no match: Caller can check if conversion failed
    return result ? {
        r: parseInt(result[1], 16), // Parse hex digits as base-16 numbers
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Convert RGB to HSL color space
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {Object} HSL object with h (0-360), s (0-100), l (0-100)
 *
 * What: Converts RGB color values to Hue, Saturation, Lightness format
 * Why HSL: Color picker UI uses HSL because it's more intuitive for users
 * (hue = color wheel, saturation = intensity, lightness = brightness)
 */
function rgbToHsl(r, g, b) {
    // Normalize RGB values to 0-1 range for calculation
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2; // Lightness is average of max and min

    if (max === min) {
        // Grayscale color (no hue or saturation)
        h = s = 0;
    } else {
        const d = max - min; // Delta for saturation calculation

        // Why different formulas: Saturation formula changes based on lightness
        // to maintain perceptual uniformity
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        // Calculate hue based on which RGB component is dominant
        // Why switch: Hue position depends on which color channel is strongest
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; // Red dominant
            case g: h = ((b - r) / d + 2) / 6; break; // Green dominant
            case b: h = ((r - g) / d + 4) / 6; break; // Blue dominant
        }
    }

    // Convert to standard ranges: H in degrees (0-360), S and L in percent (0-100)
    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hexadecimal color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} Hex color code (e.g., '#ff5733')
 *
 * What: Converts HSL values back to hex format for storage/CSS
 * Why: Need hex format to save to Firebase and apply to CSS properties
 */
function hslToHex(h, s, l) {
    // Normalize saturation and lightness to 0-1 range
    s /= 100; l /= 100;

    // Calculate chroma (color intensity) and intermediate values
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    // Determine RGB values based on hue sector (color wheel divided into 6 sections)
    // Why 60-degree sections: Color wheel has 6 primary/secondary color regions
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

    // Convert 0-1 values to 0-255 range and then to 2-digit hex
    const toHex = (n) => {
        const hex = Math.round((n + m) * 255).toString(16);
        // Why pad: Ensure always 2 digits (e.g., '0f' not 'f')
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Determine if a color is light or dark
 * @param {string} hex - Hex color code
 * @returns {boolean} True if color is light, false if dark
 *
 * What: Calculates perceived brightness of a color
 * Why: Need to determine whether to use light or dark text on the color
 * (accessibility - need sufficient contrast for readability)
 */
function isLightColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;

    // Why these coefficients: Based on human eye sensitivity to different colors
    // Eyes are most sensitive to green, least to blue (standard WCAG formula)
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    // Why 0.6 threshold: Empirically determined value that works well
    // for choosing text color (lower = dark color, higher = light color)
    return luminance > 0.6;
}


function selectCustomColor(color) {
    // Find the closest matching theme or create a gradient
    const selectedTheme = colorThemes.find(t => t.primary === color);
    
    if (selectedTheme) {
        themeColor = selectedTheme.primary;
        applyTheme();
    } else {
        // Create a custom theme with a slightly darker shade for secondary
        themeColor = color;
        
        // Calculate a darker secondary color
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const darkerR = Math.max(0, r - 30);
        const darkerG = Math.max(0, g - 30);
        const darkerB = Math.max(0, b - 30);
        
        const secondaryColor = '#' + [darkerR, darkerG, darkerB]
            .map(x => x.toString(16).padStart(2, '0')).join('');
        
        // Update CSS variables directly for custom color
        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--secondary-color', secondaryColor);
        
        // Update backgrounds
        document.body.style.background = `linear-gradient(135deg, ${secondaryColor}CC 0%, ${color}CC 100%)`;
        const header = document.querySelector('.header');
        if (header) {
            header.style.background = `linear-gradient(135deg, ${secondaryColor} 0%, ${color} 100%)`;
        }
    }
    
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/themeColor`), themeColor);
}


/**
 * Apply custom color from hex input field
 *
 * What: Validates and applies user-entered hex color code
 * Why: Allows users to enter specific color codes directly instead of using picker
 */
async function applyCustomColor() {
    const hexInput = document.getElementById('hexInput');
    const color = hexInput.value;

    // Why validate hex: Prevents invalid colors that would break CSS
    // Regex checks for exactly 6 hex digits after #
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        selectCustomColor(color);

        // Close menus - user's action is complete
        document.getElementById('colorPickerMenu').classList.remove('show');
        document.getElementById('dropdownMenu').classList.remove('show');
    } else {
        await customAlert('Please enter a valid color code (e.g., #FF0000)');
    }
}

// ============================================================================
// HEADER IMAGE MANAGEMENT
// ============================================================================
// Why separate from theme: Header images override theme gradients
// but theme colors still apply to other UI elements

/**
 * Save header image to Firebase
 *
 * What: Persists header image data (base64 or URL) to user's database
 * Why: User's custom header image needs to persist across sessions
 */
function saveHeaderImage() {
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/headerImage`), headerImage);
}

/**
 * Apply header image to the guide header
 *
 * What: Sets header background to custom image and adjusts text colors
 * Why: Custom images provide personalization; text color must adapt to image brightness
 */
function applyHeaderImage() {
    const header = document.querySelector('.header');
    if (!header) {
        console.log('Header not found, cannot apply image');
        return;
    }

    if (headerImage) {
        console.log('Applying header image');

        // Why replace gradient: Image provides visual interest, gradient would obscure it
        header.style.backgroundImage = `url("${headerImage}")`;
        header.style.backgroundSize = 'cover';      // Fill entire header
        header.style.backgroundPosition = 'center';  // Center the image
        header.style.backgroundRepeat = 'no-repeat'; // Don't tile the image
        
        // Detect image brightness and set text color
	detectImageBrightness(headerImage, (isLight, avgR, avgG, avgB) => {
    console.log('Image is', isLight ? 'LIGHT' : 'DARK');
    const textColor = isLight ? '#2c3e50' : 'white';
    const scrimColor = isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.5)';
    const r = avgR || 0;
    const g = avgG || 0;
    const b = avgB || 0;
    
    // Apply background directly to text elements
    const h1 = header.querySelector('h1');
    const p = header.querySelector('p');
    
    if (h1) {
        h1.style.cssText = `
            position: relative;
            z-index: 1;
            color: ${textColor};
            background: radial-gradient(ellipse at center, 
                rgba(${r}, ${g}, ${b}, 0.5) 0%, 
                rgba(${r}, ${g}, ${b}, 0.5) 50%, 
                transparent 100%);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            padding: 4px 12px;
            border-radius: 10px;
            display: block;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            margin-bottom: 2px;
            font-size: 20px;
        `;
    }
    
    if (p) {
        p.style.cssText = `
            position: relative;
            z-index: 1;
            color: ${textColor};
            background: radial-gradient(ellipse at center, 
                rgba(${r}, ${g}, ${b}, 0.5) 0%, 
                rgba(${r}, ${g}, ${b}, 0.5) 50%, 
                transparent 100%);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            padding: 6px 20px;
            border-radius: 8px;
            display: block;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            margin-top: 2px;
            font-size: 12px;
        `;
    }
    
    // Keep buttons visible with correct color
    const menuBtn = header.querySelector('.edit-btn, #menuBtn');
    const guideMenuBtn = header.querySelector('.guide-menu-btn');
    const saveBtn = header.querySelector('.save-btn');
    
    if (menuBtn) {
        menuBtn.style.color = textColor;
        menuBtn.style.zIndex = '100';
    }
    if (guideMenuBtn) {
        guideMenuBtn.style.color = textColor;
        guideMenuBtn.style.zIndex = '100';
    }
    if (saveBtn) {
        saveBtn.style.color = textColor;
        saveBtn.style.zIndex = '100';
    }
});
    } else {
        console.log('Removing header image, reverting to theme');
        // Remove image background and revert to theme gradient
        header.style.backgroundImage = '';
        header.style.backgroundSize = '';
        header.style.backgroundPosition = '';
        header.style.backgroundRepeat = '';
        
        // Reset text styles completely
        const h1 = header.querySelector('h1');
        const p = header.querySelector('p');
        if (h1) {
            h1.style.cssText = '';
        }
        if (p) {
            p.style.cssText = '';
        }
        
        // Reapply theme gradient
        applyTheme();
    }
}
function detectImageBrightness(imageSrc, callback) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;
    
    img.onload = function() {
        // Create canvas to analyze image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Use smaller size for faster processing
        canvas.width = 100;
        canvas.height = 100;
        
        ctx.drawImage(img, 0, 0, 100, 100);
        
        // Get center area of image (where text typically is)
        const imageData = ctx.getImageData(25, 25, 50, 50);
        const data = imageData.data;
        
        let totalR = 0, totalG = 0, totalB = 0;
        let brightness = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            totalR += r;
            totalG += g;
            totalB += b;
            
            // Calculate perceived brightness
            brightness += (0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        const pixelCount = data.length / 4;
        brightness = brightness / pixelCount;
        
        // Calculate average RGB values
        const avgR = Math.round(totalR / pixelCount);
        const avgG = Math.round(totalG / pixelCount);
        const avgB = Math.round(totalB / pixelCount);
        
        console.log('Detected brightness:', brightness);
        
        // If brightness > 128, image is light, use dark text
        const isLight = brightness > 128;
        callback(isLight, avgR, avgG, avgB);
    };
    
    img.onerror = function() {
        console.log('Image failed to load for brightness detection');
        // If image fails to load, default to dark text with neutral gray
        callback(true, 128, 128, 128);
    };
}
// Wallpaper Management
function saveWallpaper() {
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/wallpaper`), wallpaperUrl);
}

function applyWallpaper() {
    const contentArea = document.querySelector('.content-area');
    if (!contentArea) {
        console.log('Content area not found, cannot apply wallpaper');
        return;
    }
      
if (wallpaperUrl) {
    console.log('Applying wallpaper');
    contentArea.classList.add('has-background');
    
    // Apply wallpaper through style tag
    let styleTag = document.getElementById('dynamic-bg-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-bg-style';
        document.head.appendChild(styleTag);
    }
    styleTag.textContent = `.content-area::before { background-image: url("${wallpaperUrl}"); }`;
    
    // Hide overlay when wallpaper is active
    let overlay = document.querySelector('.content-area-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'content-area-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.opacity = '0';
} else {
    console.log('Removing wallpaper');
    contentArea.classList.remove('has-background');
    const styleTag = document.getElementById('dynamic-bg-style');
    if (styleTag) styleTag.textContent = '';
    
    // Show overlay when wallpaper is removed
    const overlay = document.querySelector('.content-area-overlay');
    if (overlay) {
        overlay.style.opacity = '1';
    }
}
}
		
function closeDrawer() {
    // This is now just for closing any leftover menus
    document.body.style.overflow = '';
}

// ============================================================================
// TOUCH & GESTURE HANDLERS
// ============================================================================
// Why separate touch handlers: Mobile users need touch-based interactions
// for swipe-to-delete, drawer gestures, and card manipulation

// Drawer swipe state
// Why track X position: Enables horizontal swipe gesture to close drawer menu
let touchStartX = 0;
let touchCurrentX = 0;
let isDragging = false;

// Item swipe-to-delete state
// Why track both X and Y: Distinguishes horizontal swipe (delete) from vertical scroll
// Prevents accidental deletions while scrolling through list
let itemTouchStartX = 0;
let itemTouchStartY = 0;
let itemTouchCurrentX = 0;
let itemTouchCurrentY = 0;
let isItemDragging = false;
let currentSwipedItem = null;

// Swipe diagonal to delete skill cards (down-left angle)
let cardTouchStartX = 0;
let cardTouchStartY = 0;
let cardTouchCurrentX = 0;
let cardTouchCurrentY = 0;
let isCardDragging = false;
let currentSwipedCard = null;

document.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.checklist-item');
    if (!item || editMode) return;
    
    // Don't interfere with checkbox clicks
    if (e.target.closest('.checkbox') || e.target.closest('.bullet-number') || 
        e.target.closest('.bullet-square') || e.target.closest('.bullet-circle')) {
        return;
    }
    
    itemTouchStartX = e.touches[0].clientX;
    itemTouchStartY = e.touches[0].clientY;  // FIXED: Added this
    itemTouchCurrentX = itemTouchStartX;
    itemTouchCurrentY = itemTouchStartY;  // FIXED: Added this
    isItemDragging = false;  // FIXED: Changed from true to false
    currentSwipedItem = item;
    item.style.transition = 'none';
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!currentSwipedItem) return;
    
    itemTouchCurrentX = e.touches[0].clientX;
    itemTouchCurrentY = e.touches[0].clientY;
    const deltaX = itemTouchCurrentX - itemTouchStartX;
    const deltaY = itemTouchCurrentY - itemTouchStartY;
    
    // Dead zone - ignore first 30px of movement
    if (!isItemDragging && Math.abs(deltaX) < 30) {
        return;
    }
    
    // Only start swiping if movement is STRICTLY HORIZONTAL (within ±20 degrees)
    if (!isItemDragging) {
        const angle = Math.abs(Math.atan2(deltaY, deltaX) * 180 / Math.PI);
        const isHorizontal = angle < 20 || angle > 160; // Within 20 degrees of horizontal
        
        if (isHorizontal && Math.abs(deltaX) > 30) {
            isItemDragging = true;
        } else if (Math.abs(deltaY) > 15 || !isHorizontal) {
            // Vertical scroll or diagonal swipe detected - cancel
            currentSwipedItem.style.transition = '';
            currentSwipedItem.style.transform = '';
            currentSwipedItem.style.background = '';
            currentSwipedItem = null;
            return;
        }
    }
    
    if (!isItemDragging) return;
    
    // Only allow swiping left (negative delta)
    if (deltaX < 0) {
        // Subtract dead zone from visual movement for smoother feel
        const adjustedDelta = deltaX + 30;
        currentSwipedItem.style.transform = `translateX(${adjustedDelta}px)`;
        
        // Show delete button background as user swipes - MORE OPAQUE
        const maxSwipe = 100;
        const swipeProgress = Math.min(Math.abs(adjustedDelta) / maxSwipe, 1);
        currentSwipedItem.style.background = `linear-gradient(90deg, #f8f9fa ${100 - (swipeProgress * 100)}%, #dc2626 100%)`;
    }
});

document.addEventListener('touchend', async (e) => {
    if (!currentSwipedItem) return;
    
    const deltaX = itemTouchCurrentX - itemTouchStartX;
    const threshold = 100;
    
    currentSwipedItem.style.transition = 'all 0.3s ease';
    
    if (isItemDragging && deltaX < 0 && Math.abs(deltaX) > threshold) {
        // Get the data immediately before animation
        const catIndex = parseInt(currentSwipedItem.dataset.catIndex);
        const skillIndex = parseInt(currentSwipedItem.dataset.skillIndex);
        const itemIndex = parseInt(currentSwipedItem.dataset.itemIndex);
        
        // Delete the item with animation - NO CONFIRMATION HERE
        currentSwipedItem.style.transform = 'translateX(-100%)';
        currentSwipedItem.style.opacity = '0';
        
        setTimeout(() => {
            // Call the deleteItem function which has its own confirmation
            deleteItem(catIndex, skillIndex, itemIndex);
        }, 300);
    } else {
        // Not enough swipe - snap back
        currentSwipedItem.style.transform = 'translateX(0)';
        currentSwipedItem.style.background = '#f8f9fa';
    }
    
    isItemDragging = false;
    currentSwipedItem = null;
});

// Swipe right to cycle bullet styles
let rightSwipeTouchStartX = 0;
let rightSwipeTouchStartY = 0;
let rightSwipeTouchCurrentX = 0;
let rightSwipeTouchCurrentY = 0;
let isRightSwiping = false;
let currentRightSwipeItem = null;

document.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.checklist-item');
    if (!item || editMode) return;
    
    // Don't interfere with checkbox clicks
    if (e.target.closest('.checkbox') || e.target.closest('.bullet-number') || 
        e.target.closest('.bullet-square') || e.target.closest('.bullet-circle')) {
        return;
    }
    
    rightSwipeTouchStartX = e.touches[0].clientX;
    rightSwipeTouchStartY = e.touches[0].clientY;
    rightSwipeTouchCurrentX = rightSwipeTouchStartX;
    rightSwipeTouchCurrentY = rightSwipeTouchStartY;
    isRightSwiping = false;
    currentRightSwipeItem = item;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!currentRightSwipeItem) return;
    
    rightSwipeTouchCurrentX = e.touches[0].clientX;
    rightSwipeTouchCurrentY = e.touches[0].clientY;
    const deltaX = rightSwipeTouchCurrentX - rightSwipeTouchStartX;
    const deltaY = rightSwipeTouchCurrentY - rightSwipeTouchStartY;
    
    if (!isRightSwiping && Math.abs(deltaX) < 20) {
        return;
    }
    
    if (!isRightSwiping) {
        if (deltaX > 20 && Math.abs(deltaX) > Math.abs(deltaY)) {
            isRightSwiping = true;
            e.preventDefault();
        } else if (Math.abs(deltaY) > 15) {
            currentRightSwipeItem = null;
            return;
        }
    }
    
    if (!isRightSwiping) return;
    
    if (deltaX > 0) {
        const adjustedDelta = Math.min(deltaX - 20, 70);
        const progress = adjustedDelta / 70;
        
        // Simple highlight that intensifies as you swipe
        const highlightOpacity = Math.floor(progress * 15);
        currentRightSwipeItem.style.background = `rgba(var(--primary-color-rgb, 52, 152, 219), 0.${highlightOpacity > 9 ? highlightOpacity : '0' + highlightOpacity})`;
        currentRightSwipeItem.style.transition = 'none';
        
        // Morph the bullet as preview
        const catIndex = parseInt(currentRightSwipeItem.dataset.catIndex);
        const skillIndex = parseInt(currentRightSwipeItem.dataset.skillIndex);
        const bullet = currentRightSwipeItem.querySelector('.checkbox, .bullet-number, .bullet-square, .bullet-circle, .bullet-none');
        
        if (bullet && !isNaN(catIndex) && !isNaN(skillIndex)) {
            const currentStyle = categories[catIndex].skills[skillIndex].bulletStyle || 'checkbox';
            const styles = ['checkbox', 'number', 'square', 'circle', 'none'];
            const currentIndex = styles.indexOf(currentStyle);
            const nextIndex = (currentIndex + 1) % styles.length;
            const nextStyle = styles[nextIndex];
            
            // Create visual morph effect based on progress
            bullet.style.transition = 'none';
            
            // Fade out current, fade in next
            if (progress < 0.5) {
                // First half: fade out current style
                bullet.style.opacity = `${1 - (progress * 2)}`;
            } else {
                // Second half: show next style and fade in
                bullet.style.opacity = `${(progress - 0.5) * 2}`;
                
                // Change the visual appearance to next bullet type
                if (nextStyle === 'checkbox') {
                    bullet.className = 'checkbox';
                } else if (nextStyle === 'number') {
                    bullet.className = 'bullet-number';
                    bullet.textContent = parseInt(currentRightSwipeItem.dataset.itemIndex) + 1;
                } else if (nextStyle === 'square') {
                    bullet.className = 'bullet-square';
                    bullet.textContent = '■';
                } else if (nextStyle === 'circle') {
                    bullet.className = 'bullet-circle';
                    bullet.textContent = '●';
                } else if (nextStyle === 'none') {
                    bullet.className = 'bullet-none';
                    bullet.textContent = '';
                }
            }
            
            // Subtle scale for smooth transition feel
            const scale = 0.9 + (Math.sin(progress * Math.PI) * 0.1);
            bullet.style.transform = `scale(${scale})`;
        }
    }
});

document.addEventListener('touchend', (e) => {
    if (!currentRightSwipeItem) return;
    
    const deltaX = rightSwipeTouchCurrentX - rightSwipeTouchStartX;
    const threshold = 50;
    
    currentRightSwipeItem.style.transition = 'all 0.2s ease';
    
    if (isRightSwiping && deltaX > threshold) {
        const catIndex = parseInt(currentRightSwipeItem.dataset.catIndex);
        const skillIndex = parseInt(currentRightSwipeItem.dataset.skillIndex);
        
        if (!isNaN(catIndex) && !isNaN(skillIndex)) {
            // Quick flash to indicate action
            currentRightSwipeItem.style.background = 'rgba(var(--primary-color-rgb, 52, 152, 219), 0.2)';
            
            setTimeout(() => {
                const currentStyle = categories[catIndex].skills[skillIndex].bulletStyle || 'checkbox';
                const styles = ['checkbox', 'number', 'square', 'circle', 'none'];
                const currentIndex = styles.indexOf(currentStyle);
                const nextIndex = (currentIndex + 1) % styles.length;
                const nextStyle = styles[nextIndex];
                
                categories[catIndex].skills[skillIndex].bulletStyle = nextStyle;
                saveCategories();
                renderContent();
            }, 150);
        }
    } else {
        // Snap back - morph back to original
        currentRightSwipeItem.style.background = '';
        const bullet = currentRightSwipeItem.querySelector('.checkbox, .bullet-number, .bullet-square, .bullet-circle, .bullet-none');
        if (bullet) {
            bullet.style.transition = 'all 0.2s ease';
            bullet.style.opacity = '1';
            bullet.style.transform = 'scale(1)';
        }
        // Re-render to restore original bullet
        setTimeout(() => {
            renderContent();
        }, 200);
    }
    
    isRightSwiping = false;
    currentRightSwipeItem = null;
});

// Diagonal swipe (down-left) to delete skill cards - captures anywhere on card
document.addEventListener('touchstart', (e) => {
    // Check if touch is on or inside a skill card
    const card = e.target.closest('.skill-card');
    if (!card || editMode) return;
    
    // Don't interfere with card control buttons
    if (e.target.closest('.skill-control-btn') || 
        e.target.closest('.add-item-btn')) {
        return;
    }
    
    cardTouchStartX = e.touches[0].clientX;
    cardTouchStartY = e.touches[0].clientY;
    cardTouchCurrentX = cardTouchStartX;
    cardTouchCurrentY = cardTouchStartY;
    isCardDragging = false;
    currentSwipedCard = card;
    card.style.transition = 'none';
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!currentSwipedCard) return;
    
    cardTouchCurrentX = e.touches[0].clientX;
    cardTouchCurrentY = e.touches[0].clientY;
    const deltaX = cardTouchCurrentX - cardTouchStartX;
    const deltaY = cardTouchCurrentY - cardTouchStartY;
    
    // Dead zone - ignore first 30px of movement
    if (!isCardDragging && (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30)) {
        return;
    }
    
    // Check if swipe is diagonal down-left
    if (!isCardDragging) {
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
        // Down-left: angle between 120° and 170° (going down and to the left)
        const isDiagonalDownLeft = deltaX < 0 && deltaY > 0 && angle > 120 && angle < 170;
        
        if (isDiagonalDownLeft && Math.abs(deltaX) > 30 && Math.abs(deltaY) > 20) {
            isCardDragging = true;
            e.preventDefault(); // Prevent scrolling and item swipes
            
            // Cancel any active item swipe
            if (currentSwipedItem) {
                currentSwipedItem.style.transition = '';
                currentSwipedItem.style.transform = '';
                currentSwipedItem.style.background = '';
                currentSwipedItem = null;
                isItemDragging = false;
            }
        } else if ((Math.abs(deltaX) > 40 && Math.abs(deltaY) < 20) || Math.abs(deltaY) > 50) {
            // Horizontal swipe (for items) or vertical scroll - cancel card swipe
            currentSwipedCard.style.transition = '';
            currentSwipedCard.style.transform = '';
            currentSwipedCard.style.background = '';
            currentSwipedCard.style.boxShadow = '';
            currentSwipedCard = null;
            return;
        }
    }
    
    if (!isCardDragging) return;
    
    // Prevent item swipes while card is being swiped
    if (currentSwipedItem) {
        currentSwipedItem.style.transition = '';
        currentSwipedItem.style.transform = '';
        currentSwipedItem.style.background = '';
        currentSwipedItem = null;
        isItemDragging = false;
    }
    
    // Apply diagonal movement with visual feedback
    if (deltaX < 0 && deltaY > 0) {
        const adjustedDeltaX = deltaX + 30;
        const adjustedDeltaY = deltaY - 20;
        currentSwipedCard.style.transform = `translate(${adjustedDeltaX}px, ${adjustedDeltaY}px) rotate(-5deg)`;
        currentSwipedCard.style.boxShadow = '0 8px 24px rgba(220, 38, 38, 0.4)';
        
        // Show delete background with gradient
        const maxSwipe = 120;
        const swipeProgress = Math.min(Math.sqrt(adjustedDeltaX * adjustedDeltaX + adjustedDeltaY * adjustedDeltaY) / maxSwipe, 1);
        currentSwipedCard.style.background = `linear-gradient(135deg, #fee2e2 ${100 - (swipeProgress * 100)}%, #dc2626 100%)`;
        currentSwipedCard.style.borderLeftColor = '#dc2626';
    }
});

document.addEventListener('touchend', async (e) => {
    if (!currentSwipedCard) return;
    
    const deltaX = cardTouchCurrentX - cardTouchStartX;
    const deltaY = cardTouchCurrentY - cardTouchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const threshold = 100;
    
    currentSwipedCard.style.transition = 'all 0.3s ease';
    
    if (isCardDragging && distance > threshold) {
        // Get the data immediately before animation
        const catIndex = parseInt(currentSwipedCard.dataset.catIndex);
        const skillIndex = parseInt(currentSwipedCard.dataset.skillIndex);
        
        // Delete the card with animation - NO CONFIRMATION HERE
        currentSwipedCard.style.transform = 'translate(-150%, 100%) rotate(-15deg)';
        currentSwipedCard.style.opacity = '0';
        
        setTimeout(() => {
            // Call the deleteSkill function which has its own confirmation
            deleteSkill(catIndex, skillIndex);
        }, 300);
    } else {
        // Not enough swipe - snap back
        currentSwipedCard.style.transform = '';
        currentSwipedCard.style.background = '';
        currentSwipedCard.style.boxShadow = '';
        currentSwipedCard.style.borderLeftColor = '';
    }
    
    isCardDragging = false;
    currentSwipedCard = null;
});

// ============================================================================
// GUIDE & DOCUMENT MANAGEMENT
// ============================================================================
// Why guides: Core feature that allows users to create multiple independent documents/checklists
// Each guide has its own categories, items, theme, and settings

/**
 * Create a new blank guide
 * Why timestamp-based ID: Ensures unique IDs without server round-trip
 */
function createNewGuide() {
    if (!currentUser) return;
    const timestamp = Date.now();
    const newId = `guide_${timestamp}`;
    
    const newGuideData = {
        appTitle: 'New Page',
        appSubtitle: 'Tap to add description',
        appIcon: '📝',
        categories: [],
        themeColor: '#3498db',
        checkedItems: {}
        // No templateType - leave untyped by default
    };
    
    set(ref(database, `users/${currentUser.uid}/guides/${newId}`), newGuideData).then(() => {
        currentGuideId = newId;
        localStorage.setItem('currentGuideId', newId);
        localStorage.setItem('currentPage', 'guides'); // Changed to 'guides'
        loadUserData(currentUser.uid);
        
        // Switch to main view
        document.getElementById('homePage')?.classList.remove('active');
        document.querySelector('.container').style.display = 'block';
        
        // Keep Home button active
        document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active'); // Home button
        
        // Show back button
        setTimeout(() => {
            const backBtn = document.getElementById('headerBackBtn');
            if (backBtn) {
                backBtn.style.display = 'flex';
            }
        }, 100);
    });
}

function createGuideFromTemplate(templateType) {
    if (!currentUser) return;
    const timestamp = Date.now();
    const newId = `guide_${timestamp}`;
    
    let templateData = {
        appTitle: 'New Page',
        appSubtitle: 'Tap to add description',
        appIcon: '📝',
        categories: [],
        themeColor: '#3498db',
        checkedItems: {},
        templateType: templateType 
    };
    
    
    // Customize based on template type
    switch(templateType) {
        case 'short-notes':
            templateData.appTitle = 'Short Notes';
            templateData.appSubtitle = 'Quick notes and ideas';
            templateData.appIcon = '📝';
            templateData.categories = [
                {
                    name: "Notes",
                    icon: "📄",
                    skills: [
                        {
                            title: "Ideas",
                            icon: "💡",
                            bulletStyle: "bullet",
                            items: []
                        }
                    ]
                }
            ];
            break;
        case 'reminders':
            templateData.appTitle = 'Reminders';
            templateData.appSubtitle = 'Things to remember';
            templateData.appIcon = '🔔';
            templateData.categories = [
                {
                    name: "To Do",
                    icon: "✅",
                    skills: [
                        {
                            title: "Today",
                            icon: "📌",
                            bulletStyle: "checkbox",
                            items: []
                        }
                    ]
                }
            ];
            break;
        case 'trackers':
            templateData.appTitle = 'Trackers';
            templateData.appSubtitle = 'Track your progress';
            templateData.appIcon = '📊';
            templateData.categories = [
                {
                    name: "Habits",
                    icon: "🎯",
                    skills: [
                        {
                            title: "Daily Habits",
                            icon: "✨",
                            bulletStyle: "checkbox",
                            items: []
                        }
                    ]
                }
            ];
            break;
        case 'routines':
            templateData.appTitle = 'Routines';
            templateData.appSubtitle = 'Daily routines';
            templateData.appIcon = '🔄';
            templateData.categories = [
                {
                    name: "Morning",
                    icon: "🌅",
                    skills: [
                        {
                            title: "Morning Routine",
                            icon: "☀️",
                            bulletStyle: "checkbox",
                            items: []
                        }
                    ]
                }
            ];
            break;
            }
    
    set(ref(database, `users/${currentUser.uid}/guides/${newId}`), templateData).then(() => {
        currentGuideId = newId;
        localStorage.setItem('currentGuideId', newId);
        localStorage.setItem('currentPage', 'guides'); // Changed to 'guides' so home stays active
        
        // Load the user data for the new guide
        loadUserData(currentUser.uid);
        
        // Switch to main view
        document.getElementById('homePage')?.classList.remove('active');
        document.getElementById('templatesPage')?.classList.remove('active');
        document.querySelector('.container').style.display = 'block';
        
        // Keep Home button active since guides are part of home
        document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active'); // Home button
        
        // Show back button
        setTimeout(() => {
            const backBtn = document.getElementById('headerBackBtn');
            if (backBtn) {
                backBtn.style.display = 'flex';
            }
        }, 100);
    }).catch((error) => {
        console.error('Error creating template:', error);
        customAlert('Failed to create page: ' + error.message, 'Error');
    });
}

	async function createJournalFromTemplate() {
    if (!currentUser) return;
    const timestamp = Date.now();
    const newId = `guide_${timestamp}`;
    
    const journalGuideData = {
        appTitle: 'My Journal',
        appSubtitle: 'Personal thoughts and reflections',
        appIcon: '📔',
        categories: [],
        themeColor: '#3498db',
        checkedItems: {},
        templateType: 'journal',
        journalEntries: {}
    };
    
    // Create the journal guide
    await set(ref(database, `users/${currentUser.uid}/guides/${newId}`), journalGuideData);
    
    // Immediately create first entry
    const entryTimestamp = Date.now();
    const entryId = `entry_${entryTimestamp}`;
    
    const newEntry = {
        title: 'My First Entry',
        icon: '📝',
        date: new Date().toISOString(),
        tags: [],
        mood: '',
        content: '',
        createdAt: entryTimestamp,
        updatedAt: entryTimestamp
    };
    
    await set(ref(database, `users/${currentUser.uid}/guides/${newId}/journalEntries/${entryId}`), newEntry);
    
    // Open the journal entry editor
    currentGuideId = newId;
    localStorage.setItem('currentGuideId', newId);
    localStorage.setItem('currentPage', 'journal-editor');
    
    // Hide templates page, show journal editor
    document.getElementById('templatesPage')?.classList.remove('active');
    document.getElementById('journalEditorPage')?.classList.add('active');
    
    // Set Home nav as active (since journal is part of home)
    document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active');
    
    // Load and render journal entry
    await openJournalEditor(newId, entryId);
}
	
async function createJournalEntry(journalGuideId) {
    if (!currentUser) return;
    const timestamp = Date.now();
    const entryId = `entry_${timestamp}`;
    
    const newEntry = {
        title: 'New Entry',
        icon: '📝',
        date: new Date().toISOString(),
        tags: [],
        mood: '',
        content: '',
        createdAt: timestamp,
        updatedAt: timestamp
    };
    
    await set(ref(database, `users/${currentUser.uid}/guides/${journalGuideId}/journalEntries/${entryId}`), newEntry);
    
    // Open the journal entry editor
    openJournalEditor(journalGuideId, entryId);
}

async function openJournalEditor(journalGuideId, entryId) {
    currentGuideId = journalGuideId;
    currentJournalEntryId = entryId;
    localStorage.setItem('currentGuideId', journalGuideId);
    localStorage.setItem('currentJournalEntryId', entryId);
    localStorage.setItem('currentPage', 'journal-editor');
    
    // Hide home page, show journal editor
    document.getElementById('homePage')?.classList.remove('active');
    document.getElementById('journalEditorPage')?.classList.add('active');
    
    // Load and render journal entry
    await loadJournalEntry(journalGuideId, entryId);
}

async function loadJournalEntry(journalGuideId, entryId) {
    if (!currentUser) return;
    
    const entrySnapshot = await get(ref(database, `users/${currentUser.uid}/guides/${journalGuideId}/journalEntries/${entryId}`));
    const guideSnapshot = await get(ref(database, `users/${currentUser.uid}/guides/${journalGuideId}`));
    
    if (!entrySnapshot.exists() || !guideSnapshot.exists()) return;
    
    currentJournalData = entrySnapshot.val();
    const guideData = guideSnapshot.val();
    themeColor = guideData.themeColor || '#3498db';
    applyTheme(themeColor);
    
    renderJournalHeader();
    renderJournalMeta();
    renderJournalContent();
}

function renderJournalHeader() {
    const header = document.getElementById('journalHeader');
    if (!header) return;
    
    const backButton = `
        <button class="header-back-btn" id="journalBackBtn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
    `;
    
    const isLight = isLightColor(themeColor);
    const textColor = isLight ? '#2c3e50' : 'white';
    
    header.style.background = `linear-gradient(135deg, ${secondaryColor} 0%, ${themeColor} 100%)`;
    header.style.color = textColor;
    
    header.innerHTML = `
        ${backButton}
        <div class="journal-header-content">
            <div class="journal-header-icon" id="journalHeaderIcon">${currentJournalData.icon || '📝'}</div>
            <div class="journal-header-text">
                <div class="journal-header-title" id="journalHeaderTitle">${currentJournalData.title || 'New Entry'}</div>
            </div>
        </div>
        <button class="edit-btn" id="journalMenuBtn" style="color: ${textColor};">⋮</button>
        <div class="journal-menu-dropdown" id="journalMenuDropdown">
            <button id="journalEditBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
            </button>
            <button id="journalDeleteBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
            </button>
            <button id="journalHeaderImageBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Header Image
            </button>
            <button id="journalWallpaperBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                Wallpaper
            </button>
            <button id="journalThemeBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                Theme
            </button>
        </div>
    `;
    
    // Add event listeners
    const journalBackBtn = document.getElementById('journalBackBtn');
    const journalMenuBtn = document.getElementById('journalMenuBtn');
    const journalMenuDropdown = document.getElementById('journalMenuDropdown');
    const journalHeaderIcon = document.getElementById('journalHeaderIcon');
    const journalHeaderTitle = document.getElementById('journalHeaderTitle');
    const journalDeleteBtn = document.getElementById('journalDeleteBtn');
    
    if (journalBackBtn) {
        journalBackBtn.addEventListener('click', () => {
            saveJournalEntry();
            closeJournalEditor();
        });
    }
    
    if (journalMenuBtn) {
        journalMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            journalMenuDropdown?.classList.toggle('show');
        });
    }
    
    if (journalHeaderIcon) {
        journalHeaderIcon.addEventListener('click', async () => {
            const newIcon = await customPrompt('Enter emoji icon:', currentJournalData.icon || '📝', 'Change Icon');
            if (newIcon) {
                currentJournalData.icon = newIcon;
                journalHeaderIcon.textContent = newIcon;
                saveJournalEntry();
            }
        });
    }
    
    if (journalHeaderTitle) {
        journalHeaderTitle.addEventListener('click', async () => {
            const newTitle = await customPrompt('Enter title:', currentJournalData.title || 'New Entry', 'Change Title');
            if (newTitle) {
                currentJournalData.title = newTitle;
                journalHeaderTitle.textContent = newTitle;
                saveJournalEntry();
            }
        });
    }
    
    if (journalDeleteBtn) {
        journalDeleteBtn.addEventListener('click', async () => {
            if (await customConfirm('Delete this journal entry?', 'Delete Entry', 'Delete')) {
                await remove(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/journalEntries/${currentJournalEntryId}`));
                closeJournalEditor();
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!journalMenuBtn?.contains(e.target) && !journalMenuDropdown?.contains(e.target)) {
            journalMenuDropdown?.classList.remove('show');
        }
    });
}

function renderJournalMeta() {
    const journalDate = document.getElementById('journalDate');
    const journalTagsWrapper = document.getElementById('journalTagsWrapper');
    const journalMoodSection = document.getElementById('journalMoodSection');
    
    // Render date
    if (journalDate) {
        const date = currentJournalData.date ? new Date(currentJournalData.date) : new Date();
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        journalDate.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${dateStr} • ${timeStr}
        `;
    }
    
    // Render tags
    if (journalTagsWrapper) {
        const tags = currentJournalData.tags || [];
        let tagsHTML = '';
        
        tags.forEach((tag, index) => {
            tagsHTML += `
                <div class="journal-tag">
                    ${tag}
                    <span class="journal-tag-remove" data-tag-index="${index}">×</span>
                </div>
            `;
        });
        
        tagsHTML += '<button class="journal-add-tag-btn" id="journalAddTagBtn">+ Add Tag</button>';
        journalTagsWrapper.innerHTML = tagsHTML;
        
        // Add tag button listener
        const addTagBtn = document.getElementById('journalAddTagBtn');
        if (addTagBtn) {
            addTagBtn.addEventListener('click', async () => {
                const newTag = await customPrompt('Enter tag:', '', 'Add Tag');
                if (newTag) {
                    if (!currentJournalData.tags) currentJournalData.tags = [];
                    currentJournalData.tags.push(newTag);
                    saveJournalEntry();
                    renderJournalMeta();
                }
            });
        }
        
        // Remove tag listeners
        document.querySelectorAll('.journal-tag-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.tagIndex);
                currentJournalData.tags.splice(index, 1);
                saveJournalEntry();
                renderJournalMeta();
            });
        });
    }
    
    // Render mood selector
    if (journalMoodSection) {
        const moods = ['😊', '🌟', '😌', '💭', '😔', '🎉', '😴', '🔥'];
        let moodHTML = '<div class="journal-mood-label">How are you feeling?</div><div class="journal-mood-selector">';
        
        moods.forEach(mood => {
            const selected = currentJournalData.mood === mood ? 'selected' : '';
            moodHTML += `<div class="journal-mood-option ${selected}" data-mood="${mood}">${mood}</div>`;
        });
        
        moodHTML += '</div>';
        journalMoodSection.innerHTML = moodHTML;
        
        // Mood selection listeners
        document.querySelectorAll('.journal-mood-option').forEach(option => {
            option.addEventListener('click', () => {
                currentJournalData.mood = option.dataset.mood;
                saveJournalEntry();
                renderJournalMeta();
            });
        });
    }
}

function renderJournalContent() {
    const titleInput = document.getElementById('journalTitleInput');
    const contentInput = document.getElementById('journalContentInput');
    
    if (titleInput) {
        titleInput.value = currentJournalData.title || '';
        titleInput.addEventListener('input', () => {
            currentJournalData.title = titleInput.value;
            // Auto-save on input
            clearTimeout(window.journalSaveTimeout);
            window.journalSaveTimeout = setTimeout(() => saveJournalEntry(), 1000);
        });
    }
    
    if (contentInput) {
        contentInput.value = currentJournalData.content || '';
        contentInput.addEventListener('input', () => {
            currentJournalData.content = contentInput.value;
            // Auto-save on input
            clearTimeout(window.journalSaveTimeout);
            window.journalSaveTimeout = setTimeout(() => saveJournalEntry(), 1000);
        });
    }
    
    // Quick action buttons
    const addPhotoBtn = document.getElementById('journalAddPhotoBtn');
    const addLocationBtn = document.getElementById('journalAddLocationBtn');
    const addAudioBtn = document.getElementById('journalAddAudioBtn');
    
    if (addPhotoBtn) {
        addPhotoBtn.addEventListener('click', () => {
            customAlert('Photo attachment feature coming soon!', 'Info');
        });
    }
    
    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', () => {
            customAlert('Location feature coming soon!', 'Info');
        });
    }
    
    if (addAudioBtn) {
        addAudioBtn.addEventListener('click', () => {
            customAlert('Audio recording feature coming soon!', 'Info');
        });
    }
}

async function saveJournalEntry() {
    if (!currentUser || !currentGuideId || !currentJournalEntryId) return;
    
    currentJournalData.updatedAt = Date.now();
    
    await set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/journalEntries/${currentJournalEntryId}`), currentJournalData);
}

function closeJournalEditor() {
    document.getElementById('journalEditorPage')?.classList.remove('active');
    document.getElementById('homePage')?.classList.add('active');
    
    currentJournalEntryId = null;
    localStorage.removeItem('currentJournalEntryId');
    localStorage.setItem('currentPage', 'guides');
    
    // Refresh home page to show updated journal
    populateHomePage();
    
    // Set home nav as active
    document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active');
}


	// Create new collection
async function createNewCollection() {
    const collectionName = await customPrompt('Enter collection name:', 'New Collection', 'Create Collection');
    if (!collectionName || !currentUser) return;

    const timestamp = Date.now();
    const collectionId = `collection_${timestamp}`;

    await set(ref(database, `users/${currentUser.uid}/collections/${collectionId}`), {
        name: collectionName,
        createdAt: timestamp
    });

    populateHomePage();
}

// Create new type
async function createNewType() {
    const typeName = await customPrompt('Enter type name:', 'My Type', 'Create Type');
    if (!typeName || !currentUser) return;

    const timestamp = Date.now();
    const typeId = `type_${timestamp}`;

    await set(ref(database, `users/${currentUser.uid}/customTypes/${typeId}`), {
        name: typeName,
        createdAt: timestamp
    });

    populateHomePage();
}

// Populate filter navigation with built-in and custom types
async function populateFilterNavigation(availableTypes) {
    if (!currentUser) return;

    const filterNav = document.querySelector('.home-filter-nav');
    if (!filterNav) return;

    // Built-in types (from templates)
    const builtInTypes = [
        { id: 'values', name: 'Values' },
        { id: 'short-notes', name: 'Short notes' },
        { id: 'reminders', name: 'Reminders' },
        { id: 'routines', name: 'Routines' },
        { id: 'trackers', name: 'Trackers' },
        { id: 'journals', name: 'Journals' }
    ];

    // Fetch custom types from database
    const customTypesSnapshot = await get(ref(database, `users/${currentUser.uid}/customTypes`));
    const customTypes = customTypesSnapshot.val() || {};

    const customTypesArray = Object.keys(customTypes).map(id => ({
        id: id,
        name: customTypes[id].name || 'Untitled Type',
        createdAt: customTypes[id].createdAt || 0,
        isCustom: true
    })).sort((a, b) => a.createdAt - b.createdAt);

    // Combine built-in and custom types
    const allTypes = [...builtInTypes, ...customTypesArray];

    // Render filter items
    filterNav.innerHTML = allTypes.map(type => {
        const shouldHide = availableTypes && !availableTypes.has(type.id);
        const isActive = selectedFilter === type.id;
        return `
            <div class="home-filter-item ${isActive ? 'active' : ''}"
                 data-filter="${type.id}"
                 data-is-custom="${type.isCustom ? 'true' : 'false'}"
                 style="${shouldHide ? 'display: none;' : ''}">
                ${type.name}
            </div>
        `;
    }).join('');

    // Add click handlers for filter items
    document.querySelectorAll('.home-filter-item').forEach(filterItem => {
        filterItem.addEventListener('click', () => {
            const filterValue = filterItem.dataset.filter;

            // Toggle filter: if clicking the active filter, deselect it
            if (selectedFilter === filterValue) {
                selectedFilter = 'all';
                filterItem.classList.remove('active');
            } else {
                // Select new filter
                selectedFilter = filterValue;

                // Update active state
                document.querySelectorAll('.home-filter-item').forEach(item => {
                    item.classList.remove('active');
                });
                filterItem.classList.add('active');
            }

            // Re-populate guides with new filter
            populateHomePage();
        });

        // Long press to delete custom type (only for custom types)
        const isCustom = filterItem.dataset.isCustom === 'true';
        const typeId = filterItem.dataset.filter;

        if (isCustom) {
            let longPressTimer;
            let longPressTriggered = false;

            filterItem.addEventListener('touchstart', (e) => {
                longPressTriggered = false;
                longPressTimer = setTimeout(async () => {
                    longPressTriggered = true;
                    e.preventDefault();
                    const typeName = filterItem.textContent.trim();

                    if (await customConfirm(`Delete type "${typeName}"? Pages with this type will not be deleted.`, 'Delete Type', 'Delete')) {
                        await remove(ref(database, `users/${currentUser.uid}/customTypes/${typeId}`));

                        // If the deleted type was selected, reset filter
                        if (selectedFilter === typeId) {
                            selectedFilter = 'all';
                        }

                        populateHomePage();
                    }
                }, 500);
            });

            filterItem.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });

            filterItem.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });

            filterItem.addEventListener('mousedown', (e) => {
                longPressTriggered = false;
                longPressTimer = setTimeout(async () => {
                    longPressTriggered = true;
                    const typeName = filterItem.textContent.trim();

                    if (await customConfirm(`Delete type "${typeName}"? Pages with this type will not be deleted.`, 'Delete Type', 'Delete')) {
                        await remove(ref(database, `users/${currentUser.uid}/customTypes/${typeId}`));

                        // If the deleted type was selected, reset filter
                        if (selectedFilter === typeId) {
                            selectedFilter = 'all';
                        }

                        populateHomePage();
                    }
                }, 500);
            });

            filterItem.addEventListener('mouseup', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });

            filterItem.addEventListener('mouseleave', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });
        }
    });
}

// Populate collections navigation
async function populateCollections() {
    if (!currentUser) return;

    const collectionsNav = document.getElementById('homeCollectionsNav');
    if (!collectionsNav) return;

    const collectionsSnapshot = await get(ref(database, `users/${currentUser.uid}/collections`));
    const collections = collectionsSnapshot.val() || {};

    const collectionsArray = Object.keys(collections).map(id => ({
        id: id,
        name: collections[id].name || 'Untitled Collection',
        createdAt: collections[id].createdAt || 0
    })).sort((a, b) => a.createdAt - b.createdAt);

    // Validate selectedCollection - if it doesn't exist, reset to null
    if (selectedCollection && !collections[selectedCollection]) {
        selectedCollection = null;
        localStorage.removeItem('selectedCollection');
    }

    // "All files" collection (shown at the end)
    const allFilesHTML = `
        <div class="home-collection-item ${selectedCollection === null ? 'active' : ''}" data-collection-id="">
            <div class="home-collection-circle">
                <div class="home-collection-circle-dot"></div>
            </div>
            <span class="home-collection-name">All files</span>
        </div>
    `;

    // Add user-created collections
    const collectionsHTML = collectionsArray.map(collection => `
        <div class="home-collection-item ${selectedCollection === collection.id ? 'active' : ''}" data-collection-id="${collection.id}">
            <div class="home-collection-circle">
                <div class="home-collection-circle-dot"></div>
            </div>
            <span class="home-collection-name">${collection.name}</span>
        </div>
    `).join('');

    collectionsNav.innerHTML = collectionsHTML + allFilesHTML;  // "All files" at the end
    
    // Add click handlers
    document.querySelectorAll('.home-collection-item').forEach(item => {
        item.addEventListener('click', () => {
            const collectionId = item.dataset.collectionId;

            // Always select - can't deselect collections
            if (collectionId === '') {
                selectedCollection = null;  // "All files"
                localStorage.removeItem('selectedCollection');
            } else {
                selectedCollection = collectionId;  // Specific collection
                localStorage.setItem('selectedCollection', collectionId);
            }

            populateHomePage();
        });

        // Long press to delete collection (only for user-created collections)
        const collectionId = item.dataset.collectionId;
        if (collectionId !== '') {  // Don't allow deleting "All files"
            let longPressTimer;
            let longPressTriggered = false;
            
            item.addEventListener('touchstart', (e) => {
                longPressTriggered = false;
                longPressTimer = setTimeout(async () => {
                    longPressTriggered = true;
                    e.preventDefault();
                    const collectionName = item.querySelector('.home-collection-name').textContent;
                    
                    if (await customConfirm(`Delete collection "${collectionName}"? The pages inside will not be deleted.`, 'Delete Collection', 'Delete')) {
                        await remove(ref(database, `users/${currentUser.uid}/collections/${collectionId}`));
                        
                        // Remove collection reference from guides
                        const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
                        const guides = guidesSnapshot.val() || {};
                        
                        for (const guideId in guides) {
                            if (guides[guideId].collectionId === collectionId) {
                                await remove(ref(database, `users/${currentUser.uid}/guides/${guideId}/collectionId`));
                            }
                        }
                        
                        selectedCollection = null;
                        populateHomePage();
                    }
                }, 500);
            });
            
            item.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });
            
            item.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });
            
            item.addEventListener('mousedown', (e) => {
                longPressTriggered = false;
                longPressTimer = setTimeout(async () => {
                    longPressTriggered = true;
                    e.preventDefault();
                    const collectionName = item.querySelector('.home-collection-name').textContent;
                    
                    if (await customConfirm(`Delete collection "${collectionName}"? The pages inside will not be deleted.`, 'Delete Collection', 'Delete')) {
                        await remove(ref(database, `users/${currentUser.uid}/collections/${collectionId}`));
                        
                        // Remove collection reference from guides
                        const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
                        const guides = guidesSnapshot.val() || {};
                        
                        for (const guideId in guides) {
                            if (guides[guideId].collectionId === collectionId) {
                                await remove(ref(database, `users/${currentUser.uid}/guides/${guideId}/collectionId`));
                            }
                        }
                        
                        selectedCollection = null;
                        populateHomePage();
                    }
                }, 500);
            });
            
            item.addEventListener('mouseup', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });
            
            item.addEventListener('mouseleave', () => {
                clearTimeout(longPressTimer);
            }, { passive: true });
        }
    });
}


        
function toggleMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('dropdownMenu');
    const floatingBtn = document.getElementById('layoutBtn');
    const isCurrentlyShown = menu.classList.contains('show');
    
    menu.classList.toggle('show');
    
    // Hide/show floating button based on menu state
    if (floatingBtn) {
        if (menu.classList.contains('show')) {
            floatingBtn.style.display = 'none';
        } else {
            floatingBtn.style.display = 'flex';
        }
    }
    
    // Close other menus
    const guideMenu = document.getElementById('guideDropdown');
    if (guideMenu) guideMenu.classList.remove('show');
    
    // If we just closed it, trigger a re-render to reset button state
    if (isCurrentlyShown) {
        // Force button to lose focus
        e.target.blur();
    }
}

// Authentication functions
// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Email/password login
 * Why check email verification: Prevents spam accounts and ensures users own their email
 */
async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;

        // Why enforce email verification: Security measure to confirm user owns the email address
        // Prevents someone from creating accounts with other people's emails
        if (!currentUser.emailVerified) {
            await customAlert('Please verify your email before logging in. Check your inbox for the verification link.', 'Email Not Verified');
            // Why sign out unverified users: Forces verification before granting access
            await signOut(auth);
            currentUser = null;
            return;
        }

        loadUserData(currentUser.uid);
    } catch (error) {
        await customAlert(error.message, 'Login Failed');
    }
}

/**
 * Create new account with email/password
 * Why send verification email: Confirms user owns the email and reduces spam/fake accounts
 */
async function signup(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;

        // Send verification email
        await sendEmailVerification(currentUser);
        await customAlert('A verification email has been sent to ' + email + '. Please check your inbox and verify your email before logging in.', 'Verify Your Email');

        // Why sign out immediately after signup: Forces user to verify email before accessing app
        // Prevents using the app with unverified accounts
        await signOut(auth);
        currentUser = null;

        backToLogin();
    } catch (error) {
        await customAlert(error.message, 'Signup Failed');
    }
}

/**
 * Google OAuth login
 * Why use Google login: Provides secure, passwordless authentication with existing Google accounts
 */
async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();

    // Why 'select_account' prompt: Always shows account picker even if user is logged into one account
    // Allows users to choose which Google account to use for this app
    provider.setCustomParameters({
        prompt: 'select_account'
    });

    try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
        // Note: Google accounts are pre-verified, no email verification check needed
        loadUserData(currentUser.uid);
    } catch (error) {
        console.error('Google login error:', error);
        await customAlert('Google login failed: ' + error.message);
    }
}

/**
 * Sign out current user
 * Why clear categories: Prevents showing previous user's data after logout
 */
function logout() {
    signOut(auth).then(() => {
        currentUser = null;
        categories = [];  // Clear local data for privacy
    });
}

function showSignup() {
    const loginScreen = document.getElementById('loginScreen');
    const signupScreen = document.getElementById('signupScreen');
    
    loginScreen.classList.remove('show');
    setTimeout(() => {
        loginScreen.style.display = 'none';
        signupScreen.style.display = 'flex';
        setTimeout(() => signupScreen.classList.add('show'), 10);
    }, 300);
}
async function processSignup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupPasswordConfirm').value;
    
    if (!email || !password) {
        await customAlert('Please enter your email and password', 'Missing Information');
        return;
    }
    
    if (password.length < 6) {
        await customAlert('Password must be at least 6 characters long', 'Invalid Password');
        return;
    }
    
    if (password !== confirmPassword) {
        await customAlert('The passwords you entered do not match', 'Password Mismatch');
        return;
    }
    
    signup(email, password);
}

function backToLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const signupScreen = document.getElementById('signupScreen');
    
    signupScreen.classList.remove('show');
    setTimeout(() => {
        signupScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.classList.add('show'), 10);
    }, 300);
}

async function deleteAccount() {
    if (!currentUser) return;
    const user = currentUser;
    const userId = user.uid;
    
    try {
        // Delete all user data from database
        await remove(ref(database, `users/${userId}`));
        
        // Delete the authentication account
        await user.delete();
        
        await customAlert('Your account has been permanently deleted.', 'Account Deleted');
        currentUser = null;
    } catch (error) {
        await customAlert(error.message, 'Error Deleting Account');
    }
}
	
function duplicateGuide() {
    if (!currentUser) return;
    const timestamp = Date.now();
    const newId = `${currentGuideId}_copy_${timestamp}`;
    
    get(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}`)).then((snapshot) => {
        const data = snapshot.val();
        if (data.appTitle) {
            data.appTitle = data.appTitle + ' (Copy)';
        }
        set(ref(database, `users/${currentUser.uid}/guides/${newId}`), data).then(() => {
            currentGuideId = newId;
            localStorage.setItem('currentGuideId', newId);
            loadUserData(currentUser.uid);
        });
    });
}

async function deleteGuide() {
    if (!currentUser) return;
    if (currentGuideId === 'defaultGuide') {
        await customAlert("The default page cannot be deleted.", "Cannot Delete");
        return;
    }
    if (await customConfirm("This will permanently delete this page and all its content. This cannot be undone.", "Delete Page")) {
        remove(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}`));
        currentGuideId = 'defaultGuide';
        localStorage.setItem('currentGuideId', 'defaultGuide');
        loadUserData(currentUser.uid);
    }
}
	
function saveHeader() {
  if (!currentUser) return;
  set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/appTitle`), appTitle);
  set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/appSubtitle`), appSubtitle);
  set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/appIcon`), appIcon);
  renderHeader();

}

// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================
// Why separate rendering functions: Keeps DOM manipulation organized and reusable
// Any state change can trigger a re-render without duplicating UI code

/**
 * Render the guide header with title, subtitle, and theme controls
 * Why async: Loads header image from Firebase if it exists
 */
async function renderHeader() {
    const header = document.querySelector('.header');
    
    // Generate color options HTML
let colorOptionsHTML = '';
colorThemes.forEach(theme => {
    const isSelected = theme.primary === themeColor ? 'selected' : '';
    colorOptionsHTML += `
        <div class="color-option-pill ${isSelected}" 
             data-color="${theme.primary}"
             title="${theme.name}">
            <div class="color-pill-half" style="background: ${theme.secondary};"></div>
            <div class="color-pill-half" style="background: ${theme.primary};"></div>
        </div>
    `;
});
    const backButton = `
        <button class="header-back-btn" id="headerBackBtn" style="display: none;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        </button>
    `;
        header.innerHTML = `
        ${backButton}
	
	<div class="edit-toggle">
	    <button class="save-btn" id="saveBtn" style="display: none;">Done</button>
	    <button class="edit-btn" id="menuBtn" style="display: block;">⋮</button>
	    <div class="dropdown-menu" id="dropdownMenu">
	        <button id="editModeMenuBtn">Edit</button>
	        <button id="duplicateGuideBtn">Duplicate</button>
	        <button id="deleteGuideBtn">Delete</button>
	        <button id="headerImageBtn">Header Image</button>
	        <div class="header-image-menu" id="headerImageMenu">
	            <h3>Header Background</h3>
	            <input type="file" id="headerImageInput" accept="image/*" style="display: none;">
	            <button id="uploadHeaderImageBtn" style="width: 100%; padding: 10px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px; font-weight: 500;">Upload Image</button>
	            <button id="removeHeaderImageBtn" style="width: 100%; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Remove Image</button>
	        </div>
	        <button id="wallpaperBtn">Wallpaper</button>
	        <div class="wallpaper-menu" id="wallpaperMenu">
	            <h3>Wallpaper</h3>
	            <input type="file" id="wallpaperInput" accept="image/*" style="display: none;">
	            <button id="uploadWallpaperBtn" style="width: 100%; padding: 10px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 10px; font-weight: 500;">Upload Image</button>
	            <button id="removeWallpaperBtn" style="width: 100%; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Remove Image</button>
	        </div>
	        <button id="toggleColorBtn">Theme</button>
	        <div class="color-picker-menu" id="colorPickerMenu">
	            <h3>Preset Themes</h3>
	            <div class="color-options" id="colorOptionsContainer" style="margin-bottom: 15px;">
	                ${colorOptionsHTML}
	            </div>
	            <h3>Custom Color</h3>
	            <div style="margin-bottom: 15px;">
	                <div id="colorCanvas" class="color-picker-canvas" style="background-color: hsl(0, 100%, 50%);">
	                    <div class="picker-indicator" id="canvasIndicator" style="left: 100%; top: 0%;"></div>
	                </div>
	                <div class="hue-slider" id="hueSlider">
	                    <div class="hue-indicator" id="hueIndicator" style="left: 0%;"></div>
	                </div>
	                <div style="display: flex; align-items: center; gap: 10px;">
	                    <div style="width: 32px; height: 32px; border-radius: 6px; border: 2px solid #dee2e6; background-color: ${themeColor}; flex-shrink: 0;" id="colorPreview"></div>
	                    <input type="text" id="hexInput" value="${themeColor}" 
	                           style="flex: 1; padding: 6px 8px; border: 1px solid #dee2e6; border-radius: 4px; font-family: monospace; font-size: 12px; text-transform: uppercase;"
	                           maxlength="7" placeholder="#FF0000">
	                    <button id="applyColorBtn" style="padding: 6px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;">Done</button>
	                </div>
	            </div>
	        </div>
	        <button id="checkboxOptionsBtn">Checkbox Options</button>
	        <div class="checkbox-menu" id="checkboxMenu">
	            <h3>Checkbox Actions</h3>
	            <button id="clearChecksBtn">Clear All Checks</button>
	            <button id="autoRefreshBtn">
	                ${autoRefreshEnabled ? `✓ Auto-refresh (${autoRefreshTime})` : 'Auto-refresh Daily'}
	            </button>
	        </div>
	        <button id="singlePageViewBtn" class="${categories[activeTabIndex] && categories[activeTabIndex].skills && categories[activeTabIndex].skills.length === 1 ? '' : 'disabled'}">
	            ${categories[activeTabIndex] && categories[activeTabIndex].singlePageViewEnabled ? '✓ ' : ''}Single Page View
	        </button>
	    </div>
	</div>
	<h1>
	    <span class="editable-icon" id="appIconContainer" style="display: inline-block; position: relative; margin-right: 8px;">
	        <span class="icon" id="appIconSpan" style="cursor: ${editMode ? 'pointer' : 'default'}; opacity: ${appIcon && appIcon !== "​" ? '1' : '0.3'};">${
	            (() => {
	                const hasIconContent = appIcon && appIcon !== "​";
	                if (hasIconContent) {
	                    if (appIcon.startsWith('svg:')) {
	                        const iconData = JSON.parse(appIcon.substring(4));
	                        return `<span style="display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconData.path}"/></svg></span>`;
	                    } else {
	                        return appIcon;
	                    }
	                } else {
	                    return editMode ? "+" : "​";
	                }
	            })()
	        }</span>
	        ${editMode && appIcon && appIcon !== "​" ? '<span class="emoji-remove-btn" id="removeAppIconBtn">×</span>' : ''}
	    </span>
	    <span class="${editMode ? 'editable' : ''}" id="appTitleSpan" contenteditable="${editMode}">
	        ${appTitle}
	    </span>
	</h1>
	<p class="${editMode ? 'editable' : ''}" id="appSubtitleSpan" contenteditable="${editMode}">${appSubtitle}</p>
`;
	
    // Add event listeners after HTML is rendered
    const guideMenuBtn = document.getElementById('guideMenuBtn');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    const createGuideBtn = document.getElementById('createGuideBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const saveBtn = document.getElementById('saveBtn');
    const menuBtn = document.getElementById('menuBtn');
    const editModeMenuBtn = document.getElementById('editModeMenuBtn');
    const duplicateGuideBtn = document.getElementById('duplicateGuideBtn');
    const deleteGuideBtn = document.getElementById('deleteGuideBtn');
    const toggleColorBtn = document.getElementById('toggleColorBtn');
	const applyColorBtn = document.getElementById('applyColorBtn');
    const appIconSpan = document.getElementById('appIconSpan');
    const removeAppIconBtn = document.getElementById('removeAppIconBtn');
    const headerImageBtn = document.getElementById('headerImageBtn');
    const uploadHeaderImageBtn = document.getElementById('uploadHeaderImageBtn');
    const removeHeaderImageBtn = document.getElementById('removeHeaderImageBtn');
    const headerImageInput = document.getElementById('headerImageInput');
	const wallpaperBtn = document.getElementById('wallpaperBtn');
	const uploadWallpaperBtn = document.getElementById('uploadWallpaperBtn');
	const removeWallpaperBtn = document.getElementById('removeWallpaperBtn');
	const wallpaperInput = document.getElementById('wallpaperInput');
	const checkboxOptionsBtn = document.getElementById('checkboxOptionsBtn');
	const clearChecksBtn = document.getElementById('clearChecksBtn');
	const autoRefreshBtn = document.getElementById('autoRefreshBtn');
	const singlePageViewBtn = document.getElementById('singlePageViewBtn');
	// Back button handler
    setTimeout(() => {
        const backBtn = document.getElementById('headerBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Go back to home page
            document.querySelector('.container').style.display = 'none';
			document.body.classList.remove('viewing-guide');
            const homePage = document.getElementById('homePage');
            if (homePage) {
                homePage.classList.add('active');
                populateHomePage();
            }
            
            localStorage.setItem('currentPage', 'guides');
            
            // Update bottom nav
            document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.bottom-nav-item')[0]?.classList.add('active');
            
            // Hide back button
            backBtn.style.display = 'none';
        });
    }
		}, 100);
	
  	if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
    if (saveBtn) saveBtn.addEventListener('click', saveAndExitEdit);
	if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
	if (editModeMenuBtn) editModeMenuBtn.addEventListener('click', toggleEditMode);
	if (duplicateGuideBtn) duplicateGuideBtn.addEventListener('click', duplicateGuide);
	if (deleteGuideBtn) deleteGuideBtn.addEventListener('click', deleteGuide);
	if (toggleColorBtn) toggleColorBtn.addEventListener('click', toggleColorPicker);
	if (clearChecksBtn) clearChecksBtn.addEventListener('click', clearAllChecks);
	if (autoRefreshBtn) autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
	if (applyColorBtn) applyColorBtn.addEventListener('click', applyCustomColor);
	if (singlePageViewBtn) singlePageViewBtn.addEventListener('click', toggleSinglePageView);

    // Header image event listeners
    if (headerImageBtn) {
	    headerImageBtn.addEventListener('click', (e) => {
	        e.stopPropagation();
	        const imageMenu = document.getElementById('headerImageMenu');
	        const colorMenu = document.getElementById('colorPickerMenu');
	        const checkboxMenu = document.getElementById('checkboxMenu');
	        const uploadBtn = document.getElementById('uploadHeaderImageBtn');
	        const removeBtn = document.getElementById('removeHeaderImageBtn');
	        
	        if (colorMenu) colorMenu.classList.remove('show');
	        if (checkboxMenu) checkboxMenu.classList.remove('show');
	        
	        // Update button visibility based on current state
	        if (headerImage) {
	            if (uploadBtn) uploadBtn.style.display = 'none';
	            if (removeBtn) removeBtn.style.display = 'block';
	        } else {
	            if (uploadBtn) uploadBtn.style.display = 'block';
	            if (removeBtn) removeBtn.style.display = 'none';
	        }
	        
	        if (imageMenu) {
	            imageMenu.classList.toggle('show');
	        }
	    });
	}

    if (uploadHeaderImageBtn) {
        uploadHeaderImageBtn.addEventListener('click', () => {
            headerImageInput.click();
        });
    }

    if (headerImageInput) {
	    headerImageInput.addEventListener('change', (e) => {
	        const file = e.target.files[0];
	        if (file) {
	            console.log('File selected:', file.name);
	            const reader = new FileReader();
	            reader.onload = (event) => {
	                headerImage = event.target.result;
	                console.log('Image loaded, length:', headerImage.length);
	                saveHeaderImage();
	                console.log('Save called');
	                renderHeader();
	                setTimeout(() => applyHeaderImage(), 100); // Give header time to render
	                document.getElementById('headerImageMenu').classList.remove('show');
	                document.getElementById('dropdownMenu').classList.remove('show');
	            };
	            reader.readAsDataURL(file);
	        }
	    });
	}

    if (removeHeaderImageBtn) {
	    removeHeaderImageBtn.addEventListener('click', async () => {
	        if (await customConfirm('Remove header background image?')) {
	            headerImage = null;
	            saveHeaderImage();
	            applyHeaderImage();
	            document.getElementById('headerImageMenu').classList.remove('show');
	            document.getElementById('dropdownMenu').classList.remove('show');
	            renderHeader(); 
	        }
	    });
	}


// Wallpaper button click handler
if (wallpaperBtn) {
    wallpaperBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wallpaperMenu = document.getElementById('wallpaperMenu');
        const colorMenu = document.getElementById('colorPickerMenu');
        const checkboxMenu = document.getElementById('checkboxMenu');
        const headerImageMenu = document.getElementById('headerImageMenu');
        const uploadBtn = document.getElementById('uploadWallpaperBtn');
        const removeBtn = document.getElementById('removeWallpaperBtn');
        
        if (colorMenu) colorMenu.classList.remove('show');
        if (checkboxMenu) checkboxMenu.classList.remove('show');
        if (headerImageMenu) headerImageMenu.classList.remove('show');
        
        // Update button visibility based on current state
        if (wallpaperUrl) {
            if (uploadBtn) uploadBtn.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'block';
        } else {
            if (uploadBtn) uploadBtn.style.display = 'block';
            if (removeBtn) removeBtn.style.display = 'none';
        }
        
        if (wallpaperMenu) {
            wallpaperMenu.classList.toggle('show');
        }
    });
}

if (uploadWallpaperBtn) {
    uploadWallpaperBtn.addEventListener('click', () => {
        wallpaperInput.click();
    });
}

if (wallpaperInput) {
    wallpaperInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('Wallpaper file selected:', file.name);
            const reader = new FileReader();
            reader.onload = (event) => {
                wallpaperUrl = event.target.result;
                console.log('Wallpaper loaded, length:', wallpaperUrl.length);
                saveWallpaper();
                applyWallpaper();
                document.getElementById('wallpaperMenu').classList.remove('show');
                document.getElementById('dropdownMenu').classList.remove('show');
            };
            reader.readAsDataURL(file);
        }
    });
}


if (removeWallpaperBtn) {
    removeWallpaperBtn.addEventListener('click', async () => {
        if (await customConfirm('Remove wallpaper?')) {
            wallpaperUrl = '';
            saveWallpaper();
            applyWallpaper();
            document.getElementById('wallpaperMenu').classList.remove('show');
            document.getElementById('dropdownMenu').classList.remove('show');
        }
    });
}
	
    // App icon editing
    if (editMode && appIconSpan) {
        appIconSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            editAppIcon(appIconSpan);
        });
    }
    if (removeAppIconBtn) {
        removeAppIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appIcon = '​';
            saveHeader();
        });
    }
    
    // Color option clicks
    const colorOptions = document.querySelectorAll('.color-option-pill');
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            selectColor(option.dataset.color);
        });
    });

	// Checkbox options button and menu
if (checkboxOptionsBtn) {
    checkboxOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const checkboxMenu = document.getElementById('checkboxMenu');
        const colorMenu = document.getElementById('colorPickerMenu');
        
        // Close color picker if open
        if (colorMenu) colorMenu.classList.remove('show');
        
        if (checkboxMenu) {
            checkboxMenu.classList.toggle('show');
        }
    });
}

// Clear checks button
if (clearChecksBtn) {
    clearChecksBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllChecks();
        const checkboxMenu = document.getElementById('checkboxMenu');
        const dropdownMenu = document.getElementById('dropdownMenu');
        if (checkboxMenu) checkboxMenu.classList.remove('show');
        if (dropdownMenu) dropdownMenu.classList.remove('show');
    });
}

// Auto-refresh button
if (autoRefreshBtn) {
    autoRefreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAutoRefresh();
        const checkboxMenu = document.getElementById('checkboxMenu');
        const dropdownMenu = document.getElementById('dropdownMenu');
        if (checkboxMenu) checkboxMenu.classList.remove('show');
        if (dropdownMenu) dropdownMenu.classList.remove('show');
    });
}
    
	// Dynamic styles and theme application...
	    const isLight = isLightColor(themeColor);
	    if (isLight) {
	        const style = document.createElement('style');
	        style.id = 'dynamic-header-style';
	        const existingStyle = document.getElementById('dynamic-header-style');
	        if (existingStyle) existingStyle.remove();
	        
	        style.textContent = `
	            .header .editable:focus { 
	                outline: 2px solid #2c3e50 !important; 
	                background: rgba(255, 255, 255, 0.5) !important; 
	                color: #2c3e50 !important; 
	            }
	            .header .editable:hover { 
	                background: rgba(0, 0, 0, 0.1) !important; 
	            }
	        `;
	        document.head.appendChild(style);
	    } else {
	        const existingStyle = document.getElementById('dynamic-header-style');
	        if (existingStyle) existingStyle.remove();
	    }

    applyTheme();
    

    // Add double-click edit for header (only when not in edit mode)
    if (!editMode) {
        const h1 = header.querySelector('h1');
        const spans = h1 ? h1.querySelectorAll('span') : [];
        const headerTitle = spans.length > 0 ? spans[spans.length - 1] : null;
        const headerSubtitle = header.querySelector('p');
        
        if (headerTitle) {
            headerTitle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                enableQuickEditHeader(headerTitle, 'title');
            });
        }
        
        if (headerSubtitle) {
            headerSubtitle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                enableQuickEditHeader(headerSubtitle, 'subtitle');
            });
        }
    }

    if (editMode) {
        setTimeout(() => {
            const saveBtn = document.getElementById('saveBtn');
            const menuBtn = document.getElementById('menuBtn');
            if (saveBtn) saveBtn.style.display = 'block';
            if (menuBtn) menuBtn.style.display = 'none';
        }, 0);
    }
    
    if (editMode) {
        const editableTitle = header.querySelector('#appTitleSpan');
        const editableSubtitle = header.querySelector('#appSubtitleSpan');
        
        if (editableTitle) {
            editableTitle.addEventListener('blur', (e) => {
                appTitle = e.target.textContent.trim();
                saveHeader();
            });
        }
        if (editableSubtitle) {
            editableSubtitle.addEventListener('blur', (e) => {
                appSubtitle = e.target.textContent.trim();
                saveHeader();
            });
        }
    }
    
}

let homeSelectMode = false;
let selectedGuides = new Set();

async function populateHomePage() {
    console.log('Page is loading');
    console.log('Search button exists?', document.getElementById('homeSearchBtn'));
    console.log('Create button exists?', document.getElementById('homeCreateBtn'));
    console.log('Menu button exists?', document.getElementById('homeMenuBtn'));
    console.log('Search button already initialized?', document.getElementById('homeSearchBtn')?.dataset.initialized);
    if (!currentUser) return;
    
    // Exit select mode when re-populating
    if (homeSelectMode) {
        toggleSelectMode();
    }
    
    // Populate collections first
    try {
        await populateCollections();
    } catch (error) {
        console.error('Error in populateCollections:', error);
    }
    
    const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
    const guides = guidesSnapshot.val() || {};
    const guidesList = document.getElementById('homeGuidesList');
    
    if (!guidesList) return;
    
    // Convert guides to array
    let guidesArray = Object.keys(guides).map(id => ({
        id: id,
        title: guides[id].appTitle || 'Untitled',
        subtitle: guides[id].appSubtitle || 'No description',
        icon: guides[id].appIcon || '📄',
        color: guides[id].themeColor || '#3498db',
        collectionId: guides[id].collectionId || null,
        templateType: guides[id].templateType || null  // null for untyped guides
    }));

    // Filter by selected collection
    let collectionGuidesArray = guidesArray;
    if (selectedCollection) {
        collectionGuidesArray = guidesArray.filter(g => g.collectionId === selectedCollection);
    }

    // Show/hide filter items based on what's in the selected collection
    const availableTypes = new Set(
        collectionGuidesArray
            .map(g => g.templateType)
            .filter(t => t !== null)  // Only count typed guides for filter visibility
    );

    // If current filter is not available in this collection, reset to 'all' (no filter)
    if (selectedFilter !== 'all' && selectedCollection && !availableTypes.has(selectedFilter)) {
        selectedFilter = 'all';
    }

    // Populate filter navigation with built-in and custom types
    await populateFilterNavigation(selectedCollection ? availableTypes : null);

    // Filter by selected template type
    // 'all' means no filter - show all guides (including untyped)
    if (selectedFilter !== 'all') {
        // When a specific filter is selected, only show guides with that exact type
        // Untyped guides (null) will NOT show in any specific filter
        guidesArray = collectionGuidesArray.filter(g => g.templateType === selectedFilter);
    } else {
        // No filter selected - show all guides including untyped ones
        guidesArray = collectionGuidesArray;
    }

    console.log('Selected filter:', selectedFilter);
    console.log('Guides after filtering:', guidesArray.map(g => ({ title: g.title, type: g.templateType })));
    
    guidesList.innerHTML = '';
    
    if (guidesArray.length === 0) {
        guidesList.innerHTML = `
            <div class="home-empty">
                <div class="home-empty-icon">📚</div>
                <div class="home-empty-text">No pages found</div>
                <div class="home-empty-subtext">${selectedCollection ? 'This collection is empty' : 'Create your first page to get started'}</div>
            </div>
        `;
        return;
    }
    
    // Render guides
    guidesArray.forEach(guide => {
    if (guide.templateType === 'journal') {
        // For journal guides, show the journal entries
        renderJournalGuideCard(guide);
    } else {
        // For regular guides
        const item = createGuideElement(guide, false);
        guidesList.appendChild(item);
    }
});
}
	
function createGuideElement(guide, isInFolder) {
    const item = document.createElement('div');
    item.className = isInFolder ? 'home-folder-guide-item' : 'home-guide-item';
    item.dataset.guideId = guide.id;
    
    if (guide.id === currentGuideId && !isInFolder) {
        item.classList.add('current');
    }
    
    // Handle icon display
    let iconDisplay = guide.icon;
    if (guide.icon && guide.icon.startsWith('svg:')) {
        try {
            const iconData = JSON.parse(guide.icon.substring(4));
            iconDisplay = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconData.path}"/></svg>`;
        } catch (e) {
            iconDisplay = guide.icon;
        }
    }
    
    const checkboxClass = isInFolder ? 'home-folder-guide-checkbox' : 'home-guide-checkbox';
    const iconClass = isInFolder ? 'home-folder-guide-icon' : 'home-guide-icon';
    const titleClass = isInFolder ? 'home-folder-guide-title' : '';
    
    if (isInFolder) {
        item.innerHTML = `
            <div class="${checkboxClass}"></div>
            <div class="${iconClass}" style="background: linear-gradient(135deg, ${guide.color}dd, ${guide.color})">
                ${iconDisplay}
            </div>
            <div class="${titleClass}">${guide.title}</div>
        `;
    } else {
        item.innerHTML = `
            <div class="${checkboxClass}"></div>
            <div class="${iconClass}" style="background: linear-gradient(135deg, ${guide.color}dd, ${guide.color})">
                ${iconDisplay}
            </div>
            <div class="home-guide-info">
                <div class="home-guide-title">${guide.title}</div>
                <div class="home-guide-meta">${guide.subtitle}</div>
            </div>
            <svg class="home-guide-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        `;
    }
    
    const checkbox = item.querySelector(`.${checkboxClass}`);
    
    // Long press support
    let longPressTimer;
    let longPressTriggered = false;
    
    item.addEventListener('touchstart', (e) => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            if (!homeSelectMode) {
                toggleSelectMode();
            }
            toggleGuideSelection(guide.id, checkbox);
        }, 500);
    });
    
    item.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    item.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    });
    
    item.addEventListener('mousedown', (e) => {
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            if (!homeSelectMode) {
                toggleSelectMode();
            }
            toggleGuideSelection(guide.id, checkbox);
        }, 500);
    });
    
    item.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer);
    });
    
    item.addEventListener('mouseleave', () => {
        clearTimeout(longPressTimer);
    });
    
    item.addEventListener('click', (e) => {
        if (longPressTriggered) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
		if (homeSelectMode) {
		    e.stopPropagation();
		    toggleGuideSelection(guide.id, checkbox);
		} else {
		    switchGuide(guide.id);
		    localStorage.setItem('currentPage', 'guides');
		    document.getElementById('homePage').classList.remove('active');
		    document.querySelector('.container').style.display = 'block';
		    document.body.classList.add('viewing-guide');  
		    document.querySelectorAll('.bottom-nav-item').forEach(nav => nav.classList.remove('active'));
		    document.querySelectorAll('.bottom-nav-item')[0].classList.add('active');
		    
		    // Show back button
		    setTimeout(() => {
		        const backBtn = document.getElementById('headerBackBtn');
		        if (backBtn) {
		            backBtn.style.display = 'flex';
		        }
		    }, 100);
		}
		});
		
		return item;
		}

async function renderJournalGuideCard(guide) {
    const guidesList = document.getElementById('homeGuidesList');
    if (!guidesList) return;
    
    // Get journal entries
    const entriesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides/${guide.id}/journalEntries`));
    const entries = entriesSnapshot.val() || {};
    
    // Create journal card
    const journalCard = document.createElement('div');
    journalCard.className = 'home-guide-item';
    journalCard.style.cursor = 'pointer';
    
    const entriesCount = Object.keys(entries).length;
    
    journalCard.innerHTML = `
        <div class="home-guide-icon" style="background: linear-gradient(135deg, ${guide.color}, ${guide.color}dd);">${guide.icon}</div>
        <div class="home-guide-content">
            <div class="home-guide-title">${guide.title}</div>
            <div class="home-guide-subtitle">${entriesCount} ${entriesCount === 1 ? 'entry' : 'entries'}</div>
        </div>
        <svg class="home-guide-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
    `;
    
    journalCard.addEventListener('click', () => {
        showJournalEntriesList(guide.id);
    });
    
    guidesList.appendChild(journalCard);
}

async function showJournalEntriesList(journalGuideId) {
    // Store current guide ID
    currentGuideId = journalGuideId;
    localStorage.setItem('currentGuideId', journalGuideId);
    
    // Get journal entries
    const entriesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides/${journalGuideId}/journalEntries`));
    const entries = entriesSnapshot.val() || {};
    
    const entriesArray = Object.keys(entries).map(id => ({
        id: id,
        ...entries[id]
    })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    const guidesList = document.getElementById('homeGuidesList');
    if (!guidesList) return;
    
    // Clear and show entries list
    guidesList.innerHTML = '';
    
    // Add header with back button and create new entry button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid #e5e7eb;';
    header.innerHTML = `
        <button id="journalListBackBtn" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 15px; color: #2c3e50; font-weight: 500;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
        </button>
        <button id="createJournalEntryBtn" style="padding: 10px 20px; background: var(--primary-color, #3498db); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s;">
            + New Entry
        </button>
    `;
    guidesList.appendChild(header);
    
    // Add event listeners
    document.getElementById('journalListBackBtn')?.addEventListener('click', () => {
        populateHomePage();
    });
    
    document.getElementById('createJournalEntryBtn')?.addEventListener('click', () => {
        createJournalEntry(journalGuideId);
    });
    
    // Show entries or empty state
    if (entriesArray.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'home-empty';
        empty.innerHTML = `
            <div class="home-empty-icon">📔</div>
            <div class="home-empty-text">No journal entries yet</div>
            <div class="home-empty-subtext">Click "New Entry" to start writing</div>
        `;
        guidesList.appendChild(empty);
    } else {
        entriesArray.forEach(entry => {
            const entryCard = document.createElement('div');
            entryCard.className = 'home-guide-item';
            entryCard.style.cursor = 'pointer';
            
            const date = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            const preview = entry.content ? entry.content.substring(0, 60) + (entry.content.length > 60 ? '...' : '') : 'No content';
            
            entryCard.innerHTML = `
                <div class="home-guide-icon" style="background: linear-gradient(135deg, var(--primary-color, #3498db), var(--secondary-color, #27ae60));">${entry.icon || '📝'}</div>
                <div class="home-guide-content">
                    <div class="home-guide-title">${entry.title || 'Untitled Entry'}</div>
                    <div class="home-guide-subtitle">${date} ${entry.mood ? '• ' + entry.mood : ''}</div>
                    <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">${preview}</div>
                </div>
                <svg class="home-guide-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            `;
            
            entryCard.addEventListener('click', () => {
                openJournalEditor(journalGuideId, entry.id);
            });
            
            guidesList.appendChild(entryCard);
        });
    }
}
	
function toggleSelectMode() {
    homeSelectMode = !homeSelectMode;
    selectedGuides.clear();
    
    const actionsBar = document.getElementById('homeActionsBar');
    const guidesList = document.getElementById('homeGuidesList');
    const selectMenuBtn = document.getElementById('homeSelectMenuBtn');
    
    if (homeSelectMode) {
    // Entering select mode
    if (selectMenuBtn) {
        selectMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Cancel`;
    }
    if (actionsBar) {
        actionsBar.classList.add('show');
    }
    
    // Add select mode to all guide items (both regular and folder guides)
    if (guidesList) {
        const items = guidesList.querySelectorAll('.home-guide-item, .home-folder-guide-item');
        const checkboxes = guidesList.querySelectorAll('.home-guide-checkbox, .home-folder-guide-checkbox');
        
        console.log('Found items:', items.length);
        console.log('Found checkboxes:', checkboxes.length);
        
        items.forEach((item, index) => {
            console.log(`Item ${index} classes before:`, item.className);  // ← ADD THIS
            item.classList.add('select-mode');
            console.log(`Item ${index} classes after:`, item.className);   // ← ADD THIS
        });
        
        checkboxes.forEach((cb, index) => {
            console.log(`Checkbox ${index} classes:`, cb.className);  // ← ADD THIS
            cb.classList.add('show');
        });
    }
    } else {
        // Exiting select mode
        if (selectMenuBtn) {
            selectMenuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>Select`;
        }
        if (actionsBar) {
            actionsBar.classList.remove('show');
        }
        
        // Remove select mode from all guide items
        if (guidesList) {
            const items = guidesList.querySelectorAll('.home-guide-item, .home-folder-guide-item');
            const checkboxes = guidesList.querySelectorAll('.home-guide-checkbox, .home-folder-guide-checkbox');
            
            items.forEach(item => item.classList.remove('select-mode'));
            checkboxes.forEach(cb => {
                cb.classList.remove('show', 'checked');
            });
        }
    }
}

function toggleGuideSelection(guideId, checkbox) {
    if (selectedGuides.has(guideId)) {
        selectedGuides.delete(guideId);
        checkbox.classList.remove('checked');
    } else {
        selectedGuides.add(guideId);
        checkbox.classList.add('checked');
    }
}


// Reuse these same handlers for drawer items
function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.guideId || this.dataset.catIndex);

    // Create and insert a placeholder element
    placeholder = document.createElement('div');
    placeholder.className = 'guide-placeholder';
    placeholder.style.height = `${this.offsetHeight}px`;
    placeholder.style.border = '2px dashed #aaa';
    placeholder.style.borderRadius = '6px';
    placeholder.style.margin = '4px 0';
    this.parentNode.insertBefore(placeholder, this.nextSibling);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.guide-item').forEach(item => item.classList.remove('drag-over'));
    
    // Remove placeholder
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;
    draggedElement = null;
}

function handleDragEnter(e) {
    e.preventDefault();
    if (!draggedElement || this === draggedElement) return;

    const parent = this.parentNode;
    const items = Array.from(parent.querySelectorAll('.guide-item'));
    const draggedIndex = items.indexOf(draggedElement);
    const targetIndex = items.indexOf(this);

    // Move placeholder visually
    if (draggedIndex < targetIndex) {
        parent.insertBefore(placeholder, this.nextSibling);
    } else {
        parent.insertBefore(placeholder, this);
    }
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.stopPropagation();
    if (!placeholder || !draggedElement || !currentUser) return false;

    const parent = placeholder.parentNode;
    parent.insertBefore(draggedElement, placeholder);
    placeholder.remove();

    // Save new order to Firebase
    const newOrder = Array.from(parent.querySelectorAll('.guide-item'))
        .map(item => item.dataset.guideId);
    set(ref(database, `users/${currentUser.uid}/guideOrder`), newOrder).then(() => {
        console.log('Guide order saved');
    });

    draggedElement.classList.remove('dragging');
    draggedElement = null;
    placeholder = null;

    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}


function saveAndExitEdit() {
    editMode = false;
    document.body.classList.remove('edit-mode-active');
    
    // Hide save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }
    
    renderHeader();
    renderTabs();
    renderContent();
}
		
function showEmojiPicker(target, callback) {
    const existingInput = document.querySelector('.emoji-input-field');
    if (existingInput) {
        existingInput.remove();
        return;
    }
    
    const inputWrapper = document.createElement('div');
    inputWrapper.style.position = 'fixed';
    inputWrapper.style.top = '50%';
    inputWrapper.style.left = '50%';
    inputWrapper.style.transform = 'translate(-50%, -50%)';
    inputWrapper.style.background = 'white';
    inputWrapper.style.padding = '20px';
    inputWrapper.style.borderRadius = '12px';
    inputWrapper.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    inputWrapper.style.zIndex = '10000';
    inputWrapper.style.maxWidth = '500px';
    inputWrapper.style.maxHeight = '80vh';
    inputWrapper.style.overflowY = 'auto';
    inputWrapper.className = 'emoji-input-field';
    
    // Prevent clicks inside from bubbling
    inputWrapper.addEventListener('click', (e) => e.stopPropagation());
    
    // Tabs
    const tabContainer = document.createElement('div');
    tabContainer.style.display = 'flex';
    tabContainer.style.gap = '10px';
    tabContainer.style.marginBottom = '15px';
    tabContainer.style.borderBottom = '2px solid #e0e0e0';
    
    const emojiTab = document.createElement('button');
    emojiTab.textContent = '😀 Emoji';
    emojiTab.style.flex = '1';
    emojiTab.style.padding = '10px';
    emojiTab.style.border = 'none';
    emojiTab.style.background = 'none';
    emojiTab.style.cursor = 'pointer';
    emojiTab.style.borderBottom = '3px solid #3498db';
    emojiTab.style.fontWeight = 'bold';
    emojiTab.style.color = '#3498db';
    
    const iconTab = document.createElement('button');
    iconTab.textContent = '🎨 Icons';
    iconTab.style.flex = '1';
    iconTab.style.padding = '10px';
    iconTab.style.border = 'none';
    iconTab.style.background = 'none';
    iconTab.style.cursor = 'pointer';
    iconTab.style.color = '#666';
    
    tabContainer.appendChild(emojiTab);
    tabContainer.appendChild(iconTab);
    inputWrapper.appendChild(tabContainer);
    
    // Content containers
    const emojiContent = document.createElement('div');
    const iconContent = document.createElement('div');
    iconContent.style.display = 'none';
    
    // Emoji input section
    const label = document.createElement('div');
    label.textContent = 'Paste or type emoji:';
    label.style.marginBottom = '10px';
    label.style.fontSize = '14px';
    label.style.color = '#2c3e50';
    emojiContent.appendChild(label);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 20;
    input.style.fontSize = '32px';
    input.style.width = '100%';
    input.style.textAlign = 'center';
    input.style.border = '2px solid #3498db';
    input.style.borderRadius = '8px';
    input.style.padding = '10px';
    input.style.outline = 'none';
    input.placeholder = '✅';
    
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*(\p{Emoji_Modifier})?/gu;
        const matches = value.match(emojiRegex);
        
        if (matches && matches.length > 0) {
            e.target.value = matches[0];
        } else if (value.length > 0) {
            e.target.value = '';
        }
    });
    
    emojiContent.appendChild(input);
    
    // Icon grid
    const iconGrid = document.createElement('div');
    iconGrid.style.display = 'grid';
    iconGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(60px, 1fr))';
    iconGrid.style.gap = '10px';
    iconGrid.style.maxHeight = '300px';
    iconGrid.style.overflowY = 'auto';
    
    svgIcons.forEach(icon => {
        const iconBtn = document.createElement('button');
        iconBtn.style.width = '60px';
        iconBtn.style.height = '60px';
        iconBtn.style.borderRadius = '8px';
        iconBtn.style.border = '2px solid transparent';
        iconBtn.style.cursor = 'pointer';
        iconBtn.style.backgroundColor = icon.bg;
        iconBtn.style.display = 'flex';
        iconBtn.style.alignItems = 'center';
        iconBtn.style.justifyContent = 'center';
        iconBtn.style.transition = 'all 0.2s';
        iconBtn.title = icon.name;
        
        iconBtn.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
        
        iconBtn.addEventListener('mouseover', () => {
            iconBtn.style.transform = 'scale(1.1)';
            iconBtn.style.borderColor = '#3498db';
        });
        iconBtn.addEventListener('mouseout', () => {
            iconBtn.style.transform = 'scale(1)';
            iconBtn.style.borderColor = 'transparent';
        });
        
        iconBtn.addEventListener('click', () => {
            // Store as SVG data
            callback(`svg:${JSON.stringify({name: icon.name, bg: icon.bg, path: icon.path})}`);
            inputWrapper.remove();
        });
        
        iconGrid.appendChild(iconBtn);
    });
    
    iconContent.appendChild(iconGrid);
    
    inputWrapper.appendChild(emojiContent);
    inputWrapper.appendChild(iconContent);
    
    // Tab switching
    emojiTab.addEventListener('click', () => {
        emojiTab.style.borderBottom = '3px solid #3498db';
        emojiTab.style.fontWeight = 'bold';
        emojiTab.style.color = '#3498db';
        iconTab.style.borderBottom = 'none';
        iconTab.style.fontWeight = 'normal';
        iconTab.style.color = '#666';
        emojiContent.style.display = 'block';
        iconContent.style.display = 'none';
    });
    
    iconTab.addEventListener('click', () => {
        iconTab.style.borderBottom = '3px solid #3498db';
        iconTab.style.fontWeight = 'bold';
        iconTab.style.color = '#3498db';
        emojiTab.style.borderBottom = 'none';
        emojiTab.style.fontWeight = 'normal';
        emojiTab.style.color = '#666';
        iconContent.style.display = 'block';
        emojiContent.style.display = 'none';
    });
    
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '15px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    confirmBtn.style.flex = '1';
    confirmBtn.style.padding = '8px';
    confirmBtn.style.background = '#27ae60';
    confirmBtn.style.color = 'white';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '6px';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.addEventListener('click', () => {
        if (input.value) {
            callback(input.value);
        }
        inputWrapper.remove();
    });
    buttonContainer.appendChild(confirmBtn);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.flex = '1';
    cancelBtn.style.padding = '8px';
    cancelBtn.style.background = '#95a5a6';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => inputWrapper.remove());
    buttonContainer.appendChild(cancelBtn);
    
    emojiContent.appendChild(buttonContainer);
    
    document.body.appendChild(inputWrapper);
    input.focus();
    
    setTimeout(() => {
        document.addEventListener('click', function closeInput(e) {
            if (!inputWrapper.contains(e.target)) {
                inputWrapper.remove();
                document.removeEventListener('click', closeInput);
            }
        });
    }, 100);
}

// ============================================================================
// DATA PERSISTENCE FUNCTIONS
// ============================================================================
// Why separate save functions: Each data type can be saved independently
// Avoids unnecessary writes to Firebase (only save what changed)

/**
 * Save categories array to Firebase
 *
 * What: Persists entire categories structure (tabs, skills, items) to database
 * Why called frequently: Any edit to categories, skills, or items triggers this
 * (adding, deleting, reordering, renaming)
 */
function saveCategories() {
    // Why check currentUser: Prevent errors if user logs out mid-session
    if (!currentUser) return;

    // Save entire categories array (includes all tabs, skills, and items)
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/categories`), categories);
}

/**
 * Save checked items state to Firebase
 *
 * What: Persists which checklist items are checked/unchecked
 * Why separate from categories: Checking items is frequent, categories change less often
 * (reduces database writes = better performance and lower costs)
 */
function saveCheckedItems() {
    if (!currentUser) return;

    // checkedItems format: { 'catIndex-skillIndex-itemIndex': true/false }
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/checkedItems`), checkedItems);
}

/**
 * Save auto-refresh configuration to Firebase
 *
 * What: Persists auto-refresh enabled state and scheduled time
 * Why: Users expect auto-refresh settings to persist across sessions
 */
function saveAutoRefreshSettings() {
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/autoRefreshEnabled`), autoRefreshEnabled);
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/autoRefreshTime`), autoRefreshTime);
}

function saveSkillReminders() {
    if (!currentUser) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/skillReminders`), skillReminders);
}

function saveItemTimers() {
    if (!currentUser || !currentGuideId) return;
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/itemTimers`), itemTimers);
}

async function loadItemTimers() {
    if (!currentUser || !currentGuideId) return;
    const snapshot = await get(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/itemTimers`));
    itemTimers = snapshot.val() || {};
}

function checkAndAutoRefresh(lastRefreshDate) {
    if (!autoRefreshEnabled || !currentUser) return;
    
    const now = new Date();
    const today = now.toDateString();
    
    // If we already refreshed today, don't do it again
    if (lastRefreshDate === today) return;
    
    // Parse the refresh time (format: "HH:MM")
    const [hours, minutes] = autoRefreshTime.split(':').map(Number);
    const refreshTime = new Date();
    refreshTime.setHours(hours, minutes, 0, 0);
    
    // If current time is past the refresh time and we haven't refreshed today
    if (now >= refreshTime && lastRefreshDate !== today) {
        // Clear all checked items
        checkedItems = {};
        saveCheckedItems();
        
        // Mark that we refreshed today
        set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/lastRefreshDate`), today);
        
        // Re-render to show unchecked items
        renderContent();
    }
}

async function clearAllChecks() {
    if (await customConfirm('This will clear all checkmarks. This cannot be undone.', 'Clear All Checks')) {
        checkedItems = {};
        saveCheckedItems();
        const today = new Date().toDateString();
        set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/lastRefreshDate`), today);
        renderContent();
    }
}

/**
 * Toggle auto-refresh feature for daily checklists
 * Why auto-refresh: Useful for daily habit trackers or todo lists that reset each day
 * User can set a specific time (e.g., midnight) when all checkmarks auto-clear
 */
async function toggleAutoRefresh() {
    const enabled = await customConfirm(
    autoRefreshEnabled
        ? 'This will disable the automatic daily refresh.'
        : `This will clear all checkmarks at ${autoRefreshTime} each day.`,
    autoRefreshEnabled ? 'Disable Auto-Refresh' : 'Enable Auto-Refresh'
);

if (enabled) {
    if (!autoRefreshEnabled) {
        // Enabling: Prompt for time
        const time = await customPrompt('Enter time in 24-hour format', autoRefreshTime, 'Set Refresh Time');

            // Why validate time format: Prevents invalid times that would break the feature
            // Regex checks for valid 24-hour format: 00:00 to 23:59
            if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                autoRefreshTime = time;
                autoRefreshEnabled = true;
            } else {
                await customAlert('Please use HH:MM format (e.g., 09:00 or 23:30)', 'Invalid Time Format');
                return;
            }
        } else {
            // Disabling: Just turn it off
            autoRefreshEnabled = false;
        }
        saveAutoRefreshSettings();
        renderHeader(); // Update menu to reflect new state
    }
}

/**
 * Render category tabs navigation
 *
 * What: Generates the horizontal tab bar showing all categories
 * Why: Users need to switch between categories; tabs provide visual navigation
 * Called: After any category change (add, delete, rename, reorder)
 */
function renderTabs() {
    const navTabs = document.getElementById('navTabs');

    // Always show tabs
    navTabs.style.display = 'flex';

    // Why clear innerHTML: Start fresh to avoid duplicate tabs from previous render
    navTabs.innerHTML = '';

    // Generate a tab for each category
    categories.forEach((cat, i) => {
        const tab = document.createElement('div');

        // Why conditional class: Active tab needs different styling to show which is selected
        tab.className = 'nav-tab' + (activeTabIndex === i ? ' active' : '');

        // Why different rendering in edit mode: Allow editing tab names and icons
        // Users can only modify tabs when explicitly in edit mode (prevents accidental changes)
        if (editMode) {
            const hasTabIcon = cat.icon && cat.icon !== "";
            let tabIconToShow;
            if (hasTabIcon) {
                if (cat.icon.startsWith('svg:')) {
                    const iconData = JSON.parse(cat.icon.substring(4));
                    tabIconToShow = `<span style="display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconData.path}"/></svg></span>`;
                } else {
                    tabIconToShow = cat.icon;
                }
            } else {
                tabIconToShow = "+";
            }
            
            tab.innerHTML = `
                <span class="editable-icon" style="display: inline-block; position: relative;">
                    <span class="tab-icon" data-cat-index="${i}" style="opacity: ${hasTabIcon ? '1' : '0.3'};">${tabIconToShow}</span>
                    ${hasTabIcon ? `<span class="emoji-remove-btn" data-cat-index="${i}">×</span>` : ''}
                </span>
                <span class="tab-name editable" contenteditable="true">${cat.name}</span>
            `;
            
			// Add event listeners for edit mode
            const tabIcon = tab.querySelector('.tab-icon');
            if (tabIcon) {
                tabIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catIndex = parseInt(tabIcon.dataset.catIndex);
                    editCategoryIcon(catIndex, tabIcon);
                });
            }
            
            const removeIconBtn = tab.querySelector('.emoji-remove-btn');
            if (removeIconBtn) {
                removeIconBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catIndex = parseInt(e.target.dataset.catIndex);
                    categories[catIndex].icon = '';
                    saveCategories();
                    renderTabs();
                    renderContent();
                });
            }
            
            const nameSpan = tab.querySelector('.tab-name');
            if (nameSpan) {
                // Enable text selection for editing
                nameSpan.style.userSelect = 'text';
                nameSpan.style.webkitUserSelect = 'text';
                nameSpan.style.cursor = 'text';
                
                nameSpan.addEventListener('blur', (e) => {
                    categories[i].name = e.target.textContent.trim();
                    saveCategories();
                });
                nameSpan.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.target.blur();
                    }
                });
                nameSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                nameSpan.addEventListener('focus', (e) => {
                    e.stopPropagation();
                });
            }
            
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('editable') && !e.target.classList.contains('editable-icon')) {
                    switchTab(i);
                }
            });
            
        } else {
            // Need to render SVG icons properly
            let displayIcon = '';
            if (cat.icon && cat.icon.startsWith('svg:')) {
                const iconData = JSON.parse(cat.icon.substring(4));
                displayIcon = `<span style="display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconData.path}"/></svg></span>`;
            } else if (cat.icon) {
                displayIcon = cat.icon;
            }
            tab.innerHTML = `${displayIcon ? `<span class="tab-icon-display">${displayIcon}</span> ` : ''}<span class="tab-name-display">${cat.name}</span>`;
            
            const nameSpan = tab.querySelector('.tab-name-display');
            
            // Use a timeout to distinguish single click from double click
            let clickTimer = null;
            let clickCount = 0;
            let isEditing = false;
            
            tab.addEventListener('click', function(e) {
                // Ignore clicks while editing
                if (isEditing) {
                    e.stopPropagation();
                    return;
                }
                
                // Ignore clicks if the name span is contenteditable
                if (nameSpan && nameSpan.contentEditable === 'true') {
                    e.stopPropagation();
                    return;
                }
                
                // Ignore clicks on the icon
                if (e.target.closest('.tab-icon-display')) {
                    return;
                }
                
                clickCount++;
                
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => {
                        // Single click - switch tab
                        if (!isEditing) {
                            switchTab(i);
                        }
                        clickCount = 0;
                    }, 250);
                } else if (clickCount === 2) {
                    // Double click - edit
                    clearTimeout(clickTimer);
                    clickCount = 0;
                    e.stopPropagation();
                    e.preventDefault();
                    if (nameSpan) {
                        isEditing = true;
                        enableQuickEdit(nameSpan, i, null, null);
                        
                        // Monitor when editing ends
                        const observer = new MutationObserver(() => {
                            if (nameSpan.contentEditable === 'false') {
                                isEditing = false;
                                observer.disconnect();
                            }
                        });
                        observer.observe(nameSpan, { attributes: true, attributeFilter: ['contenteditable'] });
                        
                        // Backup: also check on blur
                        nameSpan.addEventListener('blur', function resetEditing() {
                            setTimeout(() => {
                                isEditing = false;
                            }, 100);
                            nameSpan.removeEventListener('blur', resetEditing);
                        }, { once: true });
                    }
                }
            });
        }
        
        navTabs.appendChild(tab);
        
        if (editMode) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-tab-btn';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCategory(i);
            });
            navTabs.appendChild(deleteBtn);
        }
        
         
    }); 
    
    if (editMode) {
        const addCategoryBtn = document.createElement('button');
        addCategoryBtn.className = 'nav-tab add-category-tab';
        addCategoryBtn.textContent = '+';
        addCategoryBtn.addEventListener('click', addCategory);
        navTabs.appendChild(addCategoryBtn);
    }
    
    // Preserve Done button state if in edit mode
    if (editMode) {
        setTimeout(() => {
            const saveBtn = document.getElementById('saveBtn');
            const menuBtn = document.getElementById('menuBtn');
            if (saveBtn) saveBtn.style.display = 'block';
            if (menuBtn) menuBtn.style.display = 'none';
        }, 0);
    }
	
}
		
function toggleBulletStyle(catIndex, skillIndex) {
    const currentStyle = categories[catIndex].skills[skillIndex].bulletStyle || 'checkbox';
    const styles = ['checkbox', 'number', 'square', 'circle', 'none'];
    const currentIndex = styles.indexOf(currentStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    
    categories[catIndex].skills[skillIndex].bulletStyle = styles[nextIndex];
    saveCategories();
    renderContent();
}

function duplicateSkill(catIndex, skillIndex) {
    const originalSkill = categories[catIndex].skills[skillIndex];
    const duplicatedSkill = JSON.parse(JSON.stringify(originalSkill)); // Deep copy
    duplicatedSkill.title = duplicatedSkill.title + ' (Copy)';
    
    categories[catIndex].skills.splice(skillIndex + 1, 0, duplicatedSkill);
    saveCategories();
    renderContent();
}

function toggleSkillReminder(catIndex, skillIndex) {
    const key = `${catIndex}-${skillIndex}`;
    if (!skillReminders[key]) {
        skillReminders[key] = { enabled: true, items: {} };
    } else {
        skillReminders[key].enabled = !skillReminders[key].enabled;
    }
    saveSkillReminders();
    renderContent();
}

function showReminderPicker(catIndex, skillIndex, itemIndex) {
    const key = `${catIndex}-${skillIndex}`;
    const existingReminder = skillReminders[key]?.items?.[itemIndex] || {};
    
    // Set defaults
    const existingTime = existingReminder.time || '09:00';
    const existingDate = existingReminder.date || new Date().toISOString().split('T')[0];
    const existingDays = existingReminder.repeatDays || [];
    const existingNoDate = existingReminder.noDate || false;
    
    // Add backdrop FIRST
    const backdrop = document.createElement('div');
	backdrop.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; pointer-events: none;';
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.remove();
            document.querySelector('.reminder-time-picker')?.remove();
        }
    });
    document.body.appendChild(backdrop);
    
    // Then create picker
    const picker = document.createElement('div');
    picker.className = 'reminder-time-picker show';
	picker.style.pointerEvents = 'auto';
    picker.innerHTML = `
        <h3>Set Reminder</h3>
        <div class="reminder-datetime-container">
            <div class="reminder-datetime-half">
                <label>Time</label>
                <input type="time" id="reminderTimeInput" value="${existingTime}">
            </div>
            <div class="reminder-datetime-half">
                <label>Date</label>
                <input type="date" id="reminderDateInput" value="${existingDate}" ${existingNoDate ? 'disabled' : ''}>
            </div>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #6b7280; cursor: pointer;">
                <input type="checkbox" id="noDateCheckbox" ${existingNoDate ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                <span>No specific date</span>
            </label>
        </div>
        <div class="repeat-section" id="repeatSection" ${existingNoDate ? '' : 'style="display: none;"'}>
            <label>Repeat</label>
            <div class="repeat-days">
                <button type="button" class="day-btn" data-day="Mon">M</button>
                <button type="button" class="day-btn" data-day="Tue">T</button>
                <button type="button" class="day-btn" data-day="Wed">W</button>
                <button type="button" class="day-btn" data-day="Thu">T</button>
                <button type="button" class="day-btn" data-day="Fri">F</button>
                <button type="button" class="day-btn" data-day="Sat">S</button>
                <button type="button" class="day-btn" data-day="Sun">S</button>
            </div>
        </div>
        <div class="button-group">
            <button type="button" class="cancel-reminder">Cancel</button>
            <button type="button" class="save-reminder">Save</button>
        </div>
        ${skillReminders[key]?.items?.[itemIndex] ? '<button type="button" class="delete-reminder">Delete Reminder</button>' : ''}
    `;
    
    document.body.appendChild(picker);
    
    // Handle "No Date" checkbox logic
    const noDateCheckbox = picker.querySelector('#noDateCheckbox');
    const dateInput = picker.querySelector('#reminderDateInput');
    const repeatSection = picker.querySelector('#repeatSection');
    
    noDateCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            dateInput.disabled = true;
            dateInput.value = '';
            repeatSection.style.display = 'block';
        } else {
            dateInput.disabled = false;
            dateInput.value = new Date().toISOString().split('T')[0];
            repeatSection.style.display = 'none';
            // Clear selected days
            picker.querySelectorAll('.day-btn.selected').forEach(btn => btn.classList.remove('selected'));
        }
    });
    
    // Also disable repeat when date is manually selected
    dateInput.addEventListener('change', (e) => {
        if (e.target.value) {
            repeatSection.style.display = 'none';
            picker.querySelectorAll('.day-btn.selected').forEach(btn => btn.classList.remove('selected'));
        }
    });
    
    // Set selected days
    const dayBtns = picker.querySelectorAll('.day-btn');
    dayBtns.forEach(btn => {
        if (existingDays.includes(btn.dataset.day)) {
            btn.classList.add('selected');
        }
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.classList.toggle('selected');
        });
    });
    
    picker.querySelector('.cancel-reminder').addEventListener('click', () => {
        backdrop.remove();
        picker.remove();
    });
    
    const saveBtn = picker.querySelector('.save-reminder');
	if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const time = document.getElementById('reminderTimeInput').value;
        const noDate = document.getElementById('noDateCheckbox').checked;
        const date = noDate ? null : document.getElementById('reminderDateInput').value;
        const selectedDays = noDate ? Array.from(picker.querySelectorAll('.day-btn.selected')).map(btn => btn.dataset.day) : [];
        
        if (!skillReminders[key]) {
            skillReminders[key] = { enabled: true, items: {} };
        }
        
        if (!skillReminders[key].items) {
            skillReminders[key].items = {};
        }
        
        skillReminders[key].items[itemIndex] = {
            time: time,
            date: date,
            noDate: noDate,
            repeatDays: selectedDays
        };
        
        saveSkillReminders();
        renderContent();
        backdrop.remove();
        picker.remove();
    });
}
    
    const deleteBtn = picker.querySelector('.delete-reminder');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (skillReminders[key]?.items?.[itemIndex]) {
                delete skillReminders[key].items[itemIndex];
                saveSkillReminders();
                renderContent();
            }
            backdrop.remove();
            picker.remove();
        });
    }
}

function showTimerPicker(catIndex, skillIndex, itemIndex) {
    const key = `${catIndex}-${skillIndex}-${itemIndex}`;
    const existingTimer = itemTimers[key] || { hours: 0, minutes: 0 };
    
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000;';
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.remove();
            document.querySelector('.timer-picker')?.remove();
        }
    });
    document.body.appendChild(backdrop);
    
    const picker = document.createElement('div');
    picker.className = 'timer-picker show';
    picker.innerHTML = `
	    <h3>Set Timer</h3>
	    <div class="timer-inputs">
	        <div class="timer-input-group">
	            <label>Hours</label>
	            <input type="number" id="timerHoursInput" min="0" max="23" value="${existingTimer.hours || 0}">
	        </div>
	        <div class="timer-input-group">
	            <label>Minutes</label>
	            <input type="number" id="timerMinutesInput" min="0" max="59" value="${existingTimer.minutes || 0}">
	        </div>
	    </div>
	    <div class="button-group">
	        <button class="cancel-timer">Cancel</button>
	        <button class="save-timer">Save</button>
	    </div>
	    ${itemTimers[key] ? '<button class="delete-timer">Remove Timer</button>' : ''}
	`;
    
    document.body.appendChild(picker);
    
    picker.querySelector('.cancel-timer').addEventListener('click', () => {
        backdrop.remove();
        picker.remove();
    });
    
    picker.querySelector('.save-timer').addEventListener('click', () => {
        const hours = parseInt(document.getElementById('timerHoursInput').value) || 0;
        const minutes = parseInt(document.getElementById('timerMinutesInput').value) || 0;
        
        if (hours === 0 && minutes === 0) {
            customAlert('Please set at least 1 minute or 1 hour', 'Invalid Timer');
            return;
        }
        
        itemTimers[key] = { hours, minutes };
        saveItemTimers();
        renderContent();
        backdrop.remove();
        picker.remove();
    });
    
    const deleteBtn = picker.querySelector('.delete-timer');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            delete itemTimers[key];
            saveItemTimers();
            renderContent();
            backdrop.remove();
            picker.remove();
        });
    }
}
	
function toggleSkillHeading(catIndex, skillIndex) {
    const skill = categories[catIndex].skills[skillIndex];
    skill.hideHeading = !skill.hideHeading;
    saveCategories();
    renderContent();
}
	
function toggleTimerForSkill(catIndex, skillIndex) {
    const key = `${catIndex}-${skillIndex}`;
    if (!itemTimers[key]) {
        itemTimers[key] = { enabled: true };
    } else {
        itemTimers[key].enabled = !itemTimers[key].enabled;
    }
    saveItemTimers();
    renderContent();
}

function toggleItemBackground(catIndex, skillIndex) {
    const skill = categories[catIndex].skills[skillIndex];
    skill.hideItemBackground = !skill.hideItemBackground;
    saveCategories();
    renderContent();
}
/**
 * Render single-page editor view (like Notion)
 *
 * What: Converts all categories and skills into a single editable document
 * Why: Provides continuous writing experience instead of separate cards
 * How: Uses contenteditable div with markdown-like formatting
 */
function renderSinglePageEditor() {
    const contentArea = document.getElementById('contentArea');
    contentArea.className = 'content-area single-page-mode';
    // Remove all padding from content area
    contentArea.style.cssText = `
        padding: 0;
        margin: 0;
    `;

    // Create main editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'single-page-editor';
    editorContainer.style.cssText = `
        width: 100%;
        margin: 0;
        padding: 0;
        background: var(--card-bg);
        min-height: calc(100vh - 120px);
    `;

    // Create editable content area
    const editorContent = document.createElement('div');
    editorContent.className = 'single-page-content';
    editorContent.contentEditable = 'true';
    editorContent.style.cssText = `
        outline: none;
        font-size: 16px;
        line-height: 1.6;
        color: var(--text-primary);
        white-space: pre-wrap;
        word-wrap: break-word;
        padding: 16px;
        min-height: calc(100vh - 120px);
    `;

    // Convert current category's skills to markdown-like text
    let content = '';
    const currentCategory = categories[activeTabIndex];

    if (currentCategory) {
        // Skills as headings with items (no need for category heading since it's in the tab)
        currentCategory.skills.forEach((skill, skillIndex) => {
            content += `# ${skill.title}\n\n`;

            if (skill.items && skill.items.length > 0) {
                skill.items.forEach(item => {
                    content += `• ${item}\n`;
                });
                content += '\n';
            }
        });
    }

    editorContent.textContent = content;

    // Auto-save on blur or after typing pause
    let saveTimeout;
    editorContent.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveFromSinglePageEditor(editorContent.textContent);
        }, 1000); // Save 1 second after user stops typing
    });

    editorContent.addEventListener('blur', () => {
        saveFromSinglePageEditor(editorContent.textContent);
    });

    // Add placeholder text if empty
    if (!content.trim()) {
        editorContent.innerHTML = '<span style="color: var(--text-tertiary);">Start writing...</span>';
        editorContent.addEventListener('focus', function clearPlaceholder() {
            if (editorContent.textContent === 'Start writing...') {
                editorContent.textContent = '';
            }
            editorContent.removeEventListener('focus', clearPlaceholder);
        });
    }

    editorContainer.appendChild(editorContent);
    contentArea.appendChild(editorContainer);
}

/**
 * Save content from single-page editor back to current category
 *
 * What: Parses markdown-like text and converts it back to skills/items for current category
 * Why: Keeps data structure consistent for when user switches back to card view
 */
function saveFromSinglePageEditor(content) {
    const currentCategory = categories[activeTabIndex];
    if (!currentCategory) return;

    const lines = content.split('\n');
    const newSkills = [];
    let currentSkill = null;

    lines.forEach(line => {
        const trimmedLine = line.trim();

        if (!trimmedLine) return;

        // Skill heading (# Title)
        if (trimmedLine.startsWith('# ')) {
            // Save previous skill if exists
            if (currentSkill) {
                newSkills.push(currentSkill);
            }

            // Start new skill
            currentSkill = {
                title: trimmedLine.substring(2).trim(),
                items: []
            };
        }
        // List item (• or - or *)
        else if (trimmedLine.match(/^[•\-\*]\s+/)) {
            const itemText = trimmedLine.substring(2).trim();
            if (!currentSkill) {
                // Item without a skill - create a default skill
                currentSkill = {
                    title: 'Notes',
                    items: []
                };
            }
            currentSkill.items.push(itemText);
        }
        // Regular text - treat as item in current skill
        else {
            if (!currentSkill) {
                currentSkill = {
                    title: 'Notes',
                    items: []
                };
            }
            currentSkill.items.push(trimmedLine);
        }
    });

    // Add final skill
    if (currentSkill) {
        newSkills.push(currentSkill);
    }

    // Only update current category's skills if there's actual content
    if (newSkills.length > 0) {
        currentCategory.skills = newSkills;
        saveCategories();
    }
}

/**
 * Render main content area with all skills and items
 *
 * What: Generates the entire skills/checklist display for the active guide
 * Why: Core UI function - displays all user content (cards, items, checklists)
 * Called: After any content change (add/delete skill, check item, change layout, etc.)
 *
 * Performance: Rebuilds entire DOM each time (simple but works well for typical data sizes)
 * Alternative approach would be virtual DOM or incremental updates (more complex)
 */
function renderContent() {
    const contentArea = document.getElementById('contentArea');

    // Why clear innerHTML: Complete re-render ensures UI matches data state
    // Simpler than tracking individual DOM changes (fewer bugs)
    contentArea.innerHTML = '';

    // Why check single-page mode: Switch between card view and single-page editor for current tab
    const currentCategory = categories[activeTabIndex];
    if (currentCategory && currentCategory.singlePageMode) {
        renderSinglePageEditor();
        return;
    }

    // Check if single page view is enabled (new feature)
    const isSinglePageViewActive = currentCategory && currentCategory.singlePageViewEnabled;

    // Add or remove single-page-view-active class to body
    if (isSinglePageViewActive) {
        document.body.classList.add('single-page-view-active');
    } else {
        document.body.classList.remove('single-page-view-active');
    }

    // Reset content area styling for card view
    contentArea.style.cssText = '';

    // Why add edit-mode class: Enables CSS styling for edit state (drag handles, delete buttons, etc.)
    contentArea.className = 'content-area' + (editMode ? ' edit-mode' : '');

    // Render each category (only active one is visible via CSS)
    categories.forEach((cat, catIndex) => {
        const catDiv = document.createElement('div');

        // Why active class: Only the active category is visible, others are display:none
        // (could use single category render, but this allows smooth CSS transitions)
        catDiv.className = 'category' + (catIndex === activeTabIndex ? ' active' : '');

        const grid = document.createElement('div');

        // Why conditional class: Horizontal layout changes CSS grid to side-by-side display
        grid.className = 'skill-grid' + (layoutMode === 'horizontal' ? ' horizontal' : '');

        // Render each skill card within the category
        cat.skills.forEach((skill, skillIndex) => {
            const card = document.createElement('div');

            // Why sticky color: Mimics physical sticky notes (yellow, blue, pink, white)
            const stickyColor = skill.stickyColor || 'white';
			card.className = 'skill-card' + (stickyColor !== 'white' ? ' sticky-style' : '') + (stickyColor === 'blue' ? ' sticky-blue' : '') + (stickyColor === 'pink' ? ' sticky-pink' : '');

            // Why theme-based border: Maintains visual consistency with app theme
            // Light themes need darker borders for contrast
            const isLight = isLightColor(themeColor);
            card.style.borderLeftColor = isLight ? 'var(--secondary-color)' : 'var(--primary-color)';
            card.dataset.catIndex = catIndex;
            card.dataset.skillIndex = skillIndex; 
            
            const titleDiv = document.createElement('div'); 
			titleDiv.className = 'skill-title';
			// Only append title if hideHeading is not enabled
			if (!skill.hideHeading) {
			    card.appendChild(titleDiv);
			}
			
			// Add tap-and-hold + swipe down gesture to duplicate card
			let touchStartY = 0;
			let touchStartTime = 0;
			let longPressTimer = null;
			let isLongPress = false;
			
			titleDiv.addEventListener('touchstart', (e) => {
			    if (editMode) return;
			    touchStartY = e.touches[0].clientY;
			    touchStartTime = Date.now();
			    isLongPress = false;
			    
			    // Set timer for long press (500ms)
			    longPressTimer = setTimeout(() => {
			        isLongPress = true;
			        // Visual feedback - slight scale
			        titleDiv.style.transition = 'transform 0.2s ease';
			        titleDiv.style.transform = 'scale(1.05)';
			    }, 500);
			}, { passive: false });
			
			titleDiv.addEventListener('touchmove', (e) => {
		    if (editMode || !isLongPress) return;
		    
		    // Prevent scrolling during swipe gesture
		    e.preventDefault();
		    
		    const currentY = e.touches[0].clientY;
		    const deltaY = currentY - touchStartY;
		    
		    // Only proceed if swiping down
		    if (deltaY > 20) {
		        // Visual feedback during swipe
		        titleDiv.style.opacity = '0.7';
		    }
		}, { passive: false });
			
			titleDiv.addEventListener('touchend', (e) => {
		    if (editMode) return;
		    
		    clearTimeout(longPressTimer);
		    
		    // Reset visual feedback
		    titleDiv.style.transition = '';
		    titleDiv.style.transform = '';
		    titleDiv.style.opacity = '';
		    
		    if (isLongPress) {
		        const touchEndY = e.changedTouches[0].clientY;
		        const deltaY = touchEndY - touchStartY;
		        const swipeDistance = 50; // minimum distance to trigger
		        
		        // Check if swiped down enough
		        if (deltaY > swipeDistance) {
		            // Create duplicate with animation
		            const originalSkill = categories[catIndex].skills[skillIndex];
		            const duplicatedSkill = JSON.parse(JSON.stringify(originalSkill));
		            duplicatedSkill.title = duplicatedSkill.title + ' (Copy)';
		            
		            // Insert duplicate
		            categories[catIndex].skills.splice(skillIndex + 1, 0, duplicatedSkill);
		            saveCategories();
		            
		            // Re-render content
		            renderContent();
		            
		            // Animate the new duplicate card
		            setTimeout(() => {
		                const newCard = document.querySelector(`.skill-card[data-cat-index="${catIndex}"][data-skill-index="${skillIndex + 1}"]`);
		                if (newCard) {
		                    // Start from original position (overlapping)
		                    newCard.style.transition = 'none';
		                    newCard.style.transform = 'translateY(-100%)';
		                    newCard.style.opacity = '0';
		                    
		                    // Animate to final position
		                    setTimeout(() => {
		                        newCard.style.transition = 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
		                        newCard.style.transform = 'translateY(0)';
		                        newCard.style.opacity = '1';
		                        
		                        // Clean up after animation
		                        setTimeout(() => {
		                            newCard.style.transition = '';
		                            newCard.style.transform = '';
		                        }, 400);
		                    }, 50);
		                }
		            }, 10);
		        }
		    }
		    
		    isLongPress = false;
		});
			
			titleDiv.addEventListener('touchcancel', () => {
			    clearTimeout(longPressTimer);
			    titleDiv.style.transition = '';
			    titleDiv.style.transform = '';
			    titleDiv.style.opacity = '';
			    isLongPress = false;
			});
            
            // Add double-click to edit (only when not in edit mode)
            if (!editMode) {
                titleDiv.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Find the text span (last child that's not an icon)
                    const spans = titleDiv.querySelectorAll('span');
                    const titleSpan = spans[spans.length - 1]; // Get last span (the text)
                    if (titleSpan && !titleSpan.classList.contains('editable-icon') && !titleSpan.classList.contains('icon')) {
                        enableQuickEdit(titleSpan, catIndex, skillIndex);
                    }
                });
            }
            titleDiv.style.display = 'flex';
            titleDiv.style.alignItems = 'center';
            
            const hasIcon = skill.icon && skill.icon !== "​";
            let iconToShow;
            if (hasIcon) {
                if (skill.icon.startsWith('svg:')) {
                    const iconData = JSON.parse(skill.icon.substring(4));
                    iconToShow = `<span style="display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${iconData.path}"/></svg></span>`;
                } else {
                    iconToShow = skill.icon;
                }
            } else {
                iconToShow = editMode ? "+" : "​";
            }
            
            titleDiv.innerHTML += `
                <span class="editable-icon" style="display: inline-block; position: relative; margin-right: 8px;">
                    <span class="icon" data-cat-index="${catIndex}" data-skill-index="${skillIndex}" style="cursor: ${editMode ? 'pointer' : 'default'}; opacity: ${hasIcon ? '1' : '0.3'};">${iconToShow}</span>
                    ${editMode && hasIcon ? `<span class="emoji-remove-btn" data-cat-index="${catIndex}" data-skill-index="${skillIndex}">×</span>` : ''}
                </span>
                <span class="${editMode ? 'editable' : ''}" contenteditable="${editMode}">${skill.title}</span>
            `;

            // Add event listeners after creating the titleDiv
            if (editMode) {
                const iconSpan = titleDiv.querySelector('.icon');
                if (iconSpan) {
                    iconSpan.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const catIdx = parseInt(e.target.dataset.catIndex);
                        const skillIdx = parseInt(e.target.dataset.skillIndex);
                        editSkillIcon(catIdx, skillIdx, e.target);
                    });
                    iconSpan.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                    });
                }
                
                const removeIconBtn = titleDiv.querySelector('.emoji-remove-btn');
                if (removeIconBtn) {
                    removeIconBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const catIdx = parseInt(e.target.dataset.catIndex);
                        const skillIdx = parseInt(e.target.dataset.skillIndex);
                        categories[catIdx].skills[skillIdx].icon = '​';
                        saveCategories();
                        renderContent();
                    });
                }
            }                                     
                          
            if (editMode) {
                const editableSpan = titleDiv.querySelector('.editable');
                if (editableSpan) {
                    editableSpan.addEventListener('blur', (e) => { 
                        categories[catIndex].skills[skillIndex].title = e.target.textContent.trim(); 
                        saveCategories();
                    }); 
                }
            }
            
            
            // Add control buttons (available always, shown on double-tap or in edit mode)
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'skill-card-controls';
            
            // Bullet toggle button
const bulletStyle = skill.bulletStyle || 'checkbox';
const bulletIcons = {
    'checkbox': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    'number': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
    'square': '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>',
    'circle': '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"></circle></svg>',
    'none': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="4" y1="4" x2="20" y2="20"></line></svg>'
};
// Toggle bullets button
const toggleBtn = document.createElement('button');
toggleBtn.className = 'skill-control-btn';
toggleBtn.innerHTML = bulletIcons[bulletStyle];
toggleBtn.title = 'Change bullet style';
toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBulletStyle(catIndex, skillIndex);
});

// Duplicate button
const duplicateBtn = document.createElement('button');
duplicateBtn.className = 'skill-control-btn';
duplicateBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
duplicateBtn.title = 'Duplicate card';
duplicateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    duplicateSkill(catIndex, skillIndex);
});

// Delete button
const deleteBtn = document.createElement('button');
deleteBtn.className = 'skill-control-btn delete-control';
deleteBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
deleteBtn.title = 'Delete card';
deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSkill(catIndex, skillIndex);
});

// Reminder toggle button
const reminderKey = `${catIndex}-${skillIndex}`;
const reminderEnabled = skillReminders[reminderKey]?.enabled || false;
const reminderBtn = document.createElement('button');
reminderBtn.className = `skill-control-btn reminder-toggle-btn ${reminderEnabled ? 'active' : ''}`;
reminderBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
reminderBtn.title = 'Toggle Reminders';
reminderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSkillReminder(catIndex, skillIndex);
});
			// Hide Heading toggle button
const hideHeadingBtn = document.createElement('button');
hideHeadingBtn.className = 'skill-control-btn';
const headingHidden = skill.hideHeading || false;
hideHeadingBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    ${headingHidden ? 
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>' : 
        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'}
</svg>`;
hideHeadingBtn.title = headingHidden ? 'Show Heading' : 'Hide Heading';
hideHeadingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSkillHeading(catIndex, skillIndex);
});

			
			// Timer toggle button
			const timerToggleBtn = document.createElement('button');
			const timerKey = `${catIndex}-${skillIndex}`;
			const timerEnabled = itemTimers[timerKey]?.enabled || false;
			timerToggleBtn.className = timerEnabled ? 'skill-control-btn timer-enabled' : 'skill-control-btn';
			timerToggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			    <circle cx="12" cy="12" r="10"></circle>
			    <polyline points="12 6 12 12 16 14"></polyline>
			</svg>`;
			timerToggleBtn.title = timerEnabled ? 'Disable Timers' : 'Enable Timers';
			timerToggleBtn.addEventListener('click', (e) => {
			    e.stopPropagation();
			    toggleTimerForSkill(catIndex, skillIndex);
			});

			// Hide Background toggle button
			const hideBackgroundBtn = document.createElement('button');
			hideBackgroundBtn.className = 'skill-control-btn';
			const backgroundHidden = skill.hideItemBackground || false;
			hideBackgroundBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-dasharray="4 4"></rect>
			</svg>`;
			hideBackgroundBtn.title = backgroundHidden ? 'Show Item Background' : 'Hide Item Background';
			hideBackgroundBtn.addEventListener('click', (e) => {
			    e.stopPropagation();
			    toggleItemBackground(catIndex, skillIndex);
			});
						
			// Add in order: reminder, hide heading, timer, hide background
			controlsContainer.appendChild(reminderBtn);
			controlsContainer.appendChild(timerToggleBtn);
			controlsContainer.appendChild(hideHeadingBtn);
			controlsContainer.appendChild(hideBackgroundBtn);
			            
            card.appendChild(controlsContainer);
            
            // Add a visible menu button when not in edit mode
            if (!editMode) {
                const menuBtn = document.createElement('button');
                menuBtn.className = 'skill-control-btn';
                menuBtn.innerHTML = '⋮';
                menuBtn.style.position = 'absolute';
                menuBtn.style.top = '8px';
                menuBtn.style.right = '8px';
                menuBtn.style.opacity = '0.3';
                menuBtn.style.fontSize = '24px';
                menuBtn.style.zIndex = '5';
                menuBtn.style.background = 'white';
                menuBtn.style.borderRadius = '4px';
                menuBtn.style.padding = '6px 10px';
                menuBtn.style.border = 'none';
                menuBtn.style.cursor = 'pointer';
                menuBtn.title = 'Card options';
                menuBtn.className = 'skill-control-btn menu-trigger-btn';
				
                let hideTimeout;
                
                const startHideTimer = () => {
                    if (hideTimeout) clearTimeout(hideTimeout);
                    hideTimeout = setTimeout(() => {
                        controlsContainer.classList.remove('show');
                    }, 10000);
                };
                
                menuBtn.addEventListener('click', (e) => {
			    e.stopPropagation();
			    const isShowing = controlsContainer.classList.contains('show');
			    
			    // Hide all other open controls first
			    document.querySelectorAll('.skill-card-controls.show').forEach(c => {
			        if (c !== controlsContainer) c.classList.remove('show');
			    });
			    
			    // IMPORTANT: Hide the sticky color menu when 3-dots menu is clicked
			    const stickyMenu = document.getElementById(`stickyColorMenu-${catIndex}-${skillIndex}`);
			    if (stickyMenu) {
			        stickyMenu.classList.remove('show');
			    }
			    
			    // Disable the color picker button when 3-dot menu is open
			    const stickyBtn = card.querySelector('.sticky-color-btn');
			    if (stickyBtn) {
			        if (!isShowing) {
			            stickyBtn.classList.add('disabled');
			        } else {
			            stickyBtn.classList.remove('disabled');
			        }
			    }
			    
			    controlsContainer.classList.toggle('show');
				    
				    // Start timer if showing
				    if (!isShowing) {
				        startHideTimer();
				    } else {
				        if (hideTimeout) clearTimeout(hideTimeout);
				    }
				});
                
                // Reset timeout on any interaction with the controls
				[reminderBtn, timerToggleBtn, hideHeadingBtn, hideBackgroundBtn].forEach(btn => {
				    btn.addEventListener('click', () => {
				        startHideTimer();
				    });
				});
                
                card.appendChild(menuBtn);
                
                // Hide controls when clicking outside
                document.addEventListener('click', (e) => {
                    if (!card.contains(e.target) && controlsContainer.classList.contains('show')) {
                        controlsContainer.classList.remove('show');
                    }
                });
            }

			// Add sticky color button
			const stickyColorBtn = document.createElement('button');
			stickyColorBtn.className = 'sticky-color-btn';
			stickyColorBtn.title = 'Change card style';
			stickyColorBtn.addEventListener('click', (e) => toggleStickyColorMenu(e, catIndex, skillIndex));
			card.appendChild(stickyColorBtn);
			
			// Add sticky color menu
			const stickyColorMenu = document.createElement('div');
			stickyColorMenu.className = 'sticky-color-menu';
			stickyColorMenu.id = `stickyColorMenu-${catIndex}-${skillIndex}`;
			stickyColorMenu.innerHTML = `
			    <div class="sticky-color-options">
			        <div class="sticky-color-option sticky-color-yellow" title="Yellow"></div>
			        <div class="sticky-color-option sticky-color-blue" title="Blue"></div>
			        <div class="sticky-color-option sticky-color-pink" title="Pink"></div>
			        <div class="sticky-color-option sticky-color-white" title="Original"></div>
			    </div>
			`;
			card.appendChild(stickyColorMenu);
			
			// Add click handlers to color options
			stickyColorMenu.querySelectorAll('.sticky-color-option').forEach(option => {
			    option.addEventListener('click', (e) => {
			        e.stopPropagation();
			        if (option.classList.contains('sticky-color-yellow')) setStickyColor('yellow', catIndex, skillIndex);
			        else if (option.classList.contains('sticky-color-blue')) setStickyColor('blue', catIndex, skillIndex);
			        else if (option.classList.contains('sticky-color-pink')) setStickyColor('pink', catIndex, skillIndex);
			        else if (option.classList.contains('sticky-color-white')) setStickyColor('white', catIndex, skillIndex);
			        stickyColorMenu.classList.remove('show');
			    });
			});
			
			// Close menu when clicking outside
			document.addEventListener('click', (e) => {
			    if (!stickyColorMenu.contains(e.target) && !stickyColorBtn.contains(e.target)) {
			        stickyColorMenu.classList.remove('show');
			    }
			});
			
            skill.items.forEach((item, itemIndex) => { 
                const itemId = `${catIndex}-${skillIndex}-${itemIndex}`; 
                const checkItem = document.createElement('div'); 
                checkItem.className = 'checklist-item' + (checkedItems[itemId] ? ' checked' : '') + (skill.hideItemBackground ? ' no-background' : '');
                checkItem.dataset.catIndex = catIndex;
                checkItem.dataset.skillIndex = skillIndex;
                checkItem.dataset.itemIndex = itemIndex;
                
                // Make draggable when NOT in edit mode
                if (!editMode) {
                    checkItem.draggable = true;
                    checkItem.style.cursor = 'grab';
                }
                
                // Render appropriate bullet based on style
                const bulletStyle = skill.bulletStyle || 'checkbox';
                let bulletElement;
                
                if (bulletStyle === 'checkbox') {
                    bulletElement = document.createElement('div');
                    bulletElement.className = 'checkbox';
                } else if (bulletStyle === 'number') {
				    bulletElement = document.createElement('div');
				    bulletElement.className = 'bullet-number';
				    bulletElement.textContent = (itemIndex + 1) + '.';
                } else if (bulletStyle === 'square') {
                    bulletElement = document.createElement('div');
                    bulletElement.className = 'bullet-square';
                    bulletElement.textContent = '■';
                } else if (bulletStyle === 'circle') {
                    bulletElement = document.createElement('div');
                    bulletElement.className = 'bullet-circle';
                    bulletElement.textContent = '●';
                } else if (bulletStyle === 'none') {
                    bulletElement = document.createElement('div');
                    bulletElement.className = 'bullet-none';
                }
                
                checkItem.appendChild(bulletElement);
                
                // Only checkbox/bullet triggers the check, not the whole item
                if (!editMode) {
                    bulletElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleCheck(itemId);
                    });
                    bulletElement.style.cursor = 'pointer';
                }
                
                const textWrapper = document.createElement('div');
				textWrapper.style.flex = '1';
				textWrapper.style.display = 'flex';
				textWrapper.style.flexDirection = 'column';
				
				const textDiv = document.createElement('div');
				textDiv.className = 'checklist-text' + (editMode ? ' editable' : '');
				textDiv.contentEditable = editMode;
				textDiv.textContent = item;
				
				textWrapper.appendChild(textDiv);
				checkItem.appendChild(textWrapper);
				
				// Add reminder icon if reminders are enabled for this skill 
				const reminderKey2 = `${catIndex}-${skillIndex}`;
				if (skillReminders[reminderKey2]?.enabled) {
				    const hasReminder2 = skillReminders[reminderKey2]?.items?.[itemIndex];
					const reminderIcon2 = document.createElement('span');
					reminderIcon2.className = `reminder-icon ${hasReminder2 ? 'has-reminder' : ''}`;
					
					if (hasReminder2) {
				    // Show reminder info text instead of bell icon
				    const formatDate2 = (dateStr) => {
				    if (!dateStr) return '';
				    const d = new Date(dateStr + 'T00:00:00');
				    const today = new Date();
				    const tomorrow = new Date(today);
				    tomorrow.setDate(tomorrow.getDate() + 1);
				    
				    const isTomorrow = d.getDate() === tomorrow.getDate() && 
				                      d.getMonth() === tomorrow.getMonth() && 
				                      d.getFullYear() === tomorrow.getFullYear();
				    
				    if (isTomorrow) return 'Tomorrow';
				    
				    // Format with ordinal suffix (1st, 2nd, 3rd, etc.)
				    const day = d.getDate();
				    const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor(day % 100 / 10) === 1) ? 0 : day % 10];
				    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
				    
				    return `${day}${suffix} ${monthNames[d.getMonth()]}`;
				};
				    
				    const formatRepeat2 = (days) => {
				        if (!days || days.length === 0) return '';
				        if (days.length === 7) return 'Daily';
				        if (days.length === 5 && !days.includes('Sat') && !days.includes('Sun')) return 'Weekdays';
				        if (days.length === 2 && days.includes('Sat') && days.includes('Sun')) return 'Weekends';
				        return days.map(d => d.charAt(0)).join('');
				    };
				    
				    // Build text: Repeat first, then Date (if exists), then Time
				    let parts = [];
				    
				    if (hasReminder2.repeatDays?.length > 0) {
				        parts.push(formatRepeat2(hasReminder2.repeatDays));
				    }
				    
				    if (hasReminder2.date) {
				        parts.push(formatDate2(hasReminder2.date));
				    }
				    
				    parts.push(hasReminder2.time);
				    
				    const infoText = parts.join(', ');
				    reminderIcon2.innerHTML = `<div class="reminder-info-text">${infoText}</div>`;
				    reminderIcon2.title = 'Edit reminder';
				} else {
					    // Show bell icon
					    reminderIcon2.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
					        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
					    </svg>`;
					    reminderIcon2.title = 'Set reminder';
					}
				    reminderIcon2.style.position = 'relative';
				    reminderIcon2.style.display = 'block';
				    reminderIcon2.style.marginTop = '4px';
				    reminderIcon2.style.marginLeft = '24px';
				    reminderIcon2.style.pointerEvents = 'auto';
				    reminderIcon2.dataset.catIndex = catIndex;
				    reminderIcon2.dataset.skillIndex = skillIndex;
				    reminderIcon2.dataset.itemIndex = itemIndex;
				    reminderIcon2.addEventListener('click', (e) => {
				        e.stopPropagation();
				        showReminderPicker(catIndex, skillIndex, itemIndex);
				    });
				    
				    // Hide reminder during text editing
				    if (editMode) {
				        reminderIcon2.style.display = 'none';
				    }
				    
				   textWrapper.appendChild(reminderIcon2);
				}
				
			// Add timer icon if timers are enabled for this skill
			const timerSkillKey = `${catIndex}-${skillIndex}`;
			if (itemTimers[timerSkillKey]?.enabled) {
			    const itemTimerKey = `${catIndex}-${skillIndex}-${itemIndex}`;
			    const hasTimer = itemTimers[itemTimerKey];
			    const timerIcon = document.createElement('span');
			    timerIcon.className = hasTimer ? 'timer-icon has-timer' : 'timer-icon';
			    
			    // Show time text if timer is set, otherwise show clock icon
			    if (hasTimer) {
			        const hours = hasTimer.hours || 0;
			        const minutes = hasTimer.minutes || 0;
			        let timeText = '';
			        if (hours > 0 && minutes > 0) {
			            timeText = `${hours}h ${minutes}m`;
			        } else if (hours > 0) {
			            timeText = `${hours}h`;
			        } else {
			            timeText = `${minutes}m`;
			        }
			        timerIcon.innerHTML = timeText;
			        timerIcon.style.fontSize = '13px';
			        timerIcon.style.fontWeight = '600';
			    } else {
			        timerIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			            <circle cx="12" cy="12" r="10"></circle>
			            <polyline points="12 6 12 12 16 14"></polyline>
			        </svg>`;
			    }
			    
			    timerIcon.title = hasTimer ? `Timer: ${hasTimer.hours || 0}h ${hasTimer.minutes || 0}m` : 'Set timer';
			    timerIcon.style.cursor = 'pointer';
			    timerIcon.style.position = 'absolute';
			    timerIcon.style.right = '8px';
			    timerIcon.style.top = '50%';
			    timerIcon.style.transform = 'translateY(-50%)';
			    timerIcon.style.opacity = hasTimer ? '1' : '0.4';
			    timerIcon.style.color = hasTimer ? 'var(--primary-color)' : '#9ca3af';
			    timerIcon.style.pointerEvents = 'auto';
			    timerIcon.dataset.catIndex = catIndex;
			    timerIcon.dataset.skillIndex = skillIndex;
			    timerIcon.dataset.itemIndex = itemIndex;
			    timerIcon.addEventListener('click', (e) => {
			        e.stopPropagation();
			        showTimerPicker(catIndex, skillIndex, itemIndex);
			    });
			    
			    // Hide timer during text editing OR if timers not enabled
				if (editMode || !itemTimers[timerSkillKey]?.enabled) {
				    timerIcon.style.display = 'none';
				}
				
				checkItem.appendChild(timerIcon);
			}	
				
				// Add click zone to the LEFT of the item (in the card's left margin area) (only when NOT in edit mode)
                if (!editMode) {
                    const addZone = document.createElement('div');
                    addZone.style.position = 'absolute';
                    addZone.style.left = '-24px';
                    addZone.style.top = '0';
                    addZone.style.width = '24px';
                    addZone.style.height = '100%';
                    addZone.style.cursor = 'pointer';
                    addZone.style.display = 'flex';
                    addZone.style.alignItems = 'center';
                    addZone.style.justifyContent = 'center';
                    addZone.style.opacity = '0';
                    addZone.style.transition = 'opacity 0.2s';
                    addZone.innerHTML = '+';
                    addZone.style.fontSize = '18px';
                    addZone.style.color = 'var(--primary-color)';
                    addZone.style.zIndex = '10';
                    
                    addZone.addEventListener('mouseenter', () => {
                        addZone.style.opacity = '0.6';
                    });
                    addZone.addEventListener('mouseleave', () => {
                        addZone.style.opacity = '0';
                    });
                    
                    addZone.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Add new item BEFORE the current item (at the clicked spot)
                    categories[catIndex].skills[skillIndex].items.splice(itemIndex, 0, "New item");
                    saveCategories();
                    renderContent();
                    
                    // Animate the new item sliding in from the right
                    setTimeout(() => {
                        const newItem = document.querySelector(`.checklist-item[data-cat-index="${catIndex}"][data-skill-index="${skillIndex}"][data-item-index="${itemIndex}"]`);
                        if (newItem) {
                            // Start from left side, off-screen
                            newItem.style.transition = 'none';
                            newItem.style.transform = 'translateX(100%)';
                            newItem.style.opacity = '0';
                            
                            // Animate to final position
                            setTimeout(() => {
                                newItem.style.transition = 'all 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)';
                                newItem.style.transform = 'translateX(0)';
                                newItem.style.opacity = '1';
                                
                                // Clean up after animation
                                setTimeout(() => {
                                    newItem.style.transition = '';
                                    newItem.style.transform = '';
                                }, 700);
                            }, 50);
                        }
                    }, 10);
                });
                    
                    checkItem.appendChild(addZone);
                    checkItem.style.position = 'relative';
                }
				
                // Add double-click to edit (only when not in edit mode)
                if (!editMode) {
                    textDiv.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        const parent = this.closest('.checklist-item');
                        if (parent && parent.onclick) {
                            parent.onclick = null; // Temporarily disable click
                        }
                        enableQuickEdit(this, catIndex, skillIndex, itemIndex);
                    });
                }

                if (editMode) {
                    const deleteItemBtn = document.createElement('button');
                    deleteItemBtn.className = 'delete-btn';
                    deleteItemBtn.textContent = '×';
                    deleteItemBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteItem(catIndex, skillIndex, itemIndex);
                    });
                    checkItem.appendChild(deleteItemBtn);
                    
                    textDiv.addEventListener('blur', (e) => { 
                        categories[catIndex].skills[skillIndex].items[itemIndex] = e.target.textContent.trim(); 
                        saveCategories();
                    }); 
                }
                
                card.appendChild(checkItem); 
            }); 

			// Add click zone below the last item on the left (only when NOT in edit mode)
            if (!editMode && skill.items.length > 0) {
                const addBelowLastZone = document.createElement('div');
                addBelowLastZone.style.position = 'absolute';
                addBelowLastZone.style.left = '0';
                addBelowLastZone.style.bottom = editMode ? '52px' : '0';
                addBelowLastZone.style.width = '24px';
                addBelowLastZone.style.height = '40px';
                addBelowLastZone.style.cursor = 'pointer';
                addBelowLastZone.style.display = 'flex';
                addBelowLastZone.style.alignItems = 'center';
                addBelowLastZone.style.justifyContent = 'center';
                addBelowLastZone.style.opacity = '0';
                addBelowLastZone.style.transition = 'opacity 0.2s';
                addBelowLastZone.innerHTML = '+';
                addBelowLastZone.style.fontSize = '18px';
                addBelowLastZone.style.color = 'var(--primary-color)';
                addBelowLastZone.style.zIndex = '10';
                
                addBelowLastZone.addEventListener('mouseenter', () => {
                    addBelowLastZone.style.opacity = '0.6';
                });
                addBelowLastZone.addEventListener('mouseleave', () => {
                    addBelowLastZone.style.opacity = '0';
                });
                
                addBelowLastZone.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newItemIndex = categories[catIndex].skills[skillIndex].items.length;
                    // Add new item AFTER the last item
                    categories[catIndex].skills[skillIndex].items.push("New item");
                    saveCategories();
                    renderContent();
                    
                    // Animate the new item sliding in from the right
                    setTimeout(() => {
                        const newItem = document.querySelector(`.checklist-item[data-cat-index="${catIndex}"][data-skill-index="${skillIndex}"][data-item-index="${newItemIndex}"]`);
                        if (newItem) {
                            // Start from left side, off-screen
                            newItem.style.transition = 'none';
                            newItem.style.transform = 'translateX(100%)';
                            newItem.style.opacity = '0';
                            
                            // Animate to final position
                            setTimeout(() => {
                                newItem.style.transition = 'all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
                                newItem.style.transform = 'translateX(0)';
                                newItem.style.opacity = '1';
                                
                                // Clean up after animation
                                setTimeout(() => {
                                    newItem.style.transition = '';
                                    newItem.style.transform = '';
                                }, 500);
                            }, 50);
                        }
                    }, 10);
                });
                
                card.appendChild(addBelowLastZone);
            }
			
            const addItemBtn = document.createElement('button'); 
            addItemBtn.className = 'add-item-btn'; 
            addItemBtn.textContent = '+ Add Item'; 
            addItemBtn.addEventListener('click', () => addItem(catIndex, skillIndex));
            card.appendChild(addItemBtn); 
            
            // Add click zone at center bottom to add card below (only when NOT in edit mode)
            if (!editMode) {
                const addCardZone = document.createElement('div');
                addCardZone.style.position = 'absolute';
                addCardZone.style.bottom = '0';
                addCardZone.style.left = '50%';
                addCardZone.style.transform = 'translateX(-50%)';
                addCardZone.style.width = '80px';
                addCardZone.style.height = '40px';
                addCardZone.style.cursor = 'pointer';
                addCardZone.style.display = 'flex';
                addCardZone.style.alignItems = 'center';
                addCardZone.style.justifyContent = 'center';
                addCardZone.style.opacity = '0';
                addCardZone.style.transition = 'opacity 0.2s';
                addCardZone.style.zIndex = '5';
                addCardZone.innerHTML = '+';
                addCardZone.style.fontSize = '28px';
                addCardZone.style.color = 'var(--primary-color)';
                addCardZone.style.fontWeight = 'bold';
                
                // Touch/hover events
                addCardZone.addEventListener('mouseenter', () => {
                    addCardZone.style.opacity = '0.7';
                    addCardZone.style.background = 'rgba(255,255,255,0.95)';
                    addCardZone.style.borderRadius = '12px 12px 0 0';
                    addCardZone.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.1)';
                });
                addCardZone.addEventListener('mouseleave', () => {
                    addCardZone.style.opacity = '0';
                    addCardZone.style.background = '';
                    addCardZone.style.boxShadow = '';
                });
                
                // Touch support for mobile
                addCardZone.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    addCardZone.style.opacity = '0.7';
                    addCardZone.style.background = 'rgba(255,255,255,0.95)';
                    addCardZone.style.borderRadius = '12px 12px 0 0';
                    addCardZone.style.boxShadow = '0 -2px 8px rgba(0,0,0,0.1)';
                });
                
                addCardZone.addEventListener('click', (e) => {
			    e.stopPropagation();
			    const newSkill = {
			        title: "New Skill",
			        icon: "✨",
			        items: ["New item - click to edit"]
			    };
			    
			    // Insert new skill
			    categories[catIndex].skills.splice(skillIndex + 1, 0, newSkill);
			    saveCategories();
			    
			    // Re-render content
			    renderContent();
			    
			    // Animate the new card sliding in from the right
			    setTimeout(() => {
			        const newCard = document.querySelector(`.skill-card[data-cat-index="${catIndex}"][data-skill-index="${skillIndex + 1}"]`);
			        if (newCard) {
			            // Start from right side, off-screen
			            newCard.style.transition = 'none';
			            newCard.style.transform = 'translateX(100%)';
			            newCard.style.opacity = '0';
			            
			            // Animate to final position
			            setTimeout(() => {
			                newCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
			                newCard.style.transform = 'translateX(0)';
			                newCard.style.opacity = '1';
			                
			                // Clean up after animation
			                setTimeout(() => {
			                    newCard.style.transition = '';
			                    newCard.style.transform = '';
			                }, 500);
			            }, 50);
			        }
			    }, 10);
			});
                
                card.appendChild(addCardZone);
                card.style.position = 'relative'; // Ensure card has position for absolute child
            }
            
                      
            grid.appendChild(card); 
        }); 
        
        catDiv.appendChild(grid); 
        
        const addSkillBtn = document.createElement('button'); 
        addSkillBtn.className = 'add-skill-btn'; 
        addSkillBtn.textContent = '+ Add New Card'; 
        addSkillBtn.addEventListener('click', () => addSkill(catIndex));
        catDiv.appendChild(addSkillBtn); 
        
        contentArea.appendChild(catDiv); 
    }); 
    
    // Preserve Done button state if in edit mode
    if (editMode) {
        setTimeout(() => {
            const saveBtn = document.getElementById('saveBtn');
            const menuBtn = document.getElementById('menuBtn');
            if (saveBtn) saveBtn.style.display = 'block';
            if (menuBtn) menuBtn.style.display = 'none';
        }, 0);
    }
	// Reapply wallpaper after rendering content
	    setTimeout(() => applyWallpaper(), 50);
}
	
/**
 * Switch to a different category tab
 * @param {number} index - Index of the category to switch to
 *
 * What: Changes active category and updates UI to show its content
 * Why: Users need to navigate between different categories of skills/checklists
 */
function switchTab(index) {
    // Update active tab index
    activeTabIndex = index;

    // Re-render tabs to update active state styling
    renderTabs();

    // Update category visibility (toggle 'active' class)
    const cats = document.querySelectorAll('.category');
    cats.forEach((cat, i) => cat.classList.toggle('active', i === activeTabIndex));

    // Update single page view class for the new active tab
    const currentCategory = categories[activeTabIndex];
    const isSinglePageViewActive = currentCategory && currentCategory.singlePageViewEnabled;
    if (isSinglePageViewActive) {
        document.body.classList.add('single-page-view-active');
    } else {
        document.body.classList.remove('single-page-view-active');
    }

    // Update floating button visibility
    const floatingBtn = document.getElementById('layoutBtn');
    if (floatingBtn && currentCategory) {
        floatingBtn.style.display = isSinglePageViewActive ? 'none' : 'flex';
    }

    // Re-render header to update menu button states
    renderHeader();

    // Why scroll active tab to center: Improves UX on mobile where tabs may overflow
    // Centers the active tab in viewport for better visibility
    setTimeout(() => {
        const navTabs = document.querySelector('.nav-tabs');
        const activeTab = navTabs.children[index];
        if (activeTab && navTabs) {
            // Calculate scroll position to center the active tab
            const tabCenter = activeTab.offsetLeft + (activeTab.offsetWidth / 2);
            const containerCenter = navTabs.offsetWidth / 2;
            const scrollPosition = tabCenter - containerCenter;

            // Why smooth: Better UX than instant jump
            navTabs.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        }
    }, 50); // Small delay ensures DOM is ready
}

/**
 * Toggle checkbox state for a checklist item
 * @param {string} itemId - Format: 'catIndex-skillIndex-itemIndex'
 *
 * What: Checks or unchecks a checklist item
 * Why: Core interaction - users need to mark tasks as complete/incomplete
 */
function toggleCheck(itemId) {
    // Why block in edit mode: Prevent accidental checks while rearranging items
    if (editMode) return;

    // Why preserve expanded state: Re-rendering would collapse all cards
    // User expects their expanded cards to stay open after checking an item
    const expandedCards = [];
    document.querySelectorAll('.skill-card.expanded').forEach(card => {
        expandedCards.push({
            catIndex: card.dataset.catIndex,
            skillIndex: card.dataset.skillIndex
        });
    });
    
    checkedItems[itemId] = !checkedItems[itemId]; 
    saveCheckedItems();
    renderContent(); 
    
    // Restore expanded state after re-render
    expandedCards.forEach(({catIndex, skillIndex}) => {
        const card = document.querySelector(`.skill-card[data-cat-index="${catIndex}"][data-skill-index="${skillIndex}"]`);
        if (card) card.classList.add('expanded');
    });
}

/**
 * Toggle edit mode on/off
 *
 * What: Switches between viewing mode and editing mode
 * Why editing mode: Allows users to modify structure (add/delete/reorder items)
 *      without accidentally doing so during normal use
 * Why separate mode: Prevents accidental modifications (like iOS's "Edit" button)
 *
 * In edit mode:
 * - Can reorder items via drag & drop
 * - Can delete items via swipe or button
 * - Can edit names inline
 * - Checkboxes are disabled (can't check items)
 * - Layout button is hidden (prevent conflicts)
 * - "Done" button replaces menu button
 */
function toggleEditMode() {
    const menu = document.getElementById('dropdownMenu');

    // Why close menu: User selected "Edit", no need to keep menu open
    if (menu) menu.classList.remove('show');

    // Toggle the global edit mode state
    editMode = !editMode;

    // Why body class: CSS can style entire page differently in edit mode
    // (e.g., show drag handles, change cursor, hide certain elements)
    if (editMode) {
        document.body.classList.add('edit-mode-active');
    } else {
        document.body.classList.remove('edit-mode-active');
    }

    // Why hide layout button in edit mode: Prevents UI conflicts
    // (drag handles would overlap with layout button)
    const floatingBtn = document.getElementById('layoutBtn');
    if (floatingBtn) {
        floatingBtn.style.display = editMode ? 'none' : 'flex';
    }

    // Re-render all UI sections to show/hide edit controls
    renderHeader();
    renderTabs();
    renderContent();

    // Why swap buttons: "Done" button provides clear exit from edit mode
    // Menu button only needed in normal viewing mode
    const saveBtn = document.getElementById('saveBtn');
    const menuBtn = document.getElementById('menuBtn');
    if (saveBtn && menuBtn) {
        if (editMode) {
            saveBtn.style.display = 'block';   // Show "Done"
            menuBtn.style.display = 'none';    // Hide menu (⋮)
        } else {
            saveBtn.style.display = 'none';    // Hide "Done"
            menuBtn.style.display = 'block';   // Show menu (⋮)
        }
    }
}

/**
 * Toggle between card view and single-page editor view for the current tab
 * Why: Provides a Notion-like editing experience where all content is in a single page
 * instead of separate cards, allowing for continuous writing and editing
 */
async function toggleSinglePageView() {
    const menu = document.getElementById('dropdownMenu');
    const currentCategory = categories[activeTabIndex];
    if (!currentCategory) return;

    // Check if there's only 1 card in the current tab
    const cardCount = currentCategory.skills ? currentCategory.skills.length : 0;

    if (cardCount !== 1) {
        // Show temporary message when trying to activate with more than 1 card
        showTemporaryMessage('Active with 1 card in tab only');
        return;
    }

    // Close menu
    if (menu) menu.classList.remove('show');

    // Toggle the single page view state for this category only
    currentCategory.singlePageViewEnabled = !currentCategory.singlePageViewEnabled;

    // Hide/show the floating layout button
    const floatingBtn = document.getElementById('layoutBtn');
    if (floatingBtn) {
        floatingBtn.style.display = currentCategory.singlePageViewEnabled ? 'none' : 'flex';
    }

    // Save to Firebase
    saveCategories();

    // Re-render UI
    renderHeader();  // Update checkmark in menu
    renderContent();  // Apply single page view styling
}

// Helper function to show temporary messages
function showTemporaryMessage(message) {
    // Remove any existing message
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'temporary-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    // Fade in
    setTimeout(() => {
        messageEl.classList.add('show');
    }, 10);

    // Remove after 2 seconds
    setTimeout(() => {
        messageEl.classList.remove('show');
        setTimeout(() => {
            messageEl.remove();
        }, 300);
    }, 2000);
}

function enableQuickEdit(element, catIndex, skillIndex, itemIndex = null) {
    if (editMode) return;
    
    const originalText = element.textContent.trim();
    const parentItem = element.closest('.checklist-item');
    
    // Prevent checkbox toggle during editing
    if (parentItem) {
        parentItem.style.pointerEvents = 'none';
    }
    
    element.contentEditable = true;
    element.style.background = 'white';
    element.style.outline = '2px solid var(--primary-color)';
    element.style.borderRadius = '4px';
    element.style.padding = '4px 8px';
    element.style.userSelect = 'text';
    element.style.webkitUserSelect = 'text';
    
    // Focus and select all text
    setTimeout(() => {
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 10);
    
    function saveEdit() {
        const newText = element.textContent.trim();
        element.contentEditable = false;
        element.style.background = '';
        element.style.outline = '';
        element.style.padding = '';
        element.style.userSelect = '';
        element.style.webkitUserSelect = '';
        
        if (parentItem) {
            parentItem.style.pointerEvents = '';
        }
        
        if (newText && newText !== originalText) {
            if (itemIndex !== null) {
                categories[catIndex].skills[skillIndex].items[itemIndex] = newText;
            } else if (skillIndex !== null) {
                categories[catIndex].skills[skillIndex].title = newText;
            } else {
                categories[catIndex].name = newText;
            }
            saveCategories();
            setTimeout(() => {
                renderTabs();
                renderContent();
            }, 0);
        } else if (!newText) {
            element.textContent = originalText;
        }
        
        element.removeEventListener('blur', saveEdit);
        element.removeEventListener('keydown', keyHandler);
    }
    
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        } else if (e.key === 'Escape') {
            element.textContent = originalText;
            element.blur();
        }
    };
    
    element.addEventListener('blur', saveEdit);
    element.addEventListener('keydown', keyHandler);
}

function enableQuickEditHeader(element, type) {
    if (editMode) return;
    
    const originalText = element.textContent.trim();
    
    element.contentEditable = true;
    element.style.outline = '2px solid white';
    element.style.borderRadius = '4px';
    element.style.padding = '4px 8px';
    element.style.background = 'rgba(255, 255, 255, 0.2)';
    
    setTimeout(() => {
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 10);
    
    function saveEdit() {
        const newText = element.textContent.trim();
        element.contentEditable = false;
        element.style.outline = '';
        element.style.padding = '';
        element.style.background = '';
        
        if (newText && newText !== originalText) {
            if (type === 'title') {
                appTitle = newText;
            } else {
                appSubtitle = newText;
            }
            saveHeader();
        } else if (!newText) {
            element.textContent = originalText;
        }
        
        element.removeEventListener('blur', saveEdit);
        element.removeEventListener('keydown', keyHandler);
    }
    
    const keyHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            element.blur();
        } else if (e.key === 'Escape') {
            element.textContent = originalText;
            element.blur();
        }
    };
    
    element.addEventListener('blur', saveEdit);
    element.addEventListener('keydown', keyHandler);
}

/**
 * Edit the app icon (header emoji)
 * @param {HTMLElement} el - Element that triggered the icon picker
 *
 * What: Opens emoji picker to change the guide's header icon
 * Why: Visual customization - users can personalize each guide
 */
function editAppIcon(el) {
    showEmojiPicker(el, (emoji) => {
        appIcon = emoji;
        saveHeader(); // Persist to Firebase
    });
}

// ============================================================================
// SKILL/CARD MANAGEMENT
// ============================================================================
// Why "skills": Original concept was life skills checklist,
// but now used for any card-based content (checklists, notes, etc.)

/**
 * Add a new skill card to a category
 * @param {number} catIndex - Category index to add skill to
 *
 * What: Creates a new blank skill card with default content
 * Why: Users need to add cards to organize their content
 */
function addSkill(catIndex) {
    // Why default values: Provides starting template that user can immediately edit
    categories[catIndex].skills.push({
        title: "New Skill",
        icon: "✨",
        items: ["New item - click to edit"]
    });

    saveCategories();  // Persist to Firebase
    renderContent();   // Show new card immediately
    renderHeader();    // Update menu button states (e.g., single page view availability)
}

/**
 * Edit a skill card's icon
 * @param {number} catIndex - Category index
 * @param {number} skillIndex - Skill index within category
 * @param {HTMLElement} el - Element that triggered picker
 *
 * What: Opens emoji picker to change a card's icon
 * Why: Visual distinction - icons help identify cards quickly
 */
function editSkillIcon(catIndex, skillIndex, el) {
    showEmojiPicker(el, (emoji) => {
        categories[catIndex].skills[skillIndex].icon = emoji;
        saveCategories();
        renderContent();
    });
}

/**
 * Delete a skill card
 * @param {number} catIndex - Category index
 * @param {number} skillIndex - Skill index to delete
 *
 * What: Removes a skill card and all its items
 * Why async: Need to wait for user confirmation before deletion
 * Why confirm: Destructive action - prevent accidental deletions
 */
async function deleteSkill(catIndex, skillIndex) {
    if (await customConfirm('Are you sure you want to delete this card?')) {
        // splice: Remove 1 item at skillIndex position
        categories[catIndex].skills.splice(skillIndex, 1);

        // If single page view was enabled and we just deleted the last card, disable it
        if (categories[catIndex].singlePageViewEnabled && categories[catIndex].skills.length !== 1) {
            categories[catIndex].singlePageViewEnabled = false;
        }

        saveCategories();
        renderContent();
        renderHeader();    // Update menu button states (e.g., single page view availability)
    }
}

/**
 * Delete a checklist item
 * @param {number} catIndex - Category index
 * @param {number} skillIndex - Skill index
 * @param {number} itemIndex - Item index to delete
 *
 * What: Removes a single item from a skill's checklist
 * Why confirm: Prevents accidental deletions of individual items
 */
async function deleteItem(catIndex, skillIndex, itemIndex) {
    if (await customConfirm('Are you sure you want to delete this item?')) {
        categories[catIndex].skills[skillIndex].items.splice(itemIndex, 1);
        saveCategories();
        renderContent();
    }
}

/**
 * Add a new item to a skill's checklist
 * @param {number} catIndex - Category index
 * @param {number} skillIndex - Skill index to add item to
 *
 * What: Appends a new blank item to the skill's item list
 * Why: Users need to add items to their checklists
 */
function addItem(catIndex, skillIndex) {
    // Default text is editable via quick-edit (double-tap)
    categories[catIndex].skills[skillIndex].items.push("New item");
    saveCategories();
    renderContent();
}

function addCategory() {
    categories.push({
        name: "New Category",
        icon: "📌",
        skills: [
            {
                title: "New Skill",
                icon: "✨",
                items: ["New item - click to edit"]
            }
        ]
    });
    activeTabIndex = categories.length - 1;
    saveCategories();
    renderTabs();
    renderContent();
}

function editCategoryIcon(catIndex, el) {
    showEmojiPicker(el, (emoji) => {
        categories[catIndex].icon = emoji;
        saveCategories();
        renderTabs();
        renderContent();
    });
}
	
function toggleLayout() {
    if (!currentUser) return;
    // Disable layout toggle in single-page mode
    const currentCategory = categories[activeTabIndex];
    if (currentCategory && currentCategory.singlePageMode) return;

    if (layoutMode === 'vertical') {
        layoutMode = 'horizontal';
    } else {
        layoutMode = 'vertical';
    }
    set(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/layoutMode`), layoutMode);
    renderContent();
    updateLayoutButton();

}

function updateLayoutButton() {
    const btn = document.getElementById('layoutBtn');
    if (btn) {
        if (layoutMode === 'vertical') {
            btn.innerHTML = '<div style="display: flex; gap: 3px;"><div style="width: 12px; height: 12px; background: white; border-radius: 3px;"></div><div style="width: 12px; height: 12px; background: white; border-radius: 3px;"></div></div>';
            btn.title = 'Switch to horizontal scrolling';
        } else {
            btn.innerHTML = '<div style="display: flex; flex-direction: column; gap: 3px;"><div style="width: 12px; height: 12px; background: white; border-radius: 3px;"></div><div style="width: 12px; height: 12px; background: white; border-radius: 3px;"></div></div>';
            btn.title = 'Switch to vertical grid';
        }
        btn.style.opacity = '0.2';
    }
}

function toggleStickyColorMenu(e, catIndex, skillIndex) {
    e.stopPropagation();
    const menuId = `stickyColorMenu-${catIndex}-${skillIndex}`;
    const menu = document.getElementById(menuId);
    
    // Close all other sticky color menus
    document.querySelectorAll('.sticky-color-menu').forEach(m => {
        if (m.id !== menuId) m.classList.remove('show');
    });
    
    menu.classList.toggle('show');
    updateStickyColorOptions(catIndex, skillIndex);
}

function setStickyColor(color, catIndex, skillIndex) {
    const skill = categories[catIndex].skills[skillIndex];
    skill.stickyColor = color;
    saveCategories();
    renderContent();
}

function updateStickyColorOptions(catIndex, skillIndex) {
    const skill = categories[catIndex].skills[skillIndex];
    const currentColor = skill.stickyColor || 'white';
    const menuId = `stickyColorMenu-${catIndex}-${skillIndex}`;
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    const options = menu.querySelectorAll('.sticky-color-option');
    options.forEach(option => {
        option.classList.remove('active');
        if ((option.classList.contains('sticky-color-yellow') && currentColor === 'yellow') ||
            (option.classList.contains('sticky-color-blue') && currentColor === 'blue') ||
            (option.classList.contains('sticky-color-pink') && currentColor === 'pink') ||
            (option.classList.contains('sticky-color-white') && currentColor === 'white')) {
            option.classList.add('active');
        }
    });
}
	
async function deleteCategory(catIndex) {
    if (await customConfirm('Are you sure you want to delete this category?', 'Delete Category')) {
        categories.splice(catIndex, 1);
        if (activeTabIndex >= categories.length) {
            activeTabIndex = Math.max(0, categories.length - 1);
        }
        saveCategories();
        renderTabs();
        renderContent();
    }
}

	// Close menus when clicking outside
	document.addEventListener('click', (e) => {
	    const menu = document.getElementById('dropdownMenu');
	    const colorMenu = document.getElementById('colorPickerMenu');
	    const floatingBtn = document.getElementById('layoutBtn');
	    
	    // Don't close dropdown if clicking inside color picker
	    if (colorMenu && colorMenu.contains(e.target)) {
	        return; // Keep everything open when interacting with color picker
	    }

	// Close checkbox menu if clicking outside
		const checkboxMenu = document.getElementById('checkboxMenu');
		const checkboxOptionsBtn = document.getElementById('checkboxOptionsBtn');
		if (checkboxMenu && !checkboxMenu.contains(e.target) && !checkboxOptionsBtn?.contains(e.target)) {
		    checkboxMenu.classList.remove('show');
		}
    
    // Close dropdown menu if clicking outside
	if (menu && !menu.contains(e.target)) {
	    menu.classList.remove('show');
	    if (colorMenu) colorMenu.classList.remove('show');
	    // Only show floating button if drawer is also closed
	    const guideMenu = document.getElementById('guideDropdown');
	    if (floatingBtn && guideMenu && !guideMenu.classList.contains('show')) {  
	        floatingBtn.style.display = 'flex';
	    }
	}
    
    const guideMenu = document.getElementById('guideDropdown');
    const backdrop = document.getElementById('drawerBackdrop');
    
    // Don't close drawer if clicking inside it or on the hamburger button
    if (guideMenu && !guideMenu.contains(e.target) && !e.target.classList.contains('guide-menu-btn')) {
        if (guideMenu.classList.contains('show')) {
            closeDrawer();
        }
    }
	// Close logout menu if clicking outside
    const logoutMenu = document.getElementById('logoutMenu');
    if (logoutMenu && !logoutMenu.contains(e.target) && !e.target.closest('#logoutBtn')) {
        logoutMenu.classList.remove('show');
    }
});

// Check for auto-refresh when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentUser) {
        get(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/lastRefreshDate`)).then((snapshot) => {
            checkAndAutoRefresh(snapshot.val());
        });
    }
});

// Also check every hour while page is open
setInterval(() => {
    if (currentUser) {
        get(ref(database, `users/${currentUser.uid}/guides/${currentGuideId}/lastRefreshDate`)).then((snapshot) => {
            checkAndAutoRefresh(snapshot.val());
        });
    }
}, 60 * 60 * 1000);

// Wait for DOM to load before attaching login screen listeners
window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const googleBtn = document.getElementById('googleBtn');
    const signupBtn = document.getElementById('signupBtn');
    const loginPassword = document.getElementById('loginPassword');
    const layoutBtn = document.getElementById('layoutBtn');
    
    // NEW: Sign-up screen listeners
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    const googleSignupBtn = document.getElementById('googleSignupBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    const signupPassword = document.getElementById('signupPassword');
    const signupPasswordConfirm = document.getElementById('signupPasswordConfirm');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            login(email, password);
        });
    }
    
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            loginWithGoogle();
        });
    }
    
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            showSignup();
        });
    }
    
    // NEW: Sign-up button handlers
    if (signupSubmitBtn) {
        signupSubmitBtn.addEventListener('click', processSignup);
    }
    
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', loginWithGoogle);
    }
    
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', backToLogin);
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                login(email, password);
            }
        });
    }
    
    // NEW: Enter key support for sign-up
    if (signupPasswordConfirm) {
        signupPasswordConfirm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processSignup();
            }
        });
    }
    
    if (layoutBtn) {
        layoutBtn.addEventListener('click', toggleLayout);
    }
});


// Bottom Navigation Handler
document.addEventListener('DOMContentLoaded', () => {
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    const homePage = document.getElementById('homePage');
    const templatesPage = document.getElementById('templatesPage');
    const profilePage = document.getElementById('profilePage');
    const settingsPage = document.getElementById('settingsPage');
    const mainContainer = document.querySelector('.container');
    
    // Home page event listeners
    const homeCreateFolderBtn = document.getElementById('homeCreateFolderBtn');
    if (homeCreateFolderBtn) {
        homeCreateFolderBtn.addEventListener('click', async () => {
            const folderName = await customPrompt('Enter folder name:', 'New Folder', 'Create Folder');
            if (folderName) {
                createNewFolder(folderName);
            }
        });
    }
    
    // Profile page event listeners
    const profileSwitchAccountBtn = document.getElementById('profileSwitchAccountBtn');
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const profileDeleteAccountBtn = document.getElementById('profileDeleteAccountBtn');
    
    if (profileSwitchAccountBtn) {
        profileSwitchAccountBtn.addEventListener('click', async () => {
            if (await customConfirm('Switch to a different account? You will be logged out.', 'Switch Account', 'Switch')) {
                logout();
            }
        });
    }
    
    if (profileLogoutBtn) {
        profileLogoutBtn.addEventListener('click', async () => {
            if (await customConfirm('Are you sure you want to log out?', 'Logout', 'Logout')) {
                logout();
            }
        });
    }
    
    if (profileDeleteAccountBtn) {
        profileDeleteAccountBtn.addEventListener('click', async () => {
            if (await customConfirm('WARNING: This will permanently delete your account and ALL your data. This cannot be undone!', 'Delete Account', 'Delete')) {
                const confirmation = await customPrompt('Type "DELETE" to confirm:', '', 'Confirm Deletion');
                if (confirmation === 'DELETE') {
                    deleteAccount();
                }
            }
        });
    }
    
    // Settings page event listeners
    const settingsBackupBtn = document.getElementById('settingsBackupBtn');
    if (settingsBackupBtn) {
        settingsBackupBtn.addEventListener('click', async () => {
            await backupContent();
        });
    }
    
    // Templates page event listeners
    const templateCustomBtn = document.getElementById('templateCustomBtn');
    if (templateCustomBtn) {
        templateCustomBtn.addEventListener('click', () => {
            createNewGuide();
        });
    }
    
    // Handle template preset clicks
document.querySelectorAll('.template-preset-item').forEach(item => {
    item.addEventListener('click', () => {
        const template = item.dataset.template;
        if (template === 'journal') {
            // For journal, create the guide and then immediately create an entry
            createJournalFromTemplate();
        } else {
            createGuideFromTemplate(template);
        }
    });
});
    
    bottomNavItems.forEach((item) => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            
            // Save current page to localStorage
            localStorage.setItem('currentPage', page);
            
            // Remove active class from all items
            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');
            
            // Hide all pages
            mainContainer.style.display = 'none';
            if (homePage) homePage.classList.remove('active');
            if (templatesPage) templatesPage.classList.remove('active');
            if (profilePage) profilePage.classList.remove('active');
            if (settingsPage) settingsPage.classList.remove('active');
            
            if (page === 'guides') {
                // Show home page
                if (homePage) {
                    homePage.classList.add('active');
                    populateHomePage();
                }
            } else if (page === 'templates') {
                // Show templates page
                if (templatesPage) {
                    templatesPage.classList.add('active');
                }
            } else if (page === 'profile') {
                // Show profile page
                if (profilePage) {
                    profilePage.classList.add('active');
                    const profileEmail = document.getElementById('profileEmail');
                    if (profileEmail && currentUser) {
                        profileEmail.textContent = currentUser.email;
                    }
                }
            } else if (page === 'settings') {
                // Show settings page
                if (settingsPage) {
                    settingsPage.classList.add('active');
                }
            }
        });
    });
});


document.getElementById('homeMoveBtn')?.addEventListener('click', async () => {
    if (selectedGuides.size === 0) {
        await customAlert('Please select at least one page', 'No Selection');
        return;
    }
    
    const collectionsSnapshot = await get(ref(database, `users/${currentUser.uid}/collections`));
    const collections = collectionsSnapshot.val() || {};
    const collectionsArray = Object.keys(collections).map(id => ({
        id: id,
        name: collections[id].name
    }));
    
    if (collectionsArray.length === 0) {
        await customAlert('No collections available. Create a collection first.', 'No Collections');
        return;
    }
    
    // Show collection selection dialog
    const collectionOptions = collectionsArray.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.innerHTML = `
        <div class="custom-dialog-title">Move to Collection</div>
        <div class="custom-dialog-message">Select a collection for ${selectedGuides.size} page${selectedGuides.size > 1 ? 's' : ''}</div>
        <select id="collectionSelect" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; margin-bottom: 16px;">
            <option value="">Remove from collection</option>
            ${collectionOptions}
        </select>
        <div class="custom-dialog-buttons">
            <button class="custom-dialog-button" data-result="cancel">Cancel</button>
            <button class="custom-dialog-button primary" data-result="ok">Move</button>
        </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);
    
    const closeDialog = async (result) => {
        if (result === 'ok') {
            const collectionId = document.getElementById('collectionSelect').value;
            
            for (const guideId of selectedGuides) {
                if (collectionId) {
                    await set(ref(database, `users/${currentUser.uid}/guides/${guideId}/collectionId`), collectionId);
                } else {
                    await remove(ref(database, `users/${currentUser.uid}/guides/${guideId}/collectionId`));
                }
            }
            
            toggleSelectMode();
            populateHomePage();
        }
        
        overlay.classList.remove('show');
        setTimeout(() => document.body.removeChild(overlay), 200);
    };
    
    dialog.querySelectorAll('.custom-dialog-button').forEach(btn => {
        btn.addEventListener('click', () => closeDialog(btn.dataset.result));
    });
});

// Change type of selected guides
document.getElementById('homeChangeTypeBtn')?.addEventListener('click', async () => {
    if (selectedGuides.size === 0) {
        await customAlert('Please select at least one page', 'No Selection');
        return;
    }

    // Fetch custom types from database
    const customTypesSnapshot = await get(ref(database, `users/${currentUser.uid}/customTypes`));
    const customTypes = customTypesSnapshot.val() || {};

    const customTypesArray = Object.keys(customTypes).map(id => ({
        id: id,
        name: customTypes[id].name || 'Untitled Type',
        createdAt: customTypes[id].createdAt || 0
    })).sort((a, b) => a.createdAt - b.createdAt);

    // Build options for select dropdown
    let typeOptions = `
        <option value="">No type</option>
        <option value="values">Values</option>
        <option value="short-notes">Short notes</option>
        <option value="reminders">Reminders</option>
        <option value="routines">Routines</option>
        <option value="trackers">Trackers</option>
        <option value="journals">Journals</option>
    `;

    // Add custom types
    customTypesArray.forEach(type => {
        typeOptions += `<option value="${type.id}">${type.name}</option>`;
    });

    // Show type selection dialog
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.innerHTML = `
        <div class="custom-dialog-title">Change Type</div>
        <div class="custom-dialog-message">Select a type for ${selectedGuides.size} page${selectedGuides.size > 1 ? 's' : ''}</div>
        <select id="typeSelect" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; margin-bottom: 16px;">
            ${typeOptions}
        </select>
        <div class="custom-dialog-buttons">
            <button class="custom-dialog-button" data-result="cancel">Cancel</button>
            <button class="custom-dialog-button primary" data-result="ok">Change</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 10);

    const closeDialog = async (result) => {
        if (result === 'ok') {
            const templateType = document.getElementById('typeSelect').value;

            // Update all selected guides with the new type
            const updatePromises = [];
            for (const guideId of selectedGuides) {
                if (templateType === '') {
                    // Remove type - set to "No type"
                    updatePromises.push(
                        remove(ref(database, `users/${currentUser.uid}/guides/${guideId}/templateType`))
                    );
                } else {
                    // Set specific type
                    updatePromises.push(
                        set(ref(database, `users/${currentUser.uid}/guides/${guideId}/templateType`), templateType)
                    );
                }
            }

            // Wait for all updates to complete
            await Promise.all(updatePromises);

            console.log(`Changed ${selectedGuides.size} guide(s) to type: ${templateType || 'No type'}`);

            // Exit select mode and refresh
            toggleSelectMode();
            await populateHomePage();
        }

        overlay.classList.remove('show');
        setTimeout(() => document.body.removeChild(overlay), 200);
    };

    dialog.querySelectorAll('.custom-dialog-button').forEach(btn => {
        btn.addEventListener('click', () => closeDialog(btn.dataset.result));
    });
});

// Delete selected guides
document.getElementById('homeDeleteBtn')?.addEventListener('click', async () => {
    if (selectedGuides.size === 0) {
        await customAlert('Please select at least one page', 'No Selection');
        return;
    }
    
    let message;
    if (selectedGuides.size === 1) {
        // Get the guide name for single deletion
        const guideId = Array.from(selectedGuides)[0];
        const guidesSnapshot = await get(ref(database, `users/${currentUser.uid}/guides`));
        const guides = guidesSnapshot.val() || {};
        const guideName = guides[guideId]?.appTitle || 'Untitled';
        message = `Delete "${guideName}"? This cannot be undone.`;
    } else {
        message = `Delete ${selectedGuides.size} pages? This cannot be undone.`;
    }
    
    if (await customConfirm(message, 'Delete', 'Delete')) {
        const deletePromises = [];
        selectedGuides.forEach(guideId => {
            deletePromises.push(remove(ref(database, `users/${currentUser.uid}/guides/${guideId}`)));
        });
        
        await Promise.all(deletePromises);
        
        toggleSelectMode();
        populateHomePage();
        await customAlert('Pages deleted successfully!', 'Success');
    }
});	

async function backupContent() {
    if (!currentUser) return;
    
    try {
        // Get all user data
        const snapshot = await get(ref(database, `users/${currentUser.uid}`));
        const userData = snapshot.val();
        
        if (!userData) {
            await customAlert('No data to backup', 'Backup');
            return;
        }
        
        // Create JSON blob
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notebook-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        await customAlert('Backup downloaded successfully!', 'Backup Complete');
    } catch (error) {
        await customAlert('Failed to create backup: ' + error.message, 'Backup Failed');
    }
}

		// Profile name editing
    const profileNameTitle = document.getElementById('profileNameTitle');
    if (profileNameTitle) {
        profileNameTitle.addEventListener('click', () => {
            profileNameTitle.contentEditable = 'true';
            profileNameTitle.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(profileNameTitle);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        
        profileNameTitle.addEventListener('blur', () => {
            profileNameTitle.contentEditable = 'false';
            const newName = profileNameTitle.textContent.trim() || 'Enter Name';
            profileNameTitle.textContent = newName;
            
            // Save to Firebase
            if (currentUser) {
                set(ref(database, `users/${currentUser.uid}/profileName`), newName);
            }
        });
        
        profileNameTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                profileNameTitle.blur();
            }
        });
    }
    
    // Load profile name when showing profile page
    if (profilePage && currentUser) {
        get(ref(database, `users/${currentUser.uid}/profileName`)).then((snapshot) => {
            if (snapshot.exists() && profileNameTitle) {
                profileNameTitle.textContent = snapshot.val();
            }
        });
    }

		// Settings restore from backup
    const settingsRestoreBtn = document.getElementById('settingsRestoreBtn');
    const restoreFileInput = document.getElementById('restoreFileInput');
    
    if (settingsRestoreBtn && restoreFileInput) {
        settingsRestoreBtn.addEventListener('click', () => {
            restoreFileInput.click();
        });
        
        restoreFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const backupData = JSON.parse(text);
                
                if (await customConfirm('This will restore all data from the backup file. Your current data will be replaced. Continue?', 'Restore Backup', 'Restore')) {
                    // Upload to Firebase
                    await set(ref(database, `users/${currentUser.uid}`), backupData);
                    await customAlert('Backup restored successfully! Refreshing...', 'Restore Complete');
                    window.location.reload();
                }
            } catch (error) {
                await customAlert('Failed to restore backup: ' + error.message, 'Restore Failed');
            }
            
            // Reset file input
	            restoreFileInput.value = '';
	        });
	    }

    // Dark Mode Toggle
    const darkModeCheckbox = document.getElementById('darkModeCheckbox');

    // Toggle dark mode
    function toggleDarkMode() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
    }

    // Add event listener to checkbox
    if (darkModeCheckbox) {
        darkModeCheckbox.addEventListener('change', toggleDarkMode);

        // Sync checkbox with current dark mode state
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        darkModeCheckbox.checked = isDarkMode;
    }




