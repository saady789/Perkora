# Perkora

**AI-powered perks discovery for startups**

Perkora is an intelligent agent that searches, fetches, and curates relevant perks and benefits for early-stage startups. Built with cutting-edge AI inference and smart data management, Perkora helps startups discover opportunities they might otherwise miss.

---

## 🎯 Features

### 🤖 Intelligent Search & Discovery

- **Autonomous AI Agent** - Proactively searches for startup perks across the web
- **Smart Content Fetching** - Context-aware analysis of discovered opportunities
- **Intelligent Reasoning** - Identifies the most relevant perks for your startup
- **Continuous Learning** - Improves recommendations based on startup profiles

### 💾 Smart Memory & Context Management

- **SmartMemory System** - Efficient context window management for long conversations
- **Token Optimization** - Works around token limits through intelligent summarization
- **Context Preservation** - Maintains critical information while managing efficiency
- **Selective Retention** - Keeps only the most relevant conversation history

### 🗄️ Intelligent Data Storage

- **SmartSQL Database** - Purpose-built storage for perk data and startup profiles
- **Fast Retrieval** - Optimized queries for personalized recommendations
- **Relational Integrity** - Maintains connections between startups, perks, and applications
- **Historical Tracking** - Complete audit trail of all discovered opportunities

### 🧠 Smart Inference Engine

- **Advanced Reasoning** - Evaluates perks against specific startup needs
- **Multi-Factor Analysis** - Considers stage, industry, team size, and burn rate
- **Detailed Explanations** - Explains why perks are valuable for your startup
- **Ranking System** - Prioritizes perks by relevance and impact

---

## 🛠️ Tech Stack

### Frontend

- `Next.js` - Modern React framework for fast, SEO-friendly UI
- Server-side rendering for optimal performance
- API routes for seamless backend communication

### Backend

- `Raindrop` - AI agent framework for intelligent task execution
- Python-based processing pipeline
- RESTful API for frontend integration

### Data & Intelligence

- `SmartSQL` - Custom query optimization and data persistence
- `SmartMemory` - Dynamic context management for LLM operations
- `Smart Inference` - Reasoning layer for perk evaluation and matching

---

## 📋 How It Works

1. **Profile Creation** → Startups provide basic info *(stage, industry, team size, burn rate)*
2. **Intelligent Search** → Raindrop agent searches across perk databases
3. **Context Analysis** → SmartMemory maintains conversation context efficiently
4. **Data Storage** → Results stored in SmartSQL for instant retrieval
5. **Smart Matching** → Inference engine evaluates and ranks perks
6. **Recommendations** → Personalized perks with reasoning and application links

---

## 🚀 Getting Started

### Prerequisites

```
✓ Node.js 18+
✓ Python 3.10+
✓ PostgreSQL (for SmartSQL backend)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/saady789/Perkora.git
cd Perkora

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt
```

### Environment Setup

**Frontend** - Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Backend** - Create `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost/perkora
RAINDROP_API_KEY=your_key_here
```

### Running Locally

```bash
# Terminal 1: Start the frontend
cd frontend
npm run dev

# Terminal 2: Start the backend
cd backend
python app.py
```

> 💡 Visit `http://localhost:3000` to see the application running

---

## 🧩 Core Components

### Frontend (`/frontend`)

- 🏠 Landing page and onboarding flow
- 📊 Startup profile dashboard
- 🔍 Perks discovery interface
- 📱 Application tracking system

### Backend (`/backend`)

- 🤖 Raindrop AI agent orchestration
- 💾 SmartSQL query builder and ORM
- 🧠 SmartMemory context management
- ⚙️ Smart inference reasoning engine
- 🕷️ Web scraping and content fetching

---

## ⚡ Performance & Optimization

| Feature | Benefit |
|---------|---------|
| **SmartMemory Compression** | Reduces token usage by 40-60% |
| **SmartSQL Indexing** | Fast retrieval of perk categories |
| **Strategic Caching** | Eliminates redundant API calls |
| **Parallel Processing** | Batch processes multiple startup profiles |

---

## 📞 Support

For issues, questions, or feature requests, [open an issue on GitHub](https://github.com/saady789/Perkora/issues).

---

### ❤️ Built with love for startup founders

**Perkora** — *Making startup benefits discovery intelligent, efficient, and personalized.*
