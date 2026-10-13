# IntellMeet
 
IntellMeet is an AI-powered video meeting platform built using the MERN stack. It combines real-time video conferencing, live transcription, meeting notes, AI-generated summaries, and collaboration tools into a single web application.
 
Developed as part of the Zidio Internship Program.
 
## Live Demo
 
- Frontend (Vercel): https://intellmeet-puce.vercel.app
- Backend (Render): https://intellmeet-wtu0.onrender.com
- GitHub Repository: https://github.com/kaif2518/intellmeet
---
 
## Features
 
### Authentication
 
- User signup and login
- JWT-based authentication
- Protected routes
- Password hashing with bcrypt
### Meeting Management
 
- Create meetings
- Join meetings using Meeting ID
- Join meetings using invite links
- Dashboard with Live, Upcoming, and Ended meetings
- Automatic meeting expiry after 2 hours from scheduled time
### Video Conferencing
 
- Real-time video meetings using WebRTC
- PeerJS-based peer-to-peer connections
- Multi-user video support
- Participant name labels
- Cross-network connectivity using TURN relay
### Live Transcript
 
- Browser Speech Recognition API
- Live transcript with speaker names
- Interim transcript display
- Transcript automatically added to notes when the meeting ends
### AI Meeting Summary
 
- AI-generated meeting summaries using Groq
- Meeting overview
- Key points
- Decisions
- Action items
- Owner and due-date extraction
### Collaboration Features
 
- Raise hand
- Meeting chat
- Emoji reactions
- Real-time reaction animations
Supported reactions: 👍 💙 👏 🎉 😂 😮 🔥
 
### Media Controls
 
- Mute / Unmute microphone
- Camera On / Off
- Front and back camera switching on supported devices
- Floating video controls
- Auto-hide controls after inactivity
### Security
 
- JWT authentication
- Protected API routes
- Socket event validation
- Room membership verification
---
 
## Tech Stack
 
**Frontend**
 
- React
- Vite
- React Router
- Axios
- Socket.io Client
- PeerJS
- CSS
**Backend**
 
- Node.js
- Express.js
- Socket.io
- JWT
- bcrypt
- Mongoose
**Database**
 
- MongoDB Atlas
**AI**
 
- Groq API
- GPT-OSS-120B
**Real-Time Communication**
 
- WebRTC
- PeerJS
- Socket.io
- Metered TURN Relay
**Deployment**
 
- Vercel (Frontend)
- Render (Backend)
- MongoDB Atlas
---
 
## Project Structure
 
```
intellmeet/
├── client/
│   ├── src/
│   └── ...
├── server/
│   ├── models/
│   ├── routes/
│   └── ...
└── README.md
```
 
---
 
## Environment Variables
 
**Server (`server/.env`)**
 
```
MONGO_URI=
JWT_SECRET=
GROQ_API_KEY=
```
 
**Client (`client/.env`)**
 
```
VITE_API_URL=
VITE_SERVER_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```
 
Do not commit `.env` files to GitHub.
 
---
 
## Local Setup
 
**1. Clone the repository**
 
```bash
git clone https://github.com/kaif2518/intellmeet.git
cd intellmeet
```
 
**2. Install backend dependencies**
 
```bash
cd server
npm install
```
 
**3. Install frontend dependencies**
 
```bash
cd ../client
npm install
```
 
**4. Configure environment variables**
 
Create the required `.env` files inside both the `server` and `client` folders.
 
**5. Run the backend**
 
```bash
cd server
npm run dev
```
 
**6. Run the frontend**
 
```bash
cd client
npm run dev
```
 
**7. Open**
 
http://localhost:5173
 
---
 
## How It Works
 
1. Users create or join a meeting.
2. PeerJS establishes WebRTC connections between participants.
3. Socket.io manages signaling and real-time communication.
4. Speech recognition generates live transcripts.
5. Notes and transcripts are stored with the meeting.
6. AI generates a structured meeting summary.
7. Users can review the summary after the meeting ends.
---
 
## Current Limitations
 
- Maximum 6 participants per meeting
- Meeting expires 2 hours after scheduled start
- Speech recognition works best in Chrome and Edge
- Mesh architecture is suitable for small groups (approximately 4 to 6 users)
---
 
## Future Improvements
 
- Picture-in-picture self view
- Host moderation controls
- Screen sharing
- Meeting recording
- Calendar integration
- Migration to a media server architecture such as LiveKit
---
 
## Author
 
Mohammed Kaif
B.E Graduate
Electronics and Communication Engineering
 
Developed as part of the Zidio Internship Project.
 
---
 
## License
 
This project is intended for educational and internship demonstration purposes.
