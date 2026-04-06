# **GridWorkz 🎓**

**GridWorkz** is a custom-built, full-stack homeschooling management platform designed to streamline curriculum tracking, student accountability, and state-mandated reporting. Built with a "Mobile-First" philosophy, it empowers students to manage their daily "Blocks" while providing parents with real-time insights and automated weekly transcripts.

## **🚀 Key Features**

### **👨‍👩‍👧‍👦 Parent Dashboard**

* **Multi-Student Support:** Manage multiple students (Caleb, Evelyn, etc.) from a single interface.  
* **Shared Curriculum:** Assign a single subject (e.g., PE, Chess, Spanish) to multiple students with independent progress tracking.  
* **Live Pulse:** Real-time feed of student submissions and learning summaries.  
* **Automated Reporting:** Generate professional Weekly Reports grouped by subject, including dates and resources used.

### **🧒 Student Portal**

* **The Grid System:** Visual representation of weekly goals using interactive "Blocks."  
* **Interactive Submissions:** Students must provide a **150-character minimum summary** for every completed block to ensure high-quality reflection.  
* **Resource Attribution:** Students can select which assigned resources (websites, books, or offline tasks) they used for each block.  
* **Weekly Progress Bar:** A persistent, sticky visual indicator of total weekly completion.  
* **Dark Mode:** Fully optimized for late-night study or low-light environments.

### **📊 Professional Infrastructure**

* **Mobile-First Design:** Fully responsive UI with 44x44px touch targets and an app-like navigation experience.  
* **Clean Data Schema:** Standardized student\_ids array-based querying for efficient multi-user data retrieval.  
* **Print Optimization:** Custom CSS to ensure reports print perfectly on white backgrounds for physical records.

## **🛠 Tech Stack**

* **Frontend:** React (Vite)  
* **Styling:** Tailwind CSS  
* **Backend/Database:** Firebase (Firestore & Auth)  
* **Deployment:** Cloudflare Pages (CI/CD via GitHub)  
* **Development Tooling:** Windsurf AI

## **📂 Data Schema (Standardized)**

### **Subjects Collection**

| Field | Type | Description |
| :---- | :---- | :---- |
| title | String | Name of the subject (e.g., "Spanish") |
| student\_ids | Array | List of UIDs assigned to this subject |
| block\_count | Number | Total blocks assigned for the week |
| block\_length | Number | Duration/value of each block (e.g., 30 mins) |
| completed\_blocks | Number | Current count of blocks finished |
| resources | Array | List of maps containing name and optional url |
| parent\_id | String | UID of the managing parent |

## **📅 Roadmap & Future Enhancements**

* \[ \] **Daily SMS Notifications:** Automated text reminders for students via Twilio/AWS.  
* \[ \] **Auto-Reset Engine:** Scheduled Sunday night "Finalize & Reset" logic.  
* \[ \] **Google Calendar Sync:** Exporting blocks to student calendars using .edu account integrations.  
* \[ \] **PWA Support:** Official "Add to Home Screen" manifest for native mobile experience.

## **🚢 Deployment Workflow**

GridWorkz uses a **CI/CD pipeline** via Cloudflare Pages.

1. **Stage Changes:** git add .  
2. **Commit:** git commit \-m "Description of update"  
3. **Push:** git push  
4. **Live:** The site automatically rebuilds and deploys to production within 2-3 minutes.